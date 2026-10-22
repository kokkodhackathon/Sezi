import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { SoftPressable, sweetShadow } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

/** Haritayla aynı ekranda kalan iki duraklı panel; kaydırma yalnız tutamaçtan başlar. */
export function NavSheet({ phase, popup, children }: { phase: 'plan' | 'active' | 'arrived'; popup: boolean; children: ReactNode }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  // Uzun durak içeriğe göre: içerik kısaysa panel haritayı boşuna örtmez; en fazla ekranın üstüne kadar.
  const [contentHeight, setContentHeight] = useState(0);
  const [handleHeight, setHandleHeight] = useState(56);
  const maxHeight = Math.max(160, height - insets.top - 76);
  const shortCap = Math.min(maxHeight, Math.max(height * 0.36, 120 + 170 * fontScale + insets.bottom));
  const chrome = handleHeight + space.sm + space.xl + insets.bottom;
  const panelHeight = contentHeight > 0 ? Math.min(maxHeight, Math.max(shortCap, contentHeight + chrome)) : maxHeight;
  const shortHeight = Math.min(panelHeight, shortCap);
  const travel = panelHeight - shortHeight;
  const [expanded, setExpanded] = useState(phase !== 'active');
  const offset = useSharedValue(phase === 'active' ? travel : 0);
  const origin = useSharedValue(0);
  const detent = useSharedValue(phase !== 'active');
  const scrollRef = useRef<ScrollView>(null);

  // Aşama değişince panel o aşamanın varsayılan yüksekliğine döner (state render sırasında eşitlenir).
  const [seenPhase, setSeenPhase] = useState(phase);
  if (seenPhase !== phase) {
    setSeenPhase(phase);
    setExpanded(phase !== 'active');
  }

  useEffect(() => {
    cancelAnimation(offset);
    detent.set(phase !== 'active');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [phase, detent, offset, scrollRef]);

  // Ölçü değişince (içerik, döndürme, yazı boyu) kullanıcının seçtiği durak korunur.
  useEffect(() => {
    offset.set(detent.get() ? 0 : travel);
  }, [phase, travel, detent, offset]);

  const commit = useCallback((open: boolean) => {
    setExpanded(open);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggle = () => {
    const open = !detent.get();
    detent.set(open);
    offset.set(reduced ? (open ? 0 : travel) : withSpring(open ? 0 : travel, { duration: 300, dampingRatio: 0.8, velocity: 0 }));
    commit(open);
  };

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-24, 24])
    .onStart(() => {
      cancelAnimation(offset);
      origin.set(offset.get());
    })
    .onUpdate((event) => {
      if (reduced) return;
      const next = origin.get() + event.translationY;
      const over = next < 0 ? next : next > travel ? next - travel : 0;
      const resistance = (over * panelHeight * 0.55) / (panelHeight + 0.55 * Math.abs(over));
      offset.set(next < 0 ? resistance : next > travel ? travel + resistance : next);
    })
    .onEnd((event) => {
      const position = reduced ? origin.get() + event.translationY : offset.get();
      const open = Math.abs(event.velocityY) > 500 ? event.velocityY < 0 : position < travel / 2;
      detent.set(open);
      offset.set(reduced ? (open ? 0 : travel) : withSpring(open ? 0 : travel, { duration: 300, dampingRatio: 0.8, velocity: event.velocityY }));
      scheduleOnRN(commit, open);
    })
    .onFinalize((_event, success) => {
      if (success) return;
      const target = detent.get() ? 0 : travel;
      offset.set(reduced ? target : withSpring(target, { duration: 300, dampingRatio: 0.8, velocity: 0 }));
    }), [commit, detent, offset, origin, panelHeight, reduced, travel]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return (
    <Animated.View style={[styles.panel, { height: panelHeight, backgroundColor: t.background }, sweetShadow(t), animated]}>
      <GestureDetector gesture={pan}>
        <View collapsable={false} onLayout={(e) => setHandleHeight(Math.ceil(e.nativeEvent.layout.height))}>
          <SoftPressable
            accessibilityRole="button"
            accessibilityLabel={tr(expanded ? 'nav.sheetCollapse' : 'nav.sheetExpand')}
            accessibilityHint={tr('nav.sheetHint')}
            accessibilityState={{ expanded }}
            onPress={toggle}
            style={styles.handleButton}>
            <View accessible={false} style={[styles.handle, { backgroundColor: t.textMuted }]} />
            <Text style={[type.meta, { color: t.textMuted }]}>{tr(expanded ? 'nav.sheetLess' : 'nav.sheetDetails')}</Text>
          </SoftPressable>
        </View>
      </GestureDetector>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl + (expanded ? 0 : travel) + (popup ? 380 : 0) }]}>
        <View style={styles.content} onLayout={(e) => setContentHeight(Math.ceil(e.nativeEvent.layout.height))}>
          {children}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderCurve: 'continuous', overflow: 'hidden' },
  handleButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm },
  handle: { width: 40, height: 4, borderRadius: 2 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm },
  content: { gap: space.lg },
});
