import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import type { TextStyle } from 'react-native';

/**
 * İki yazı tipi:
 * - Nunito (yuvarlak): ekran, eser ve tur başlıkları, kart adı, düğme ve etiketler.
 * - Atkinson Hyperlegible Next (Braille Institute): az gören okurlar için tasarlandı; okuma metni, yardımcı bilgi
 *   ve yön talimatları (`display`). Yön talimatına yuvarlak başlık yazısı taşınmaz.
 */
export const fontAssets = {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
};

export const font = {
  body: 'AtkinsonHyperlegibleNext_400Regular',
  bodySemi: 'AtkinsonHyperlegibleNext_600SemiBold',
  bodyBold: 'AtkinsonHyperlegibleNext_700Bold',
  round: 'Nunito_700Bold',
  roundHeavy: 'Nunito_800ExtraBold',
} as const;

/** Tipografi ölçeği. Okuma metni 17/26'nın altına inmez. */
export const type = {
  /** Ana sayfadaki şehir adı. */
  hero: { fontFamily: font.roundHeavy, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  /** Sekme ekranı başlığı (Turlar, Profil…). */
  screenTitle: { fontFamily: font.roundHeavy, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  /** Eser ve tur sayfasındaki büyük ad. */
  editorial: { fontFamily: font.roundHeavy, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  /** Yön talimatı: Atkinson, büyük ve kalın (okunabilirlik önce). */
  display: { fontFamily: font.bodyBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.3 },
  title: { fontFamily: font.roundHeavy, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: font.roundHeavy, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  itemTitle: { fontFamily: font.round, fontSize: 17, lineHeight: 22 },
  cardTitle: { fontFamily: font.round, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: font.body, fontSize: 17, lineHeight: 26 },
  lead: { fontFamily: font.body, fontSize: 19, lineHeight: 28 },
  meta: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  eyebrow: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 21 },
  button: { fontFamily: font.roundHeavy, fontSize: 17, lineHeight: 22 },
  bubble: { fontFamily: font.round, fontSize: 14, lineHeight: 18 },
  tab: { fontFamily: font.round, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

/** Türkçe kurallarına uygun büyük harf (i→İ, ı→I); üst etiketler için. */
export function upper(text: string, lang: 'tr' | 'en'): string {
  return lang === 'tr' ? text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase() : text.toUpperCase();
}

/** Köşe ölçeği: küçük öğe 10, kontrol ve düğme 16, kart 22, büyük kart ve panel 28. iOS'ta `borderCurve: 'continuous'` ile çizilir. */
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
