import type { SweetTheme } from '@sezi/shared';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ListRow, SectionTitle } from '@/components/ui';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { ExternalIcon } from '@/design/icons';
import { useT } from '@/lib/i18n';
import { loc, useCities, useInventoryBooks } from '@/lib/works';

export default function About() {
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: books } = useInventoryBooks();
  const { data: cities } = useCities();
  const cityName = (id: string | null) => loc(cities?.find((c) => c.id === id)?.name, lang);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={[type.hero, { color: t.text }]} accessibilityRole="header">
          Sezi
        </Text>
        <Text style={[type.meta, { color: t.textMuted }]}>{tr('about.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
      </View>

      <Text style={[type.lead, { color: t.text }]}>{tr('about.lead')}</Text>

      <SectionTitle title={tr('about.project')} />
      <Text style={[type.body, { color: t.text }]}>{tr('about.projectBody')}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{tr('about.award')}</Text>
      <Card padded={false}>
        <ListRow first title={tr('exh.title')} onPress={() => router.push('/exhibitions')} />
      </Card>

      {books?.length ? (
        <>
          <SectionTitle title={tr('about.books')} />
          <Card padded={false}>
            {books.map((b, i) => (
              <ListRow
                key={b.id}
                first={i === 0}
                title={b.title}
                subtitle={[cityName(b.city_id), b.year ? String(b.year) : null].filter(Boolean).join(' · ')}
                hint={tr('inv.openBookHint')}
                trailing={<ExternalIcon color={t.primaryText} />}
                onPress={b.url ? () => Linking.openURL(b.url!) : undefined}
              />
            ))}
          </Card>
        </>
      ) : null}

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

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
    hero: { alignItems: 'center', gap: space.sm, paddingTop: space.md },
  });
