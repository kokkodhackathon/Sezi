import { glyphFor, toneForType } from '@sezi/shared';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useSweetTheme } from '@/hooks/use-sweet-theme';

/**
 * Eser türü glifleri (çizim verisi `shared/glyphs.ts`; web haritası da aynısını kullanır).
 * Renk tek başına anlam taşımaz: her türün kendi silueti var.
 * Renkler tür tonundan gelir (`toneForType`): dolgu üstünde mürekkep glif (AA ≥ 4.5).
 */
function Shape({ slug, fill }: { slug: string; fill: string }) {
  return (
    <G fill={fill}>
      {glyphFor(slug).map((p, i) => {
        if (p.kind === 'path') {
          return p.stroke ? (
            <Path key={i} d={p.d} stroke={fill} strokeWidth={p.stroke} fill="none" strokeLinecap="round" />
          ) : (
            <Path key={i} d={p.d} fillRule={p.evenOdd ? 'evenodd' : undefined} />
          );
        }
        if (p.kind === 'rect') {
          return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rotation={p.rotate} origin={`${p.x + p.w / 2},${p.y + p.h / 2}`} />;
        }
        return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.shade ? '#000000' : fill} fillOpacity={p.shade ? 0.33 : 1} />;
      })}
    </G>
  );
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
