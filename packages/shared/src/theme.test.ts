import { describe, expect, it } from "vitest";
import { contrastRatio, palette, themes } from "./theme";

describe("tema kontrastı (WCAG AA ≥ 4.5)", () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: metin ve buton çiftleri AA'yı geçer`, () => {
      const pairs: [string, string, string][] = [
        ["text/background", t.text, t.background],
        ["text/surface", t.text, t.surface],
        ["textMuted/background", t.textMuted, t.background],
        ["onPrimary/primary", t.onPrimary, t.primary],
        ["onAccent/accent", t.onAccent, t.accent],
        ["primary/background", t.primary, t.background],
        ["danger/background", t.danger, t.background],
      ];
      for (const [label, fg, bg] of pairs) {
        expect(contrastRatio(fg, bg), label).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("yüksek kontrast modu AAA (≥ 7) metin sağlar ve motifi kapatır", () => {
    const t = themes.highContrast;
    expect(contrastRatio(t.text, t.background)).toBeGreaterThanOrEqual(7);
    expect(t.motifOpacity).toBe(0);
  });

  it("dekoratif turkuaz beyaz metin için uygun değil (bu yüzden turquoiseDeep var)", () => {
    expect(contrastRatio(palette.white, palette.turquoise)).toBeLessThan(4.5);
  });
});
