import Svg, { G, Path, Rect } from 'react-native-svg';

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

