import { TOUR_COLUMNS, toTours, type Tour } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { supabase } from './supabase';
import { prefetchWorks } from './works';

/**
 * Turlar (tours): admin panelinden girilen hazır turlar. Sıra cihazda rota grafiğiyle hesaplanır (planTour).
 * Son bilinen liste cihazda tutulur; internet yokken de turlar açılır.
 */
const KEY = 'sezi.tours.v1';
let tours: Tour[] = [];
const listeners = new Set<() => void>();

function setTours(next: Tour[]) {
  tours = next;
  listeners.forEach((l) => l());
}

// Açılışta son bilinen liste cihazdan yüklenir.
try {
  const cached = z.array(z.unknown()).safeParse(JSON.parse(Storage.getItemSync(KEY) ?? '[]'));
  if (cached.success) setTours(toTours(cached.data));
} catch {
  // Bozuk önbellek yok sayılır; sunucudan yeniden alınır.
}

export function useTours(): Tour[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => tours,
  );
}

/** Yayındaki turları çeker ve cihazda saklar; uygulama öne gelince yeniler. Hata olursa son liste kalır. */
export function useToursSync() {
  const { data, refetch } = useQuery({
    queryKey: ['tours'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('tours_view').select(TOUR_COLUMNS).eq('status', 'verified');
      if (error) throw error;
      return z.array(z.unknown()).parse(rows ?? []);
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const list = toTours(data);
    setTours(list);
    Storage.setItemSync(KEY, JSON.stringify(data));
    // Durak eserleri (fotoğraf, ad) cihazda saklanır: tur kartları internetsiz de dolu görünür.
    void prefetchWorks(list.flatMap((t) => t.stops));
  }, [data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refetch();
    });
    return () => sub.remove();
  }, [refetch]);
}
