import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CloseIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import type { NavAlert } from '@/lib/sim/session';

/**
 * Rehberlik uyarı şeridi: rotadan çıkma, yol kapanması, kalabalık modu.
 * Sesli uyarının yazılı karşılığıdır; ekran okuyucu hemen duyurur.
 */
export function NavAlertBanner({ alert, onDismiss }: { alert: NavAlert | null; onDismiss: () => void }) {
  const t = useSeziTheme();
  const { t: tr } = useT();
  if (!alert) return null;
  const urgent = alert.kind === 'offroute' || alert.kind === 'blocked' || alert.kind === 'no_route';
  const color = urgent ? t.danger : t.primary;
  return (
    <View style={[styles.box, { borderColor: color, backgroundColor: t.surface }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={[styles.bar, { backgroundColor: color }]} />
      <Text style={[type.body, { color: t.text, flex: 1, fontFamily: type.button.fontFamily }]}>{alert.text}</Text>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={tr('sim.dismiss')} style={styles.close} hitSlop={8}>
        <CloseIcon color={t.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingRight: space.xs, borderRadius: radius.md, borderWidth: 2, overflow: 'hidden' },
  bar: { width: 6, alignSelf: 'stretch' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
