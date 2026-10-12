import { useId } from 'react';
import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';

/**
 * Kilim şeridi: basamaklı baklava (kademeli kenar) ve üst/alt testere dişi.
 * Süs değil iz: başlık altlarında ve bölüm aralarında düşük yoğunlukta kullanılır.
 */
export function KilimBand({
  color,
  accent,
  height = 14,
  opacity = 1,
}: {
  color: string;
  accent?: string;
  height?: number;
  opacity?: number;
}) {
  const id = useId().replace(/:/g, '');
  const unit = 28;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${unit * 20} 14`} preserveAspectRatio="xMinYMid slice" opacity={opacity} accessible={false}>
      <Defs>
        <Pattern id={`k${id}`} x="0" y="0" width={unit} height="14" patternUnits="userSpaceOnUse">
          {/* testere dişi üst ve alt */}
          <Path d="M0 0 L3.5 2.5 L7 0 L10.5 2.5 L14 0 L17.5 2.5 L21 0 L24.5 2.5 L28 0 Z" fill={accent ?? color} />
          <Path d="M0 14 L3.5 11.5 L7 14 L10.5 11.5 L14 14 L17.5 11.5 L21 14 L24.5 11.5 L28 14 Z" fill={accent ?? color} />
          {/* basamaklı baklava */}
          <Path d="M12 4 h4 v1.5 h2 v1.5 h2 v2 h-2 v1.5 h-2 v1.5 h-4 v-1.5 h-2 v-1.5 h-2 v-2 h2 v-1.5 h2 Z" fill={color} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={unit * 20} height="14" fill={`url(#k${id})`} />
    </Svg>
  );
}

/** Bölüm başlığı önündeki küçük çengel işareti. */
export function CengelMark({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" accessible={false}>
      <G fill={color}>
        <Path d="M2 2 h6 v2 h-4 v4 h-2 Z" />
        <Path d="M12 12 h-6 v-2 h4 v-4 h2 Z" />
        <Rect x="6" y="6" width="2" height="2" />
      </G>
    </Svg>
  );
}

/** Onboarding karşılama madalyonu: iç içe basamaklı baklavalar ve nazar merkezi. */
export function Medallion({ primary, accent, ink, size = 168 }: { primary: string; accent: string; ink: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessible={false}>
      <Path
        d="M60 4 h8 v8 h8 v8 h8 v8 h8 v8 h8 v8 h8 v16 h-8 v8 h-8 v8 h-8 v8 h-8 v8 h-8 v8 h-16 v-8 h-8 v-8 h-8 v-8 h-8 v-8 h-8 v-8 h-8 v-16 h8 v-8 h8 v-8 h8 v-8 h8 v-8 h8 v-8 Z"
        fill={primary}
      />
      <Path
        d="M60 24 h4 v8 h8 v8 h8 v8 h8 v24 h-8 v8 h-8 v8 h-8 v8 h-8 v-8 h-8 v-8 h-8 v-8 h-8 v-24 h8 v-8 h8 v-8 h8 v-8 Z"
        fill={accent}
      />
      <Path d="M60 44 h8 v8 h8 v16 h-8 v8 h-16 v-8 h-8 v-16 h8 v-8 Z" fill={ink} />
      <Rect x="54" y="54" width="12" height="12" fill={primary} />
      {/* köşe çengelleri */}
      <G fill={accent}>
        <Path d="M4 4 h14 v4 h-10 v10 h-4 Z" />
        <Path d="M116 4 v14 h-4 v-10 h-10 v-4 Z" />
        <Path d="M4 116 v-14 h4 v10 h10 v4 Z" />
        <Path d="M116 116 h-14 v-4 h10 v-10 h4 Z" />
      </G>
    </Svg>
  );
}
