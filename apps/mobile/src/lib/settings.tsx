import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

const KEY = 'sezi.settings.v1';
const VISITED_KEY = 'sezi.visited.v1';

const Settings = z.object({
  themeMode: z.enum(['system', 'light', 'dark']).default('system'),
  /** expo-speech hızı: 0.7 yavaş – 1.2 hızlı. */
  speechRate: z.number().min(0.5).max(1.5).default(0.95),
});
export type Settings = z.infer<typeof Settings>;

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
  const [settings, setSettings] = useState<Settings>(() => loadJson(KEY, Settings, Settings.parse({})));
  const [visited, setVisited] = useState<string[]>(() => loadJson(VISITED_KEY, z.array(z.string()), []));

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = Settings.parse({ ...prev, ...patch });
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
