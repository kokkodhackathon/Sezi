import { NAV_POINT_COLUMNS, toNavPoints, toWorkPoints, WORK_TEXT_COLUMNS, workTextRows, type NavPoint, type WorkTextRow } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { inPilotArea, setNavPoints } from './nav';
import { AUDIO_BASE, supabase } from './supabase';
import { prefetchChirp } from './voice/chirp';
import { prefetchWorks } from './works';

/**
 * Noktalar (nav_points): admin panelinden girilen başlangıç, yer işareti, anlatım ve eser varışı noktaları.
 * Son bilinen liste ve indirilen ses dosyaları cihazda tutulur; internet yokken de rota ve yürüyüş çalışır.
 * Her değişiklik rota grafiğine de uygulanır (nav.ts › setNavPoints).
 */
const KEY = 'sezi.points.v1';
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
  if (cached.success) setPoints(toNavPoints(cached.data));
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

// ---------- Eser anlatımları ----------

/**
 * Yayınlanmış metni olan, konumu kesin pilot alan eserleri: yürürken yanından geçilince ve varışta (admin'de
 * varış bilgisi yoksa) kısa anlatım olarak açılır. Son bilinen liste cihazda tutulur; internetsiz de çalışır.
 */
const WORKS_KEY = 'sezi.workpoints.v1';

/** Geçerli, metinli ve pilot alandaki satırlar. */
const pilotWorkRows = (rows: unknown[]): WorkTextRow[] => workTextRows(rows, (r) => inPilotArea([r.lng, r.lat]));

let works: NavPoint[] = [];
const workListeners = new Set<() => void>();

function setWorkPoints(next: NavPoint[]) {
  works = next;
  workListeners.forEach((l) => l());
}

try {
  const cached = z.array(z.unknown()).safeParse(JSON.parse(Storage.getItemSync(WORKS_KEY) ?? '[]'));
  if (cached.success) setWorkPoints(toWorkPoints(pilotWorkRows(cached.data)));
} catch {
  // Bozuk önbellek yok sayılır; sunucudan yeniden alınır.
}

/** Eser anlatım noktaları (`work:<slug>`; oturum gibi React dışı kod için). */
export const workPoints = () => works;

export function useWorkPoints(): NavPoint[] {
  return useSyncExternalStore(
    (l) => {
      workListeners.add(l);
      return () => workListeners.delete(l);
    },
    () => works,
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
  const { data: workRows, refetch: refetchWorks } = useQuery({
    queryKey: ['work_points'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('works_view').select(WORK_TEXT_COLUMNS).eq('status', 'verified').eq('location_precision', 'exact').or('summary.not.is.null,history.not.is.null');
      if (error) throw error;
      return pilotWorkRows(rows ?? []);
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!workRows) return;
    const list = toWorkPoints(workRows);
    setWorkPoints(list);
    Storage.setItemSync(WORKS_KEY, JSON.stringify(workRows));
    // Kısa anlatımlar Chirp ile önceden üretilir; eserler (fotoğraf, ad) kart için cihazda saklanır.
    void prefetchChirp(list.flatMap((p) => (p.body ? [p.body.tr] : [])));
    void prefetchWorks(workRows.map((r) => r.slug));
  }, [workRows]);

  const { data, refetch } = useQuery({
    queryKey: ['nav_points'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('nav_points_view').select(NAV_POINT_COLUMNS).eq('status', 'verified');
      if (error) throw error;
      return (rows ?? []) as unknown[];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const list = toNavPoints(data);
    setPoints(list);
    Storage.setItemSync(KEY, JSON.stringify(data));
    void cacheAudio(list);
    // TR kaydı olmayan anlatımlar Chirp ile önceden üretilir; sahada internetsiz çalar.
    void prefetchChirp(list.filter((p) => !p.audio.tr && p.body?.tr).map((p) => p.body!.tr));
    // Noktalara bağlı eserler cihazda saklanır: yürüyüş kartındaki eser bilgisi internetsiz de görünür.
    void prefetchWorks(list.flatMap((p) => (p.workSlug ? [p.workSlug] : [])));
  }, [data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void refetch();
      void refetchWorks();
    });
    return () => sub.remove();
  }, [refetch, refetchWorks]);
}
