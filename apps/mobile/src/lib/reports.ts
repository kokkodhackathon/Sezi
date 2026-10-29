import { A11yReportInput } from '@sezi/shared';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { deviceId } from './device';
import { PILOT_AREA } from './nav';
import { supabase } from './supabase';
import { uuid } from './uuid';

const KEY = 'sezi.reports.v1';

/**
 * Erişilebilirlik bildirimleri önce cihazda kuyruğa alınır ("queued"); bağlantı olunca sunucuya gider ("pending").
 * Hesap gerekmez: RLS yalnızca "pending" eklemeye izin verir, admin onaylamadan rotaya etkisi olmaz.
 * Onaylanan bildirimin etkisi segment_overrides tablosunda görünür; durum oradan "approved" olur.
 */
export const LocalReportSchema = A11yReportInput.extend({
  id: z.string(),
  workSlug: z.string(),
  createdAt: z.string(),
  status: z.enum(['queued', 'pending', 'approved', 'rejected']),
});
export type LocalReport = z.infer<typeof LocalReportSchema>;

let cache: LocalReport[] | null = null;
const listeners = new Set<() => void>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


function read(): LocalReport[] {
  if (cache) return cache;
  try {
    const parsed = z.array(LocalReportSchema).safeParse(JSON.parse(Storage.getItemSync(KEY) ?? '[]'));
    cache = parsed.success ? parsed.data : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: LocalReport[]) {
  cache = next;
  Storage.setItemSync(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function addReport(input: A11yReportInput & { workSlug: string }): LocalReport {
  const valid = A11yReportInput.parse(input);
  const report: LocalReport = { ...valid, workSlug: input.workSlug, id: uuid(), createdAt: new Date().toISOString(), status: 'queued' };
  write([report, ...read()]);
  void syncReports();
  return report;
}

let syncing = false;

/**
 * Kuyruktaki bildirimleri gönderir, gönderilmişlerin onay durumunu günceller.
 * Ağ yoksa sessizce kuyrukta kalır; bir sonraki açılışta yeniden denenir.
 */
export async function syncReports(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    let list = read();
    for (const r of list.filter((x) => x.status === 'queued')) {
      const id = UUID.test(r.id) ? r.id : uuid();
      const { error } = await supabase.from('a11y_reports').insert({
        id,
        area: PILOT_AREA,
        segment_key: r.segmentId,
        type: r.type,
        note: r.note ?? null,
        work_slug: r.workSlug,
        device_id: deviceId(),
      });
      // Aynı kimlik zaten gönderilmişse (23505) bildirim sunucuda demektir.
      if (!error || error.code === '23505') {
        list = list.map((x) => (x.id === r.id ? { ...x, id, status: 'pending' } : x));
        write(list);
      }
    }
    const sent = list.filter((x) => x.status === 'pending' || x.status === 'approved');
    if (sent.length) {
      const { data } = await supabase.from('segment_overrides').select('segment_key, type').eq('area', PILOT_AREA);
      const approved = new Set((data ?? []).map((o) => `${o.segment_key}|${o.type}`));
      const next = list.map((x) =>
        x.status === 'pending' && approved.has(`${x.segmentId}|${x.type}`) ? { ...x, status: 'approved' as const } : x,
      );
      if (next.some((x, i) => x.status !== list[i]!.status)) write(next);
    }
  } finally {
    syncing = false;
  }
}

export function useReports(): LocalReport[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
  );
}
