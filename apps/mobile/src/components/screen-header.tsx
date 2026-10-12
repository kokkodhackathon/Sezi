import { StyleSheet, Text, View } from 'react-native';

import { KilimBand } from '@/design/motif';
import { space, type, upper } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';

/** Sekme ekranlarının başlığı: üst etiket, Fraunces başlık, isteğe bağlı alt satır ve kilim şeridi. */
export function ScreenHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  const t = useSeziTheme();
  const { lang } = useT();
  return (
    <View style={styles.wrap}>
      <View style={styles.text}>
        <Text style={[type.eyebrow, { color: t.primary }]}>{upper(eyebrow, lang)}</Text>
        <Text style={[type.display, { color: t.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[type.meta, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {t.motifOpacity > 0 ? (
        <View style={styles.band}>
          <KilimBand color={t.accent} accent={t.primary} height={12} opacity={0.9} />
        </View>
      ) : (
        <View style={[styles.rule, { backgroundColor: t.border }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, marginHorizontal: -space.lg, paddingTop: space.sm },
  text: { gap: space.xs, paddingHorizontal: space.lg },
  band: { height: 12 },
  rule: { height: 2 },
});
