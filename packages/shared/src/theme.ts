/**
 * Sezi tasarım token'ları — kaynak: docs/Moodboard.png (piksel örneklemesi).
 * Ham moodboard renkleri `palette` içinde; arayüz yalnızca `themes` üzerinden renk kullanır.
 * Metin/zemin çiftleri WCAG AA (4.5:1) için theme.test.ts'te doğrulanır.
 */
export const palette = {
  turquoise: "#479389", // moodboard koyu turkuaz — yalnızca dekoratif (beyaz metinle 3.6:1)
  turquoiseLight: "#86CDC4",
  turquoiseDeep: "#2F6E66", // etkileşimli öğeler için AA uyumlu turkuaz
  terracotta: "#BA765B",
  terracottaLight: "#E08A6C",
  rust: "#A84428",
  brown: "#622714",
  brownInk: "#3A1A10",
  crimson: "#7B1D1D", // kilim motifi kırmızısı
  cream: "#F7F1E3",
  sand: "#D9D2CA",
  stone: "#A59887",
  night: "#1E1612",
  nightRaised: "#2A201B",
  white: "#FFFFFF",
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  danger: string;
  border: string;
  /** Motif desenleri — düşük opaklıkla kullanılır, metin taşımaz. */
  motif: string;
  motifOpacity: number;
}

export const themes: Record<"light" | "dark" | "highContrast", ThemeColors> = {
  light: {
    background: palette.cream,
    surface: palette.white,
    text: palette.brownInk,
    textMuted: "#6E5F55",
    primary: palette.turquoiseDeep,
    onPrimary: palette.white,
    accent: palette.rust,
    onAccent: palette.white,
    danger: palette.crimson,
    border: palette.sand,
    motif: palette.terracotta,
    motifOpacity: 0.08,
  },
  dark: {
    background: palette.night,
    surface: palette.nightRaised,
    text: "#F3E9DC",
    textMuted: "#B9A99B",
    primary: palette.turquoiseLight,
    onPrimary: palette.night,
    accent: palette.terracottaLight,
    onAccent: palette.night,
    danger: "#F28B82",
    border: "#4A3B33",
    motif: palette.terracottaLight,
    motifOpacity: 0.06,
  },
  // Az gören kullanıcı modu: motif kapalı, en yüksek kontrast.
  highContrast: {
    background: palette.white,
    surface: palette.white,
    text: "#000000",
    textMuted: palette.brownInk,
    primary: "#1D4A44",
    onPrimary: palette.white,
    accent: palette.brown,
    onAccent: palette.white,
    danger: palette.crimson,
    border: "#000000",
    motif: palette.white,
    motifOpacity: 0,
  },
};

/** WCAG 2.x kontrast oranı. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
