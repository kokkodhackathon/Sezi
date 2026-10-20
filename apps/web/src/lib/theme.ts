import { sweetThemes, type SweetTheme, type SweetToneName } from "@sezi/shared";

/**
 * Web teması mobil "Çini 2" token'larından üretilir (packages/shared/src/sweet-theme.ts); sabit renk kodu yazılmaz.
 * `:root` açık tema, `[data-contrast="high"]` yüksek kontrast. Değişken adları admin `index.css` ile aynı (shadcn).
 * Eylem rengi: masaüstünde beyaz zeminde silik kalmasın diye koyu firuze dolgu + beyaz yazı (admin ile aynı karar);
 * açık temada bu `tones.teal.ink`, yüksek kontrastta `primary.fill`. Kontrastı `sweet-theme.test.ts` korur.
 */

const TONES: SweetToneName[] = ["cobalt", "teal", "coral", "saffron", "sage", "plum"];

function vars(t: SweetTheme, action: { fill: string; ink: string }): string {
  const entries: [string, string][] = [
    ["background", t.background],
    ["foreground", t.text],
    ["card", t.surface],
    ["card-foreground", t.text],
    ["popover", t.surface],
    ["popover-foreground", t.text],
    ["primary", action.fill],
    ["primary-foreground", action.ink],
    ["secondary", t.soft],
    ["secondary-foreground", t.text],
    ["muted", t.soft],
    ["muted-foreground", t.textMuted],
    ["accent", t.soft],
    ["accent-foreground", t.text],
    ["destructive", t.danger],
    ["border", t.border],
    ["input", t.outlined ? t.border : t.textMuted],
    ["ring", t.primaryText],
    ["link", t.primaryText],
    ["success", t.tones.teal.fill],
    ["success-foreground", t.tones.teal.ink],
    ["warning", t.accent.fill],
    ["warning-foreground", t.accent.ink],
    ["highlight", t.primary.fill],
    ["highlight-foreground", t.primary.ink],
    ["accent-text", t.accentText],
    ["chart-1", t.tones.teal.ink],
    ["chart-2", t.primary.fill],
    ["chart-3", t.tones.coral.ink],
    ["chart-4", t.tones.cobalt.ink],
    ["chart-5", t.tones.saffron.ink],
    ...TONES.flatMap((n): [string, string][] => [
      [`tone-${n}-fill`, t.tones[n].fill],
      [`tone-${n}-ink`, t.tones[n].ink],
    ]),
  ];
  return entries.map(([k, v]) => `--${k}:${v};`).join("");
}

const light = sweetThemes.light;
const high = sweetThemes.highContrast;

/** Eylem dolgusu ve üstündeki yazı (tema başına). */
export const ACTION = {
  light: { fill: light.tones.teal.ink, ink: light.surface },
  high: { fill: high.primary.fill, ink: high.primary.ink },
} as const;

export function themeCss(): string {
  return `:root{${vars(light, ACTION.light)}color-scheme:light;}` + `[data-contrast="high"]{${vars(high, ACTION.high)}--outline-width:2px;}`;
}
