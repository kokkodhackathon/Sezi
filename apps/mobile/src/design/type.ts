import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import type { TextStyle } from 'react-native';

/**
 * İki yazı tipi:
 * - Atkinson Hyperlegible Next (Braille Institute): az gören okurlar için tasarlandı; tüm arayüz ve okuma metni.
 * - Fraunces: yalnızca başlıklar; miras sıcaklığını taşır, gövde metninde kullanılmaz.
 */
export const fontAssets = {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
};

export const font = {
  body: 'AtkinsonHyperlegibleNext_400Regular',
  bodySemi: 'AtkinsonHyperlegibleNext_600SemiBold',
  bodyBold: 'AtkinsonHyperlegibleNext_700Bold',
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
} as const;

/** Tipografi ölçeği. Okuma metni 17/26'nın altına inmez. */
export const type = {
  hero: { fontFamily: font.displayBold, fontSize: 44, lineHeight: 50, letterSpacing: -0.5 },
  display: { fontFamily: font.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.3 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 26 },
  itemTitle: { fontFamily: font.bodySemi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: font.body, fontSize: 17, lineHeight: 26 },
  lead: { fontFamily: font.body, fontSize: 19, lineHeight: 28 },
  meta: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  button: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 22 },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.4 },
} satisfies Record<string, TextStyle>;

/** Türkçe kurallarına uygun büyük harf (i→İ, ı→I); üst etiketler için. */
export function upper(text: string, lang: 'tr' | 'en'): string {
  return lang === 'tr' ? text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase() : text.toUpperCase();
}

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
