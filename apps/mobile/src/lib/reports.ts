import { A11yReportInput } from '@sezi/shared';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const KEY = 'sezi.reports.v1';

/**
 * Erişilebilirlik bildirimleri önce cihazda kuyruğa alınır ("queued").
 * Giriş yapıldığında sunucuya (a11y_reports, RLS: insert_own) gönderilir ve "pending" olur.
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

export function addReport(input: A11yReportInput & { workSlug: string }): LocalReport {
  const valid = A11yReportInput.parse(input);
  const report: LocalReport = {
    ...valid,
    workSlug: input.workSlug,
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'queued',
  };
  cache = [report, ...read()];
  Storage.setItemSync(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
  return report;
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
