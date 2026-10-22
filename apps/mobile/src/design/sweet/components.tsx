import { hasLocation, loc, type SweetTheme, type SweetTone, type WorkRow } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { CloseIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type Lang, type Translate } from '@/lib/i18n';

import { duration, ease, pressScale, selectSpring, stagger } from './motion';

/** Yalnız yüzen öğeler için (sekme çubuğu, pilot kartı): çok hafif, dağınık gölge. Yüksek kontrastta 2 dp çerçeve. */
export function sweetShadow(t: SweetTheme): ViewStyle {
  if (t.outlined) return { borderWidth: 2, borderColor: t.border };
  return { shadowColor: t.shadow, shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 };
}

/** Yüksek kontrastta dolgusuz yüzeyleri ayıran çerçeve; diğer temalarda boş. */
export function outline(t: SweetTheme): { borderWidth: number; borderColor: string } | null {
  return t.outlined ? { borderWidth: 2, borderColor: t.border } : null;
}

/** Erişilebilirlik etiketi: görülen her şey ve konum durumu (kartta yazı olarak gösterilmez). */
export function a11yLabel(work: WorkRow, lang: Lang, tr: Translate) {
  const precision = !hasLocation(work) ? tr('inv.unlocated') : work.location_precision === 'approximate' ? tr('inv.approx') : null;
  return [loc(work.name, lang), loc(work.type_name, lang), work.district, work.unesco ? 'UNESCO' : null, precision].filter(Boolean).join('. ');
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SoftPressableProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Basınca hafifçe küçülen yüzey (0.96, ease-out). Reduce motion: yalnız opacity. */
export function SoftPressable({ style, onPressIn, onPressOut, ...rest }: SoftPressableProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (reduced) opacity.set(0.8);
        else scale.set(withTiming(pressScale, { duration: duration.press, easing: ease.out }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (reduced) opacity.set(1);
        else scale.set(withTiming(1, { duration: duration.release, easing: ease.out }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}

/** Yuvarlak ikon düğmesi (48 dp, gri dolgu); `label` görünmez, ekran okuyucuya söylenir. */
export function IconBubble({ icon, label, onPress }: { icon: (color: string) => ReactNode; label: string; onPress: () => void }) {
  const t = useSweetTheme();
  return (
    <SoftPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[s.iconBubble, { backgroundColor: t.soft }, outline(t)]}>
      {icon(t.text)}
    </SoftPressable>
  );
}

/** "Tümü" kutucuğunun 2×2 nokta glifi. */
function DotsGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="7.5" cy="7.5" r="3.2" fill={color} />
      <Circle cx="16.5" cy="7.5" r="3.2" fill={color} />
      <Circle cx="7.5" cy="16.5" r="3.2" fill={color} />
      <Circle cx="16.5" cy="16.5" r="3.2" fill={color} />
    </Svg>
  );
}

/**
 * Tür kutucuğu: yumuşak köşeli kare, glif ve kısa etiket.
 * Seçiliyken mürekkep rengine dolar (renk değil, dolgu/zıtlık farkı) ve hafifçe büyür.
 */
export function TypeTile({
  label,
  slug,
  selected,
  tone,
  onPress,
}: {
  label: string;
  slug: string | null;
  selected: boolean;
  tone: SweetTone;
  onPress: () => void;
}) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.set(reduced ? 1 : withSpring(selected ? 1.05 : 1, selectSpring));
  }, [selected, reduced, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Seçili kutucuk koyu firuzeye dolar: diğer pastel kutucuklardan dolgu zıtlığıyla ayrılır.
  const fill = selected ? t.primaryText : tone.fill;
  const ink = selected ? t.background : tone.ink;
  return (
    <SoftPressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={s.tile}>
      <Animated.View style={[s.tileBox, { backgroundColor: fill }, !selected && outline(t), animated]}>
        {slug ? <WorkGlyphInline slug={slug} color={ink} size={28} /> : <DotsGlyph color={ink} size={24} />}
      </Animated.View>
      <Text style={[type.bubble, selected && { fontFamily: type.button.fontFamily }, { color: selected ? t.text : t.textMuted, textAlign: 'center' }]} numberOfLines={1}>
        {label}
      </Text>
    </SoftPressable>
  );
}

/** Sıralı yumuşak giriş (8 dp yukarı + opacity). Reduce motion: yalnız opacity. */
export function FadeInItem({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const entering = reduced
    ? FadeIn.duration(duration.fade)
    : FadeInDown.duration(duration.enter)
        .delay(Math.min(index, stagger.maxItems) * stagger.step)
        .easing(ease.out)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** Yükleniyor iskeleti: nefes alan gri blok. */
export function Skeleton({ width, height, corner = radius.lg }: { width: number; height: number; corner?: number }) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.7);
  useEffect(() => {
    opacity.set(reduced ? 0.7 : withRepeat(withTiming(0.45, { duration: 900, easing: ease.inOut }), -1, true));
  }, [reduced, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View accessible={false} style={[{ width, height, borderRadius: corner, borderCurve: 'continuous', backgroundColor: t.soft }, outline(t), animated]} />;
}

/** Alt panel: aşağıdan kayar (ease-drawer), daha hızlı kapanır. Reduce motion: yalnız opacity. */
export function SweetSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(0);
  const backdrop = useSharedValue(0);
  const offset = useSharedValue(1);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      if (!height) return;
      backdrop.set(withTiming(1, { duration: duration.fade }));
      offset.set(reduced ? 0 : withTiming(0, { duration: duration.sheetIn, easing: ease.drawer }));
      return;
    }
    backdrop.set(
      withTiming(0, { duration: reduced ? duration.fade : duration.sheetOut, easing: ease.out }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      }),
    );
    if (!reduced) offset.set(withTiming(1, { duration: duration.sheetOut, easing: ease.out }));
  }, [visible, mounted, height, reduced, backdrop, offset]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: height ? (reduced ? backdrop.value : 1) : 0,
    transform: [{ translateY: offset.value * height }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.sheetRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: `${t.shadow}66` }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('design.close')} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[s.sheet, { backgroundColor: t.surface, paddingBottom: Math.max(insets.bottom, space.lg) }, outline(t), panelStyle]}>
          <View accessible={false} style={[s.grabber, { backgroundColor: t.border }]} />
          <View style={s.sheetHead}>
            <Text style={[type.title, { color: t.text, flex: 1 }]} accessibilityRole="header">
              {title}
            </Text>
            <IconBubble icon={(c) => <CloseIcon color={c} size={20} />} label={tr('design.close')} onPress={onClose} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 72, alignItems: 'center', gap: space.sm },
  tileBox: { width: 64, height: 64, borderRadius: 20, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderCurve: 'continuous', paddingTop: space.sm, maxHeight: '85%' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.lg },
});
