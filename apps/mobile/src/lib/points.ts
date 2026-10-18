import { LocalizedText, type NavPoint } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { setNavPoints } from './nav';
import { AUDIO_BASE, supabase } from './supabase';
import { prefetchChirp } from './voice/chirp';

/**
 * Noktalar (nav_points): admin panelinden girilen başlangıç, yer işareti, anlatım ve eser varışı noktaları.
 * Son bilinen liste ve indirilen ses dosyaları cihazda tutulur; internet yokken de rota ve yürüyüş çalışır.
 * Her değişiklik rota grafiğine de uygulanır (nav.ts › setNavPoints).
 */
const KEY = 'sezi.points.v1';
const COLUMNS = 'id, city_slug, roles, title, body, lng, lat, radius_m, work_slug, salience, ambient, sort_order, audio_tr, audio_en';

const Row = z.object({
  id: z.string(),
  city_slug: z.string(),
  roles: z.array(z.enum(['start', 'landmark', 'story', 'arrival'])).min(1),
  title: LocalizedText,
  body: LocalizedText.nullable(),
  lng: z.number(),
  lat: z.number(),
  radius_m: z.number(),
  work_slug: z.string().nullable(),
  salience: z.number().nullable(),
  ambient: z.enum(['water', 'market', 'chime']).nullable(),
  sort_order: z.number(),
  audio_tr: z.string().nullable(),
  audio_en: z.string().nullable(),
});

function toPoints(rows: unknown[]): NavPoint[] {
  return rows.flatMap((r) => {
    const p = Row.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [{
      id: d.id,
      citySlug: d.city_slug,
      roles: d.roles,
      title: d.title,
      body: d.body ?? undefined,
      location: [d.lng, d.lat],
      radiusM: d.radius_m,
      workSlug: d.work_slug ?? undefined,
      salience: d.salience ?? undefined,
      ambient: d.ambient ?? undefined,
      sortOrder: d.sort_order,
      audio: { tr: d.audio_tr ?? undefined, en: d.audio_en ?? undefined },
    }];
  });
}

let points: NavPoint[] = [];
const listeners = new Set<() => void>();

function setPoints(next: NavPoint[]) {
  points = next;
  setNavPoints(next);
  listeners.forEach((l) => l());
}

// Açılışta son bilinen liste cihazdan yüklenir.
try {
  const cached = z.array(z.unknown()).safeParse(JSON.parse(Storage.getItemSync(KEY) ?? '[]'));
  if (cached.success) setPoints(toPoints(cached.data));
} catch {
  // Bozuk önbellek yok sayılır; sunucudan yeniden alınır.
}

/** O anki noktalar (oturum gibi React dışı kod için). */
export const navPoints = () => points;

export function useNavPoints(): NavPoint[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => points,
  );
}

const audioDir = () => new Directory(Paths.cache, 'point-audio');
const localFile = (path: string) => new File(audioDir(), path.replaceAll('/', '_'));

/** Ses dosyalarını önceden indirir; tek indirme hatası atlanır (sonraki eşitlemede yeniden denenir). */
async function cacheAudio(list: NavPoint[]) {
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
export function pointAudioUri(path: string): string {
  const file = localFile(path);
  return file.exists ? file.uri : AUDIO_BASE + path;
}

/** Yayındaki noktaları çeker, cihazda saklar ve seslerini indirir; uygulama öne gelince yeniler. */
export function usePointsSync() {
  const { data, refetch } = useQuery({
    queryKey: ['nav_points'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('nav_points_view').select(COLUMNS).eq('status', 'verified');
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
    Storage.setItemSync(KEY, JSON.stringify(data));
    void cacheAudio(list);
    // TR kaydı olmayan anlatımlar Chirp ile önceden üretilir; sahada internetsiz çalar.
    void prefetchChirp(list.filter((p) => !p.audio.tr && p.body?.tr).map((p) => p.body!.tr));
  }, [data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refetch();
    });
    return () => sub.remove();
  }, [refetch]);
}
