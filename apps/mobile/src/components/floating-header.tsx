import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon } from '@/design/icons';
import { SoftPressable, sweetShadow } from '@/design/sweet/components';
import { duration, ease } from '@/design/sweet/motion';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

/** Kaydırma React durumuna geçmez; kapak yüksekliği onLayout ile güncellenir. */
export function useFloatingHeaderScroll() {
  const scrollY = useSharedValue(0);
  const coverHeight = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.set(event.contentOffset.y); });
  return { scrollY, coverHeight, onScroll };
}

export interface FloatingHeaderProps {
  title: string;
  scrollY: SharedValue<number>;
  coverHeight: SharedValue<number>;
  onBack?: () => void;
  /** Kapak koyu fotoğrafsa durum çubuğu kapak geçilene kadar açık renkli kalır. */
  lightOnCover?: boolean;
}

export function FloatingHeader({ title, scrollY, coverHeight, onBack = () => router.back(), lightOnCover = false }: FloatingHeaderProps) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const [pastCover, setPastCover] = useState(false);
  useAnimatedReaction(
    () => coverHeight.get() > 0 && scrollY.get() >= coverHeight.get(),
    (visible, previous) => {
      if (visible === previous) return;
      opacity.set(withTiming(visible ? 1 : 0, { duration: duration.fade, easing: ease.out }));
      // Yalnız eşik geçişinde React'e döner (kare başına değil).
      scheduleOnRN(setPastCover, visible);
    },
  );
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {lightOnCover ? <StatusBar style={pastCover ? 'auto' : 'light'} /> : null}
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.bar, { minHeight: insets.top + 64, paddingTop: insets.top + space.sm, backgroundColor: t.surface, borderBottomColor: t.border, borderBottomWidth: t.outlined ? 2 : StyleSheet.hairlineWidth }, animated]}>
        <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={1}>{title}</Text>
      </Animated.View>
      <SoftPressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tr('work.back')} style={[s.back, { top: insets.top + space.sm, backgroundColor: t.surface }, sweetShadow(t)]}>
        <View style={{ transform: [{ rotate: '180deg' }] }}><ChevronIcon color={t.text} size={22} /></View>
      </SoftPressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, top: 0, minHeight: 64, paddingLeft: 80, paddingRight: space.xl, paddingBottom: space.lg, justifyContent: 'center' },
  back: { position: 'absolute', left: space.lg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
