import { mergeVisits, VisitSchema, type Visit, type VisitMethod } from '@sezi/shared';
import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { useAccount } from './account';
import { supabase } from './supabase';

const ANON_KEY = 'sezi.visits.v2';
const LEGACY_KEY = 'sezi.visited.v1';
const StoreSchema = z.object({ visits: z.array(VisitSchema), pending: z.array(z.string()) });
type VisitStore = z.infer<typeof StoreSchema>;
const keyFor = (uid: string | null) => (uid ? `sezi.visits.${uid}.v2` : ANON_KEY);
const stores = new Map<string, VisitStore>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function readStore(key: string): VisitStore {
  const cached = stores.get(key);
  if (cached) return cached;
  try {
    const raw = Storage.getItemSync(key);
    if (raw) {
      const value = StoreSchema.parse(JSON.parse(raw));
      stores.set(key, value);
      return value;
    }
  } catch {
    /* Bozuk yerel kayıt boş pasaportla açılır. */
  }
  const empty: VisitStore = { visits: [], pending: [] };
  stores.set(key, empty);
  return empty;
}
function writeStore(key: string, value: VisitStore) {
  Storage.setItemSync(key, JSON.stringify(value));
  stores.set(key, value);
  listeners.forEach((listener) => listener());
}
function migrate() {
  const raw = Storage.getItemSync(LEGACY_KEY);
  if (!raw) return;
  try {
    const slugs = z.array(z.string()).parse(JSON.parse(raw));
    const first_at = new Date().toISOString();
    const old = readStore(ANON_KEY);
    const visits = mergeVisits(
      old.visits,
      slugs.map((work_slug) => ({ work_slug, first_at, method: 'route', distance_m: null })),
    );
    writeStore(ANON_KEY, { visits, pending: [...new Set([...old.pending, ...slugs])] });
    Storage.removeItemSync(LEGACY_KEY);
  } catch {
    /* Okunamayan eski kayıt değiştirilmez. */
  }
}
interface PassportContextValue {
  visits: Visit[];
  has: (slug: string) => boolean;
  record: (slug: string, method: VisitMethod, distanceM: number | null) => void;
  clear: () => Promise<void>;
  count: number;
}
const Context = createContext<PassportContextValue | null>(null);

export function PassportProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const uid = user?.id ?? null;
  const activeUid = useRef(uid);
  const running = useRef(false);
  const rerun = useRef(false);
  const generation = useRef(0);
  const uploading = useRef<Promise<unknown> | null>(null);
  const [initialized] = useState(() => {
    migrate();
    return true;
  });
  const sync = useCallback(async () => {
    if (!activeUid.current) return;
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        rerun.current = false;
        const owner = activeUid.current;
        if (!owner) break;
        const key = keyFor(owner);
        const epoch = generation.current;
        let local = readStore(key);
        const guest = readStore(ANON_KEY);
        if (guest.visits.length) {
          local = {
            visits: mergeVisits(local.visits, guest.visits),
            pending: [
              ...new Set([
                ...local.pending,
                ...guest.pending,
                ...guest.visits.map((visit) => visit.work_slug),
              ]),
            ],
          };
          writeStore(key, local);
          Storage.removeItemSync(ANON_KEY);
          stores.delete(ANON_KEY);
        }
        if (local.pending.length) {
          const sent = new Set(local.pending);
          const rows = local.visits
            .filter((visit) => sent.has(visit.work_slug))
            .map((visit) => ({ ...visit, user_id: owner }));
          const upload = Promise.resolve(
            supabase.from('visits').upsert(rows, { onConflict: 'user_id,work_slug', ignoreDuplicates: true }),
          );
          uploading.current = upload;
          const { error } = await upload;
          uploading.current = null;
          if (error) throw error;
          if (generation.current !== epoch) break;
          local = readStore(key);
          writeStore(key, { ...local, pending: local.pending.filter((slug) => !sent.has(slug)) });
        }
        const { data, error } = await supabase
          .from('visits')
          .select('work_slug, first_at, method, distance_m')
          .eq('user_id', owner);
        if (error) throw error;
        const remote = z.array(VisitSchema).parse(data);
        if (generation.current !== epoch) break;
        local = readStore(key);
        writeStore(key, { ...local, visits: mergeVisits(local.visits, remote) });
      } while (rerun.current);
    } catch {
      /* Ağ yoksa pending sonraki eşitlemede yeniden gönderilir. */
    } finally {
      running.current = false;
    }
  }, []);
  useEffect(() => {
    activeUid.current = uid;
    void sync();
  }, [uid, initialized, sync]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);
  const snapshot = useCallback(() => readStore(keyFor(uid)), [uid]);
  const visits = useSyncExternalStore(subscribe, snapshot, snapshot).visits;
  const has = useCallback((slug: string) => visits.some((visit) => visit.work_slug === slug), [visits]);
  const record = useCallback(
    (slug: string, method: VisitMethod, distanceM: number | null) => {
      const key = keyFor(activeUid.current);
      const local = readStore(key);
      if (local.visits.some((visit) => visit.work_slug === slug)) return;
      const visit: Visit = {
        work_slug: slug,
        method,
        distance_m: distanceM,
        first_at: new Date().toISOString(),
      };
      writeStore(key, { visits: [...local.visits, visit], pending: [...local.pending, slug] });
      void sync();
    },
    [sync],
  );
  const clear = useCallback(async () => {
    const owner = activeUid.current;
    generation.current += 1;
    writeStore(keyFor(owner), { visits: [], pending: [] });
    Storage.removeItemSync(keyFor(owner));
    if (owner) {
      // Devam eden ekleme silmeden önce tamamlanır; silinen damga yeniden oluşmaz.
      await uploading.current?.catch(() => undefined);
      const { error } = await supabase.from('visits').delete().eq('user_id', owner);
      if (error) throw error;
    }
  }, []);
  const value = useMemo(
    () => ({ visits, has, record, clear, count: visits.length }),
    [visits, has, record, clear],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePassport() {
  const value = useContext(Context);
  if (!value) throw new Error('usePassport, PassportProvider içinde kullanılmalı');
  return value;
}
