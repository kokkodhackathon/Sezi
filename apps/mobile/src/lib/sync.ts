import { useQuery } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { PILOT_AREA, setOverrides, type OverrideType } from './nav';
import { syncReports } from './reports';
import { supabase } from './supabase';

const OVERRIDES_KEY = 'sezi.overrides.v1';
const OverrideList = z.array(z.object({ segment_key: z.string(), type: z.string() }));

// Açılışta son bilinen onaylar cihazdan yüklenir: internet yokken de rota onaylı bildirimleri dikkate alır.
try {
  const cached = OverrideList.safeParse(JSON.parse(Storage.getItemSync(OVERRIDES_KEY) ?? '[]'));
  if (cached.success && cached.data.length) setOverrides(cached.data as { segment_key: string; type: OverrideType }[]);
} catch {
  // Bozuk önbellek yok sayılır; sunucudan yeniden alınır.
}

/**
 * Uygulama ile admin paneli arasındaki bağ:
 * - onaylı erişilebilirlik bildirimlerini (segment_overrides) çekip rota grafiğine uygular,
 * - cihazdaki bildirim kuyruğunu gönderir; uygulama öne gelince ikisi de yenilenir.
 */
export function useServerSync() {
  const { data, refetch } = useQuery({
    queryKey: ['segment_overrides', PILOT_AREA],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('segment_overrides').select('segment_key, type').eq('area', PILOT_AREA);
      if (error) throw error;
      return (rows ?? []) as { segment_key: string; type: OverrideType }[];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setOverrides(data);
    Storage.setItemSync(OVERRIDES_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    void syncReports();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void refetch();
        void syncReports();
      }
    });
    return () => sub.remove();
  }, [refetch]);
}
