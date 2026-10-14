/**
 * Sezi tasarım token'ları — "Çini" yönü (14 Ekim 2026).
 * Kaynak: Bursa'daki vakıf eserlerinin kubbe ve çini süslemeleri (envanter fotoğraf arşivi):
 * sıcak beyaz zemin, İznik turkuazı, mercan kırmızısı yalnızca vurguda, koyu mürekkep metin.
 * Arayüz yalnızca `themes` üzerinden renk kullanır; metin/zemin çiftleri theme.test.ts'te WCAG AA ile doğrulanır.
 */
export const palette = {
  ivory: "#FAF7F2", // zemin: fotoğraflar sarımsı krem yerine sıcak beyaz üstünde parlar
  white: "#FFFFFF",
  ink: "#1E1A17", // metin: kahve tonlu mürekkep
  inkMuted: "#5F5650",
  turquoise: "#3FA6A6", // İznik turkuazı — yalnızca dekoratif (beyaz metinle AA geçmez)
  turquoiseDeep: "#0B6E73", // etkileşimli öğeler için AA uyumlu turkuaz
  turquoiseLight: "#6FC7C4",
  coral: "#B8321F", // mercan kırmızısı: vurgu, seçili durum, UNESCO
  coralLight: "#F08A70",
  sand: "#ECE6DE", // ince ayraç
  mist: "#F1ECE5", // yumuşak dolgu (etiket, boş görsel)
  brown: "#6B3A22",
  crimson: "#8E1F1A",
  night: "#161311",
  nightRaised: "#211C19",
  // Eski adlar (eser türü renkleri ve geriye uyum için)
  rust: "#A4432A",
  brownInk: "#1E1A17",
  cream: "#FAF7F2",
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  /** Yumuşak dolgu: etiket, olgu satırı, fotoğrafı olmayan eser kutusu. */
  soft: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  danger: string;
  border: string;
  /** Kart gölgesinin rengi (çerçeve yerine). */
  shadow: string;
  /** Motif desenleri — düşük opaklıkla kullanılır, metin taşımaz. */
  motif: string;
  motifOpacity: number;
}

export const themes: Record<"light" | "dark" | "highContrast", ThemeColors> = {
  light: {
    background: palette.ivory,
    surface: palette.white,
    soft: palette.mist,
    text: palette.ink,
    textMuted: palette.inkMuted,
    primary: palette.turquoiseDeep,
    onPrimary: palette.white,
    accent: palette.coral,
    onAccent: palette.white,
    danger: palette.crimson,
    border: palette.sand,
    shadow: "#3A2A1E",
    motif: palette.turquoise,
    motifOpacity: 0.12,
  },
  dark: {
    background: palette.night,
    surface: palette.nightRaised,
    soft: "#2A2420",
    text: "#F2EDE7",
    textMuted: "#B5ABA2",
    primary: palette.turquoiseLight,
    onPrimary: palette.night,
    accent: palette.coralLight,
    onAccent: palette.night,
    danger: "#F28B82",
    border: "#332C27",
    shadow: "#000000",
    motif: palette.turquoiseLight,
    motifOpacity: 0.08,
  },
  // Az gören kullanıcı modu: motif kapalı, en yüksek kontrast.
  highContrast: {
    background: palette.white,
    surface: palette.white,
    soft: "#EDEDED",
    text: "#000000",
    textMuted: palette.ink,
    primary: "#064C50",
    onPrimary: palette.white,
    accent: "#8E1F1A",
    onAccent: palette.white,
    danger: "#8E1F1A",
    border: "#000000",
    shadow: "#000000",
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
