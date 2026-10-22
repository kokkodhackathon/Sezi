import { loc, type CityRow, type WorkRow } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { outline, SoftPressable } from '@/design/sweet/components';
import { duration, ease } from '@/design/sweet/motion';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

// Web buildTurkeyMap: dotted-map 3.1, TUR, height 36, diagonal. Aynı noktalar satır aralıklarıyla saklanır.
const DOT_ROWS: [number, [number, number][]][] = [[0.87,[[3,8],[33,40]]],[1.73,[[1.5,8.5],[30.5,41.5]]],[2.6,[[2,9],[28,44]]],[3.46,[[2.5,9.5],[26.5,45.5],[71.5,73.5]]],[4.33,[[3,11],[26,47],[68,74]]],[5.2,[[2.5,12.5],[24.5,48.5],[66.5,75.5]]],[6.06,[[2,12],[14,20],[23,51],[65,77]]],[6.93,[[1.5,6.5],[14.5,53.5],[55.5,77.5]]],[7.79,[[1,5],[14,78]]],[8.66,[[0.5,4.5],[13.5,77.5]]],[9.53,[[1,3],[13,78]]],[10.39,[[1.5,2.5],[5.5,77.5]]],[11.26,[[5,78]]],[12.12,[[4.5,79.5]]],[12.99,[[3,81]]],[13.86,[[2.5,82.5]]],[14.72,[[2,82]]],[15.59,[[1.5,79.5]]],[16.45,[[2,80]]],[17.32,[[2.5,79.5]]],[18.19,[[4,80]]],[19.05,[[3.5,80.5]]],[19.92,[[3,80]]],[20.78,[[2.5,80.5]]],[21.65,[[2,81]]],[22.52,[[1.5,80.5]]],[23.38,[[2,80]]],[24.25,[[3.5,80.5]]],[25.11,[[4,81]]],[25.98,[[4.5,80.5]]],[26.85,[[5,81]]],[27.71,[[5.5,72.5],[76.5,81.5]]],[28.58,[[6,70],[80,82]]],[29.44,[[6.5,63.5]]],[30.31,[[7,52],[55,61]]],[31.18,[[7.5,37.5],[40.5,46.5],[48.5,49.5]]],[32.04,[[13,19],[26,37],[45,47]]],[32.91,[[14.5,19.5],[27.5,35.5],[44.5,46.5]]],[33.77,[[16,18],[28,35],[44,46]]],[34.64,[[44.5,45.5]]],[35.51,[[45,45]]]];
const DOT_PATH = DOT_ROWS.flatMap(([y, runs]) => runs.flatMap(([start, end]) => Array.from({ length: end - start + 1 }, (_, i) => `M${start + i} ${y}h0`))).join('');
const MAP = { width: 83, height: 36, xMin: 2899132.5718704923, yMax: 5153519.409657707, xRange: 2087311.5855284962, yRange: 902435.3142626556, yStep: 0.8660254037844386 };

/** dotted-map getPin ile aynı WGS84 elipsoidal Mercator ve nokta ızgarasına yuvarlama. */
function project(lng: number, lat: number) {
  const radians = lat * Math.PI / 180;
  const eccentricity = 0.08181919084262149;
  const sin = Math.sin(radians);
  const projectedX = 6378137 * lng * Math.PI / 180;
  const projectedY = 6378137 * Math.log(Math.tan(Math.PI / 4 + radians / 2) * Math.pow((1 - eccentricity * sin) / (1 + eccentricity * sin), eccentricity / 2));
  const rawX = MAP.width * (projectedX - MAP.xMin) / MAP.xRange;
  const row = Math.round(MAP.height * (MAP.yMax - projectedY) / MAP.yRange / MAP.yStep);
  const offset = row % 2 === 0 ? 0.5 : 0;
  return { x: (Math.round(rawX - offset) + offset) / MAP.width * 100, y: row * MAP.yStep / MAP.height * 100 };
}

export interface CityMapProps { cities: CityRow[]; works: WorkRow[]; value: string; onChange: (slug: string) => void }

/** İl yeri sabit değildir: web gibi o ilin konumlu eserlerinin ortalamasıdır. Liste her zaman altında kalır. */
export function CityMap({ cities, works, value, onChange }: CityMapProps) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const pins = useMemo(() => {
    const sums = new Map<string, { lat: number; lng: number; n: number }>();
    for (const work of works) {
      if (work.lat === null || work.lng === null) continue;
      const sum = sums.get(work.city_slug) ?? { lat: 0, lng: 0, n: 0 };
      sum.lat += work.lat; sum.lng += work.lng; sum.n++;
      sums.set(work.city_slug, sum);
    }
    return cities.flatMap((city) => {
      const sum = sums.get(city.slug);
      return sum ? [{ city, ...project(sum.lng / sum.n, sum.lat / sum.n) }] : [];
    });
  }, [cities, works]);
  const selected = cities.find((city) => city.slug === value);
  return (
    <View style={{ gap: space.md }}>
      <View style={s.map} accessibilityLabel={tr('cityMap.label')}>
        <Svg width="100%" height="100%" viewBox="0 0 83 36" accessible={false}>
          <Path d={DOT_PATH} stroke={t.outlined ? t.text : t.primaryText} strokeOpacity={t.outlined ? 0.5 : 0.3} strokeWidth={0.55} strokeLinecap="round" fill="none" />
        </Svg>
        {pins.map(({ city, x, y }) => <CityPin key={city.slug} title={loc(city.name, lang)} selected={city.slug === value} x={x} y={y} onPress={() => { void Haptics.selectionAsync(); onChange(city.slug); }} />)}
      </View>
      {selected ? <Text accessibilityLiveRegion="polite" style={[type.meta, { color: t.text }]}>{tr('cityMap.selected', { name: loc(selected.name, lang) })}</Text> : null}
    </View>
  );
}

function CityPin({ title, selected, x, y, onPress }: { title: string; selected: boolean; x: number; y: number; onPress: () => void }) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => { scale.set(reduced ? 1 : withTiming(selected ? 1.2 : 1, { duration: duration.fade, easing: ease.out })); }, [selected, reduced, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const flip = x > 70;
  return (
    <SoftPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} hitSlop={4}
      style={[s.pin, { top: `${y}%` }, flip ? { right: `${100 - x}%`, marginRight: -24, flexDirection: 'row-reverse' } : { left: `${x}%`, marginLeft: -24 }]}>
      <View style={s.target}><Animated.View style={[s.dot, { backgroundColor: selected ? t.primaryText : t.surface, borderColor: t.primaryText }, animated]} /></View>
      <View style={[s.label, { backgroundColor: selected ? t.primary.fill : t.surface }, outline(t)]}>
        <Text style={[type.bubble, { color: selected ? t.primary.ink : t.text }]}>{selected ? `✓ ${title}` : title}</Text>
      </View>
    </SoftPressable>
  );
}

const s = StyleSheet.create({
  map: { width: '100%', aspectRatio: 83 / 36, marginVertical: space.xl },
  // Dikey ortalama marginTop ile: SoftPressable kendi transform'unu (basma ölçeği) yazar, translateY ezilirdi.
  pin: { position: 'absolute', minHeight: 48, marginTop: -24, flexDirection: 'row', alignItems: 'center' },
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  label: { marginLeft: -space.sm, paddingHorizontal: space.xs, paddingVertical: space.xs, borderRadius: radius.sm },
});
