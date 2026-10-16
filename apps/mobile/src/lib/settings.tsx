import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { setPreferCurated } from './nav';

/** v2: birincil tema açık tema oldu; eski kayıttan yalnızca konuşma hızı ve il taşınır. */
const KEY = 'sezi.settings.v2';
const LEGACY_KEY = 'sezi.settings.v1';
const VISITED_KEY = 'sezi.visited.v1';

const SettingsSchema = z.object({
  themeMode: z.enum(['system', 'light', 'dark']).default('light'),
  /** expo-speech hızı: 0.7 yavaş – 1.2 hızlı. */
  speechRate: z.number().min(0.5).max(1.5).default(0.95),
  /** Keşfet ekranında seçili envanter ili. */
  city: z.string().default('bursa'),
  /** Geliştirici seçenekleri: sanal yürüyüş, jüri senaryoları ve cihaz testleri. */
  devSimulation: z.boolean().default(false),
  /** Simülasyonda rotanın başlayacağı buluşma/varış noktası (nav.ts › START_POINTS). */
  simStart: z.string().default('t1-ulucami'),
  /** Anlatım noktası sesi: otomatik ya da dokununca. */
  storyPlayback: z.enum(['auto', 'tap']).default('auto'),
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
  /** Simülasyon veya canlı rehberlikte varılan eserlerin slug'ları. */
  visited: string[];
  markVisited: (slug: string) => void;
  clearVisited: () => void;
}

const Ctx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    if (Storage.getItemSync(KEY)) return loadJson(KEY, SettingsSchema, SettingsSchema.parse({}));
    const legacy = loadJson(LEGACY_KEY, SettingsSchema, SettingsSchema.parse({}));
    return SettingsSchema.parse({ speechRate: legacy.speechRate, city: legacy.city });
  });
  const [visited, setVisited] = useState<string[]>(() => loadJson(VISITED_KEY, z.array(z.string()), []));

  const update = useCallback((patch: Partial<Settings>) => {
    // Ekip/Motor karşılaştırması geliştirici aracıdır: mod kapanınca normal kullanıcı yine ekip tarifini alır.
    if (patch.devSimulation === false) setPreferCurated(true);
    setSettings((prev) => {
      const next = SettingsSchema.parse({ ...prev, ...patch });
      Storage.setItemSync(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markVisited = useCallback((slug: string) => {
    setVisited((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      Storage.setItemSync(VISITED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearVisited = useCallback(() => {
    Storage.removeItemSync(VISITED_KEY);
    setVisited([]);
  }, []);

  const value = useMemo(() => ({ settings, update, visited, markVisited, clearVisited }), [settings, update, visited, markVisited, clearVisited]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings, SettingsProvider içinde kullanılmalı');
  return ctx;
}
