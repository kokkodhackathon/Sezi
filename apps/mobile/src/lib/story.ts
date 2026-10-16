import { LocalizedText, type StoryPoint } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { supabase } from './supabase';

/**
 * Anlatım noktaları: admin panelinden girilen, yürüyüşte yaklaşınca açılan metin ve ses.
 * Son bilinen liste ve indirilen ses dosyaları cihazda tutulur; internet yokken de yürüyüş çalışır.
 */
const STORY_KEY = 'sezi.story.v1';
const AUDIO_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/`;

// Metni olmayan satır (body null) düşer: yayındaki noktada DB zaten metni zorunlu kılar.
const StoryRow = z.object({
  id: z.string(),
  city_slug: z.string(),
  title: LocalizedText,
  body: LocalizedText,
  lng: z.number(),
  lat: z.number(),
  radius_m: z.number(),
  audio_tr: z.string().nullable(),
  audio_en: z.string().nullable(),
});

function toPoints(rows: unknown[]): StoryPoint[] {
  return rows.flatMap((r) => {
    const p = StoryRow.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [{
      id: d.id,
      citySlug: d.city_slug,
      title: d.title,
      body: d.body,
      location: [d.lng, d.lat],
      radiusM: d.radius_m,
      audio: { tr: d.audio_tr ?? undefined, en: d.audio_en ?? undefined },
    }];
  });
}

let points: StoryPoint[] = [];
const listeners = new Set<() => void>();

function setPoints(next: StoryPoint[]) {
  points = next;
  listeners.forEach((l) => l());
}

// Açılışta son bilinen liste cihazdan yüklenir.
try {
  const cached = z.array(z.unknown()).safeParse(JSON.parse(Storage.getItemSync(STORY_KEY) ?? '[]'));
  if (cached.success) points = toPoints(cached.data);
} catch {
  // Bozuk önbellek yok sayılır; sunucudan yeniden alınır.
}

/** O anki anlatım noktaları (oturum gibi React dışı kod için). */
export const storyPoints = () => points;

export function useStoryPoints(): StoryPoint[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => points,
  );
}

const audioDir = () => new Directory(Paths.cache, 'story-audio');
const localFile = (path: string) => new File(audioDir(), path.replaceAll('/', '_'));

/** Ses dosyalarını önceden indirir; tek indirme hatası atlanır (sonraki eşitlemede yeniden denenir). */
async function cacheStoryAudio(list: StoryPoint[]) {
  try {
    audioDir().create({ idempotent: true });
  } catch {
    return;
  }
  for (const p of list) {
    for (const path of [p.audio.tr, p.audio.en]) {
      if (!path) continue;
      const file = localFile(path);
      if (file.exists) continue;
      try {
        await File.downloadFileAsync(AUDIO_BASE + path, file, { idempotent: true });
      } catch {
        // İnternet yok ya da dosya kaldırılmış: oynatıcı uzak adresi dener, olmazsa metin okunur.
      }
    }
  }
}

/** Çalınacak adres: indirildiyse yerel dosya, değilse sunucudaki dosya. */
export function storyAudioUri(path: string): string {
  const file = localFile(path);
  return file.exists ? file.uri : AUDIO_BASE + path;
}

/** Yayındaki anlatım noktalarını çeker, cihazda saklar ve seslerini indirir; uygulama öne gelince yeniler. */
export function useStorySync() {
  const { data, refetch } = useQuery({
    queryKey: ['story_points'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('story_points_view')
        .select('id, city_slug, title, body, lng, lat, radius_m, audio_tr, audio_en')
        .eq('status', 'verified');
      if (error) throw error;
      return (rows ?? []) as unknown[];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const list = toPoints(data);
    setPoints(list);
    Storage.setItemSync(STORY_KEY, JSON.stringify(data));
    void cacheStoryAudio(list);
  }, [data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refetch();
    });
    return () => sub.remove();
  }, [refetch]);
}
