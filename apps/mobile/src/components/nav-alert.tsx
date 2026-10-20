import { StyleSheet, Text, View } from 'react-native';

import { CloseIcon } from '@/design/icons';
import { SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import type { NavAlert } from '@/lib/navigation/session';

/**
 * Rehberlik uyarı şeridi: rotadan çıkma, yol kapanması, kalabalık modu.
 * Sesli uyarının yazılı karşılığıdır; ekran okuyucu hemen duyurur.
 */
export function NavAlertBanner({ alert, onDismiss }: { alert: NavAlert | null; onDismiss: () => void }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  if (!alert) return null;
  const urgent = alert.kind === 'offroute' || alert.kind === 'blocked' || alert.kind === 'no_route';
  const color = urgent ? t.danger : t.primaryText;
  return (
    <View style={[styles.box, { borderColor: color, backgroundColor: t.surface }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={[styles.bar, { backgroundColor: color }]} />
      <Text style={[type.body, { color: t.text, flex: 1, fontFamily: type.button.fontFamily }]}>{alert.text}</Text>
      <SoftPressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={tr('sim.dismiss')} style={styles.close} hitSlop={8}>
        <CloseIcon color={t.textMuted} />
      </SoftPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingRight: space.xs, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 2, overflow: 'hidden' },
  bar: { width: 6, alignSelf: 'stretch' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
