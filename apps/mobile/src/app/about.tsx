import type { ThemeColors } from '@sezi/shared';
import Constants from 'expo-constants';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ListRow, SectionTitle } from '@/components/ui';
import { KilimBand, Medallion } from '@/design/motif';
import { space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';

export default function About() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Medallion primary={t.primary} accent={t.accent} ink={t.text} size={96} />
        <Text style={[type.hero, { color: t.text }]} accessibilityRole="header">
          Sezi
        </Text>
        <Text style={[type.meta, { color: t.textMuted }]}>{tr('about.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
      </View>
      {t.motifOpacity > 0 ? (
        <View style={{ height: 10, marginHorizontal: -space.lg }}>
          <KilimBand color={t.accent} accent={t.primary} height={10} opacity={0.6} />
        </View>
      ) : null}
      <Text style={[type.lead, { color: t.text }]}>{tr('about.lead')}</Text>

      <SectionTitle title={tr('about.sources')} />
      <Card padded={false}>
        <ListRow first title="Wikidata" subtitle={tr('about.wikidata')} />
        <ListRow title="OpenStreetMap" subtitle={tr('about.osm')} />
        <ListRow title="Google Fonts" subtitle={tr('about.fonts')} />
      </Card>

      <SectionTitle title={tr('about.verification')} />
      <Text style={[type.body, { color: t.text }]}>{tr('about.verificationBody')}</Text>

      <SectionTitle title={tr('about.privacy')} />
      <Text style={[type.body, { color: t.text }]}>{tr('about.privacyBody')}</Text>
    </ScrollView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.xl, paddingBottom: 56 },
    hero: { alignItems: 'center', gap: space.sm, paddingTop: space.md },
  });
