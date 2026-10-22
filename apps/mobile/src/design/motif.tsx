import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { View } from 'react-native';
import { duration, ease, stagger } from '@/design/sweet/motion';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
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

/** Çengel parçaları bir kez sırayla belirir; hareket azaltmada tek saydamlık geçişi. */
export function EmptyMotif({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  // Tek seferlik giriş: temizlikte cancelAnimation yok (efekt yeniden çalışırsa iptal yeni animasyonu durdurabiliyor).
  useEffect(() => {
    opacity.set(withTiming(1, { duration: duration.fade, easing: ease.out }));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={style} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={{ width: 64, height: 64 }}>
        {[0, 1, 2, 3].map((index) => <MotifPiece key={index} index={index} color={color} reduced={reduced} />)}
      </View>
    </Animated.View>
  );
}

function MotifPiece({ index, color, reduced }: { index: number; color: string; reduced: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(reduced ? 1 : withDelay(index * stagger.step, withTiming(1, { duration: duration.enter + duration.fade, easing: ease.out })));
  }, [index, reduced, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[{ position: 'absolute', inset: 0, transform: [{ rotate: `${index * 90}deg` }] }, style]}>
      <Svg width={64} height={64} viewBox="0 0 64 64" accessible={false}>
        <Path d="M10 10 H30 V17 H17 V30 H10 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

