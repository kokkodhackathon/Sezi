import { describe, expect, it } from "vitest";
import { sweetThemes } from "./sweet-theme";
import { contrastRatio } from "./theme";

describe("Çini 2 kontrastı (WCAG AA ≥ 4.5)", () => {
  for (const [name, t] of Object.entries(sweetThemes)) {
    it(`${name}: metin, ton, düğme ve sekme çubuğu çiftleri AA'yı geçer`, () => {
      const pairs: [string, string, string][] = [
        ["text/background", t.text, t.background],
        ["text/surface", t.text, t.surface],
        ["text/soft", t.text, t.soft],
        ["textMuted/background", t.textMuted, t.background],
        ["textMuted/soft", t.textMuted, t.soft],
        ["danger/background", t.danger, t.background],
        ["primary.ink/primary.fill", t.primary.ink, t.primary.fill],
        ["primaryText/background", t.primaryText, t.background],
        ["primaryText/surface", t.primaryText, t.surface],
        ["accent.ink/accent.fill", t.accent.ink, t.accent.fill],
        ["nav.foreground/nav.background", t.nav.foreground, t.nav.background],
        ["nav.activeLabel/nav.background", t.nav.activeLabel, t.nav.background],
        ["nav.activeForeground/nav.activeBackground", t.nav.activeForeground, t.nav.activeBackground],
        ["primaryText/soft", t.primaryText, t.soft],
        ["accentText/background", t.accentText, t.background],
        ["accentText/surface", t.accentText, t.surface],
        ["danger/surface", t.danger, t.surface],
        ["danger/soft", t.danger, t.soft],
      ];
      for (const [tone, { fill, ink }] of Object.entries(t.tones)) {
        pairs.push([`${tone}.ink/${tone}.fill`, ink, fill]);
      }
      for (const [label, fg, bg] of pairs) {
        expect(contrastRatio(fg, bg), label).toBeGreaterThanOrEqual(4.5);
      }
    });

    // Seçili sekme renkten bağımsız da ayrılır (dolu simge, kalın yazı); kapsül ya da simge çubuk zemininden seçilir (WCAG 1.4.11, ≥ 3).
    it(`${name}: seçili sekme çubuk zemininden ayırt edilir`, () => {
      const indicator = Math.max(contrastRatio(t.nav.activeBackground, t.nav.background), contrastRatio(t.nav.activeForeground, t.nav.background));
      expect(indicator).toBeGreaterThanOrEqual(3);
    });
  }

  // Web ve admin eylem rengi: açık temada koyu firuze dolgu (`tones.teal.ink`) üstünde yüzey rengi yazı (apps/web/src/lib/theme.ts).
  it("web eylem dolgusu (tones.teal.ink) üstünde yüzey rengi yazı AA'yı geçer", () => {
    const t = sweetThemes.light;
    expect(contrastRatio(t.surface, t.tones.teal.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.tones.teal.ink, t.background)).toBeGreaterThanOrEqual(3);
  });

  it("yüksek kontrast çerçeveli çizilir ve AAA (≥ 7) metin sağlar", () => {
    const t = sweetThemes.highContrast;
    expect(t.outlined).toBe(true);
    expect(contrastRatio(t.text, t.background)).toBeGreaterThanOrEqual(7);
  });
});
