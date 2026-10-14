import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';

/** Başlık tek hiyerarşi taşır; yinelenen üst etiket ve dekoratif şerit yok. */
export function ScreenHeader({ title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  const t = useSeziTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[type.screenTitle, { color: t.text, flex: 1 }]} accessibilityRole="header">{title}</Text>
        {action}
      </View>
      {subtitle ? <Text style={[type.body, { color: t.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: space.sm, paddingTop: space.lg, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
