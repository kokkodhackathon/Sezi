import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useT } from '@/lib/i18n';

const FRAMES = {
  lahmacun: require('../../assets/loading/lahmacun.webp'),
  cay: require('../../assets/loading/cay.webp'),
  nazar: require('../../assets/loading/nazar.webp'),
  kahve: require('../../assets/loading/kahve.webp'),
} as const;

const NAMES = ['lahmacun', 'cay', 'nazar', 'kahve'] as const;
type FrameName = (typeof NAMES)[number];

function pickFrame(): FrameName {
  const index = Math.floor(Math.random() * NAMES.length);
  return NAMES[index] ?? 'lahmacun';
}

/** Dönen illüstrasyon. `size` 24 satır içi, 48 sayfa yüklemesi. */
export function SeziLoader({ size = 48, label }: { size?: number; label?: string }) {
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const [name] = useState(pickFrame);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      rotation.set(0);
      opacity.set(withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
      return;
    }
    opacity.set(1);
    rotation.set(withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false));
  }, [reduced, rotation, opacity]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const text = label ?? tr('common.loading');

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={text} style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, animated]}>
        <Image source={FRAMES[name]} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
      </Animated.View>
    </View>
  );
}
