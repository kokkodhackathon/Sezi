import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SeziLoader } from '@/components/sezi-loader';
import { duration, ease } from '@/design/sweet/motion';
import { space } from '@/design/type';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useT } from '@/lib/i18n';

const LOADER = 40;
/** Android'de saydam dairenin zemini ve gölgesi kalabiliyor; göstergeyi ekranın üstüne iter. */
const SPINNER_OFFSET = Platform.OS === 'android' ? -1000 : 0;

/**
 * Aşağı çekerek yenileme: sistem hareketi durur, illüstrasyon üstte görünür.
 * Çekme miktarına göre büyüme Android'de güvenilir olmadığı için yok.
 */
export function useSeziRefresh(refetch: () => void | Promise<unknown>) {
  const { t: tr } = useT();
  const [refreshing, setRefreshing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const onRefresh = useCallback(() => {
    setFrameKey((key) => key + 1);
    setRefreshing(true);
    AccessibilityInfo.announceForAccessibility(tr('common.loading'));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void Promise.resolve(refetch()).finally(() => setRefreshing(false));
  }, [refetch, tr]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={['transparent']}
      tintColor="transparent"
      progressBackgroundColor="transparent"
      progressViewOffset={SPINNER_OFFSET}
    />
  );

  const overlay = <SeziRefreshOverlay refreshing={refreshing} frameKey={frameKey} />;

  return { refreshControl, overlay };
}

/** Listenin üstünde, yenileme bitince solan illüstrasyon. Her başlangıçta yeni kare. */
function SeziRefreshOverlay({ refreshing, frameKey }: { refreshing: boolean; frameKey: number }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const [heldKey, setHeldKey] = useState(frameKey);
  const [held, setHeld] = useState(false);

  if (refreshing && heldKey !== frameKey) setHeldKey(frameKey);
  if (refreshing && !held) setHeld(true);
  if (!refreshing && reduced && held) setHeld(false);

  useEffect(() => {
    if (refreshing) {
      opacity.set(reduced ? 1 : withTiming(1, { duration: duration.fade, easing: ease.out }));
      return () => cancelAnimation(opacity);
    }
    if (reduced) {
      opacity.set(0);
      return;
    }
    opacity.set(withTiming(0, { duration: duration.fade, easing: ease.out }, (finished) => {
      if (finished) scheduleOnRN(setHeld, false);
    }));
    return () => cancelAnimation(opacity);
  }, [refreshing, reduced, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!held) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={animated}>
        <SeziLoader key={heldKey} size={LOADER} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: space.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
});
