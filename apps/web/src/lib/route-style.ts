import { sweetThemes, type ProfileKey, type SweetTheme } from "@sezi/shared";

/**
 * Profil karşılaştırma çizgileri: renk yanında kalınlık ve kesiklikle de ayrışır (renk tek başına anlam taşımaz).
 * Çizim sırası kalından inceye; kalın çizgi altta kalır, üst üste binen rotalar da görünür. Renkler tema token'ı.
 */
export const PROFILE_DRAW_ORDER: ProfileKey[] = ["wheelchair", "blind", "walker", "deaf"];

export function profileLine(key: ProfileKey, highContrast: boolean): { color: string; width: number; dash?: number[] } {
  const th: SweetTheme = highContrast ? sweetThemes.highContrast : sweetThemes.light;
  switch (key) {
    case "wheelchair":
      return { color: highContrast ? th.primary.fill : th.primary.ink, width: 9 };
    case "blind":
      return { color: th.accentText, width: 5, dash: [1.4, 1] };
    case "walker":
      return { color: th.text, width: 3 };
    case "deaf":
      return { color: highContrast ? th.text : th.tones.saffron.ink, width: 3, dash: [0.4, 1.8] };
  }
}

/** Tek rota çizgisi (karşılaştırma kapalı). */
export const routeLineColor = (highContrast: boolean): string => (highContrast ? sweetThemes.highContrast.primaryText : sweetThemes.light.primaryText);
