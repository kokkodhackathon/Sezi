/**
 * "Çini 2" deneme teması: sıcak kırık beyaz zemin, mürekkep siyahı metin; ana renk pastel firuze
 * (Bursa Yeşil Türbe çinileri, pilot alanın rengi). Firuze dolgu koyu firuze yazıyla okunur, beyaz yazıyla değil.
 * Altı yumuşak ton (kobalt, firuze, mercan, safran, adaçayı, erik) tür ve vurgu için kullanılır;
 * her ton bir açık dolgu ve üstünde okunacak koyu "mürekkep" çiftidir (AA ≥ 4.5, testle korunur).
 * Şimdilik yalnız ana sayfa ve sekme çubuğu kullanır; diğer ekranlar `theme.ts` ile kalır.
 */

export type SweetToneName = "cobalt" | "teal" | "coral" | "saffron" | "sage" | "plum";

/** Dolgu + üstündeki metin/ikon rengi (AA ≥ 4.5). */
export interface SweetTone {
  fill: string;
  ink: string;
}

/** Sekme çubuğu: ekrandan ayrık, yüzen açık yüzey; seçili sekmede simgenin arkasında firuze gösterge. */
export interface SweetNav {
  background: string;
  /** Seçili olmayan simge ve yazı. */
  foreground: string;
  /** Seçili sekme yazısı (çubuk zemini üstünde). */
  activeLabel: string;
  /** Seçili simgenin arkasındaki kapsül ve üstündeki simge. */
  activeBackground: string;
  activeForeground: string;
}

export interface SweetTheme {
  background: string;
  surface: string;
  /** Dolgulu alanlar: arama kutusu, ikon düğmesi, iskelet, liste seçeneği. */
  soft: string;
  text: string;
  textMuted: string;
  border: string;
  shadow: string;
  danger: string;
  /** Yüksek kontrast: dolgu yok, her yüzey 2 dp çerçeveyle ayrılır. */
  outlined: boolean;
  /** Ana eylem: pastel firuze dolgu, koyu firuze yazı. `primary.ink` yalnız `primary.fill` üstünde okunur. */
  primary: SweetTone;
  /** Ana renk zemin ya da yüzey üstünde ön plan (ghost düğme, bağlantı) ve seçili kutucuğun dolgusu (üstünde `background`). */
  primaryText: string;
  /** Vurgu: UNESCO rozeti, uyarı dolgusu (açık/koyu temada `tones.coral` ile aynı nesne). */
  accent: SweetTone;
  /** Vurgu rengi zemin ya da yüzey üstünde ön plan (uyarı yazısı, hedef işareti). */
  accentText: string;
  tones: Record<SweetToneName, SweetTone>;
  nav: SweetNav;
}

const lightTones: Record<SweetToneName, SweetTone> = {
  cobalt: { fill: "#E4E8FC", ink: "#2A3C9C" },
  teal: { fill: "#DBF0EB", ink: "#1C5D55" },
  coral: { fill: "#FDE3DA", ink: "#9A361D" },
  saffron: { fill: "#FAEDCB", ink: "#6E520A" },
  sage: { fill: "#E4EDDC", ink: "#3B5728" },
  plum: { fill: "#F2E1EE", ink: "#7A3266" },
};

const darkTones: Record<SweetToneName, SweetTone> = {
  cobalt: { fill: "#232A4A", ink: "#C9D2FF" },
  teal: { fill: "#183632", ink: "#A9E6DA" },
  coral: { fill: "#3D241C", ink: "#FFC6B3" },
  saffron: { fill: "#3A3018", ink: "#F6DD9A" },
  sage: { fill: "#252F1F", ink: "#C9E0B5" },
  plum: { fill: "#36202F", ink: "#F1C2E4" },
};

const plain: SweetTone = { fill: "#FFFFFF", ink: "#000000" };

export const sweetThemes: Record<"light" | "dark" | "highContrast", SweetTheme> = {
  light: {
    background: "#F6F4F0",
    surface: "#FFFFFF",
    soft: "#ECE8E1",
    text: "#16151A",
    textMuted: "#5E5A64",
    border: "#E2DED6",
    shadow: "#16151A",
    danger: "#B3261E",
    outlined: false,
    primary: { fill: "#A8E0D6", ink: "#0F4A44" },
    primaryText: "#0F4A44",
    accent: lightTones.coral,
    accentText: "#9A361D",
    tones: lightTones,
    nav: { background: "#FFFFFF", foreground: "#5E5A64", activeLabel: "#16151A", activeBackground: "#A8E0D6", activeForeground: "#0F4A44" },
  },
  dark: {
    background: "#111014",
    surface: "#1C1B20",
    soft: "#26252B",
    text: "#F3F1F5",
    textMuted: "#ABA7B3",
    border: "#2E2D34",
    shadow: "#000000",
    danger: "#FFB4AB",
    outlined: false,
    primary: { fill: "#7FCFC3", ink: "#06302B" },
    primaryText: "#8FD8CC",
    accent: darkTones.coral,
    accentText: "#FFC6B3",
    tones: darkTones,
    nav: { background: "#1C1B20", foreground: "#ABA7B3", activeLabel: "#F3F1F5", activeBackground: "#7FCFC3", activeForeground: "#06302B" },
  },
  highContrast: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    soft: "#FFFFFF",
    text: "#000000",
    textMuted: "#1E1A17",
    border: "#000000",
    shadow: "#000000",
    danger: "#8E1F1A",
    outlined: true,
    primary: { fill: "#064C50", ink: "#FFFFFF" },
    primaryText: "#064C50",
    accent: { fill: "#8E1F1A", ink: "#FFFFFF" },
    accentText: "#8E1F1A",
    tones: { cobalt: plain, teal: plain, coral: plain, saffron: plain, sage: plain, plum: plain },
    nav: { background: "#FFFFFF", foreground: "#000000", activeLabel: "#000000", activeBackground: "#000000", activeForeground: "#FFFFFF" },
  },
};

const byType: Record<string, SweetToneName> = {
  // Firuze ana renkle karışmasın diye camiler kobalt; çeşme ve sebil firuze.
  cami: "cobalt",
  medrese: "saffron",
  kutuphane: "saffron",
  turbe: "plum",
  cesme: "teal",
  sebil: "teal",
  hamam: "coral",
  imaret: "coral",
};

/** Eser türünün tonu. Renk tek başına anlam taşımaz; glif siluet farkını verir. */
export function toneForType(slug: string): SweetToneName {
  return byType[slug] ?? "sage";
}
