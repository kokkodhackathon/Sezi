import { SyncedSettings } from '@sezi/shared';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

/** v2: birincil tema açık tema oldu; eski kayıttan yalnızca konuşma hızı ve il taşınır. */
const KEY = 'sezi.settings.v2';
const LEGACY_KEY = 'sezi.settings.v1';

const SettingsSchema = SyncedSettings.extend({
  /** Keşfet ekranında seçili envanter ili. */
  city: z.string().default('bursa'),
  /** Geliştirici seçenekleri: sanal yürüyüş, jüri senaryoları ve cihaz testleri. */
  devSimulation: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;
function loadJson<T>(key: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    if (!raw) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    if (Storage.getItemSync(KEY)) return loadJson(KEY, SettingsSchema, SettingsSchema.parse({}));
    const legacy = loadJson(LEGACY_KEY, SettingsSchema, SettingsSchema.parse({}));
    return SettingsSchema.parse({ speechRate: legacy.speechRate, city: legacy.city });
  });

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = SettingsSchema.parse({ ...prev, ...patch });
      Storage.setItemSync(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings, SettingsProvider içinde kullanılmalı');
  return ctx;
}
