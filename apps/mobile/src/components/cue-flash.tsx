import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

/**
 * İşitme engelli kullanıcı için sesin görsel karşılığı: her yeni talimatta ekran kenarı
 * belirgin bir renkle iki kez parlar. "Hareketi azalt" açıksa yanıp sönme yerine
 * çerçeve 1,5 saniye sabit kalır.
 */
export function CueFlash({ count, color, enabled }: { count: number; color: string; enabled: boolean }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || count === 0) return;
    opacity.stopAnimation();
    const anim = reduceMotion
      ? Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.delay(1500),
          Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      : Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.15, duration: 220, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]);
    anim.start();
    return () => anim.stop();
  }, [count, enabled, reduceMotion, opacity]);

  if (!enabled) return null;
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, { borderWidth: 14, borderColor: color, opacity }]}
    />
  );
}
