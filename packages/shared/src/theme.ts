/**
 * Renk yardımcıları. Arayüz renkleri `sweet-theme.ts` içindeki temalardan gelir;
 * metin/zemin çiftleri `sweet-theme.test.ts`'te bu fonksiyonla WCAG AA'ya karşı doğrulanır.
 */

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
