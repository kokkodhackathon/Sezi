import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatIcon, CompassIcon, PersonIcon, RouteIcon } from '@/design/icons';
import { sweetShadow } from '@/design/sweet/components';
import { duration, ease } from '@/design/sweet/motion';
import { radius, space, type } from '@/design/type';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

type TabIcon = (props: { color: string; filled: boolean }) => ReactNode;

/** Çubuğun kendi yüksekliği: 56 dp sekme + 2 × 6 dp iç pay. */
const BAR_HEIGHT = 68;

/** Klavye açık mı (açıkken sekme çubuğu gizlenir). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * Sekme ekranlarının alt boşluğu: çubuk içeriğin üstünde yüzdüğü için kaydırılan içerik ve alttaki
 * yazı alanı çubuğun arkasında kalmamalı. Klavye açıkken çubuk gizli olduğundan boşluk küçülür.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();
  return keyboard ? space.md : BAR_HEIGHT + Math.max(insets.bottom, space.md) + space.lg;
}

/**
 * Yüzen sekme çubuğu: ekran kenarlarından ayrık beyaz yüzey (22 köşe, ince çizgi, hafif gölge).
 * Seçili sekmede simge firuze göstergede dolu çizilir, yazı kalınlaşır (renkten bağımsız da ayrılır).
 * Dört sekmenin yazısı her zaman görünür. Klavye açıkken çubuk gizlenir (Sor ekranındaki yazı alanını örtmesin).
 */
export default function AppTabs() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();

  return (
    // Tetikleyiciler TabList'in (asChild ile tek katman altındaki View'in) doğrudan çocuğu olmalı.
    // Çubuk içeriğin üstünde yüzer: çevresi saydam, kaydırılan içerik arkasından geçer.
    <Tabs style={{ flex: 1 }}>
      <TabSlot />
      <TabList asChild>
        <View
          accessibilityRole="tablist"
          // expo-router Slot dizi stil kabul etmiyor.
          style={StyleSheet.flatten([
            s.bar,
            { backgroundColor: t.nav.background, borderColor: t.border, bottom: Math.max(insets.bottom, space.md) },
            sweetShadow(t),
            keyboard && { display: 'none' },
          ])}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton label={tr('tabs.explore')} icon={({ color, filled }) => <CompassIcon color={color} filled={filled} />} />
        </TabTrigger>
        <TabTrigger name="tours" href="/tours" asChild>
          <TabButton label={tr('tabs.tours')} icon={({ color, filled }) => <RouteIcon color={color} filled={filled} />} />
        </TabTrigger>
        <TabTrigger name="ask" href="/ask" asChild>
          <TabButton label={tr('tabs.ask')} icon={({ color, filled }) => <ChatIcon color={color} filled={filled} />} />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <TabButton label={tr('tabs.profile')} icon={({ color, filled }) => <PersonIcon color={color} filled={filled} />} />
        </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

/** Gösterge 150 ms'de açılır; dolu simge ve kalın etiket anlık değişir. */
function TabButton({ isFocused = false, label, icon, ...props }: TabTriggerSlotProps & { label: string; icon: TabIcon }) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const on = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(isFocused ? 1 : 0, { duration: reduced ? 0 : duration.fade, easing: ease.out }));
  }, [isFocused, reduced, on]);
  const pill = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scaleX: reduced ? 1 : 0.6 + on.get() * 0.4 }] }));
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: isFocused }} style={s.tab}>
      <View style={s.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, s.pill, { backgroundColor: t.nav.activeBackground }, pill]} />
        {icon({ color: isFocused ? t.nav.activeForeground : t.nav.foreground, filled: isFocused })}
      </View>
      <Text
        style={[type.tab, isFocused && { fontFamily: type.button.fontFamily }, { color: isFocused ? t.nav.activeLabel : t.nav.foreground }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  iconWrap: { width: 60, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.sm, borderCurve: 'continuous' },
});
