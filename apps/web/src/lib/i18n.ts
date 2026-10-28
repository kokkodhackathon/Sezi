import { messages, type MessageKey } from "./messages";

/**
 * Dil: adresin ilk parçası (`/tr/...`, `/en/...`). Metinler `messages/*.ts` dosyalarında TR + EN birlikte;
 * EN tipi her anahtarı zorunlu kılar. Yol adları iki dilde de Türkçedir (`/en/eser/...`).
 */
export const LANGS = ["tr", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type { MessageKey };

export const isLang = (v: string | null | undefined): v is Lang => v === "tr" || v === "en";

export type Vars = Record<string, string | number>;

/** `{n}` gibi yer tutucular `vars` ile doldurulur. */
export function t(lang: Lang, key: MessageKey, vars?: Vars): string {
  const text = messages[lang][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Dil önekli site içi adres: `href('tr', '/rota')` → `/tr/rota`. */
export const href = (lang: Lang, path = ""): string => `/${lang}${path.startsWith("/?") ? path.slice(1) : path === "/" ? "" : path}`;

/** Sayı biçimi (Türkçede binlik ayırıcı nokta). */
export const formatNumber = (lang: Lang, n: number): string => n.toLocaleString(lang === "tr" ? "tr-TR" : "en-GB");

/** Tarih: 7 Kasım 2026 / 7 November 2026. Mesafe için ortak `formatDistance` (shared) kullanılır. */
export function formatDate(lang: Lang, iso: string): string {
  return new Date(iso).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}
