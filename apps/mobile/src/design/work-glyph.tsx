import { toneForType } from '@sezi/shared';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useSweetTheme } from '@/hooks/use-sweet-theme';

/**
 * Eser türü glifleri. Renk tek başına anlam taşımaz: her türün kendi silueti var.
 * Renkler tür tonundan gelir (`toneForType`): dolgu üstünde mürekkep glif (AA ≥ 4.5).
 */

function Shape({ slug, fill }: { slug: string; fill: string }) {
  switch (slug) {
    case 'cami':
      return (
        <G fill={fill}>
          <Path d="M5 20 V14 A7 7 0 0 1 19 14 V20 Z" />
          <Rect x="11.3" y="4" width="1.4" height="3" />
          <Rect x="20" y="5" width="1.8" height="15" />
          <Path d="M20 5 L20.9 2.5 L21.8 5 Z" />
          <Rect x="3" y="20" width="20" height="1.6" />
        </G>
      );
    case 'medrese':
      return (
        <G fill={fill}>
          <Path d="M3 20 V11 A3 3 0 0 1 9 11 V20 H7.6 V11.6 A1.6 1.6 0 0 0 4.4 11.6 V20 Z" />
          <Path d="M9 20 V11 A3 3 0 0 1 15 11 V20 H13.6 V11.6 A1.6 1.6 0 0 0 10.4 11.6 V20 Z" />
          <Path d="M15 20 V11 A3 3 0 0 1 21 11 V20 H19.6 V11.6 A1.6 1.6 0 0 0 16.4 11.6 V20 Z" />
          <Rect x="2" y="20" width="20" height="1.6" />
          <Rect x="2" y="6.5" width="20" height="1.4" />
        </G>
      );
    case 'turbe':
      return (
        <G fill={fill}>
          <Path d="M12 2.5 L17 10 H7 Z" />
          <Path d="M6.5 11 H17.5 L19 13 V20 H5 V13 Z" />
          <Rect x="3.5" y="20" width="17" height="1.6" />
        </G>
      );
    case 'cesme':
      return (
        <G fill={fill}>
          <Path d="M4 21 V9 A8 6 0 0 1 20 9 V21 H17.5 V9.8 A5.5 4 0 0 0 6.5 9.8 V21 Z" />
          <Path d="M12 11 C12 11 9.5 14.2 9.5 15.8 A2.5 2.5 0 0 0 14.5 15.8 C14.5 14.2 12 11 12 11 Z" />
        </G>
      );
    case 'sebil':
      return (
        <G fill={fill}>
          <Path d="M3.5 21 V10 A8.5 7 0 0 1 20.5 10 V21 Z M6 19 H18 V10.6 A6 4.8 0 0 0 6 10.6 Z" fillRule="evenodd" />
          <Rect x="8.4" y="9" width="1.3" height="10" />
          <Rect x="11.35" y="7.8" width="1.3" height="11.2" />
          <Rect x="14.3" y="9" width="1.3" height="10" />
        </G>
      );
    case 'hamam':
      return (
        <G fill={fill}>
          <Path d="M3 19 V15 A4.5 4.5 0 0 1 12 15 V19 Z M12 19 V15 A4.5 4.5 0 0 1 21 15 V19 Z" />
          <Path d="M7 10.5 A5 5 0 0 1 17 10.5 Z" />
          <Rect x="2" y="19" width="20" height="2" />
        </G>
      );
    case 'imaret':
      return (
        <G fill={fill}>
          <Path d="M4 11 H20 V12.5 A8 7 0 0 1 4 12.5 Z" />
          <Rect x="2.5" y="10" width="19" height="1.6" />
          <Path d="M8.5 3 C7.5 4.5 9.5 5.5 8.5 8 M12 3 C11 4.5 13 5.5 12 8 M15.5 3 C14.5 4.5 16.5 5.5 15.5 8" stroke={fill} strokeWidth={1.3} fill="none" strokeLinecap="round" />
          <Rect x="9" y="19" width="6" height="2" />
        </G>
      );
    case 'kutuphane':
      return (
        <G fill={fill}>
          <Path d="M2.5 6 C6 4.6 9 4.8 11.3 6.4 V19.5 C9 18 6 17.8 2.5 19.2 Z" />
          <Path d="M21.5 6 C18 4.6 15 4.8 12.7 6.4 V19.5 C15 18 18 17.8 21.5 19.2 Z" />
        </G>
      );
    default:
      return (
        <G fill={fill}>
          <Rect x="6" y="6" width="12" height="12" />
          <Rect x="6" y="6" width="12" height="12" rotation={45} origin="12,12" />
          <Circle cx="12" cy="12" r="2.4" fill="#00000055" />
        </G>
      );
  }
}

/** Tür tonunda karo üstünde glif. Dekoratiftir; erişilebilir ad yanındaki metinden gelir. */
export function WorkGlyph({ slug, size = 48 }: { slug: string; size?: number }) {
  const t = useSweetTheme();
  const tone = t.tones[toneForType(slug)];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          borderCurve: 'continuous',
          backgroundColor: tone.fill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        t.outlined && { borderWidth: 2, borderColor: t.border },
      ]}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <Shape slug={slug} fill={tone.ink} />
      </Svg>
    </View>
  );
}

/** Karo olmadan, tek renkli glif (çipler ve satır içi kullanım). */
export function WorkGlyphInline({ slug, color, size = 18 }: { slug: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Shape slug={slug} fill={color} />
    </Svg>
  );
}
