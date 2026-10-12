import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Badge, Button, Card, ListRow, SectionTitle } from '@/components/ui';
import { CengelMark } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';
import { useReports } from '@/lib/reports';
import { useSettings } from '@/lib/settings';
import { useWorks } from '@/lib/works';

export default function Profile() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { visited } = useSettings();
  const reports = useReports();
  const { data: works } = useWorks();
  if (!profile) return null;

  const total = works?.length ?? 0;
  const visitedCount = works ? works.filter((w) => visited.includes(w.slug)).length : visited.length;
  const pct = total ? visitedCount / total : 0;

  const senses = (['audio', 'haptic', 'visual'] as const)
    .filter((k) => profile.senses[k])
    .map((k) => tr(`onb.senses.${k}`))
    .join(', ');

  const rows: [string, string, string?][] = [
    [tr('profile.vision'), tr(`onb.vision.${profile.vision}`), tr(`onb.vision.${profile.vision}.d`)],
    [tr('profile.mobility'), tr(`onb.mobility.${profile.mobility}`), tr(`onb.mobility.${profile.mobility}.d`)],
    [tr('profile.senses'), senses],
    [tr('profile.lang'), profile.lang === 'tr' ? 'Türkçe' : 'English'],
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <ScreenHeader eyebrow={tr('profile.eyebrow')} title={tr('profile.title')} subtitle={tr('profile.hint')} />

        {/* Ziyaret ilerlemesi */}
        <View style={s.stat} accessible accessibilityLabel={`${tr('profile.stats.visited')}: ${tr('profile.stats.of', { n: visitedCount, total })}`}>
          <Text style={[type.eyebrow, { color: t.onPrimary, opacity: 0.85 }]}>{upper(tr('profile.stats.visited'), lang)}</Text>
          <Text style={[type.display, { color: t.onPrimary }]}>
            {visitedCount}
            <Text style={[type.title, { color: t.onPrimary, opacity: 0.75 }]}> / {total}</Text>
          </Text>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.max(2, Math.round(pct * 100))}%` }]} />
          </View>
        </View>

        <View style={s.card}>
          {rows.map(([label, value, desc], i) => (
            <View key={label} style={[s.row, i > 0 && s.rowBorder]} accessible accessibilityLabel={[label, value, desc].filter(Boolean).join(': ')}>
              <View style={s.labelRow}>
                <CengelMark color={t.accent} size={12} />
                <Text style={[type.eyebrow, { color: t.textMuted }]}>{upper(label, lang)}</Text>
              </View>
              <Text style={[type.itemTitle, { color: t.text }]}>{value}</Text>
              {desc ? <Text style={[type.meta, { color: t.textMuted }]}>{desc}</Text> : null}
            </View>
          ))}
        </View>
        <Button label={tr('profile.edit')} onPress={() => router.push('/onboarding')} />

        <SectionTitle title={tr('profile.more')} />
        <Card padded={false}>
          <ListRow
            first
            title={tr('profile.reports')}
            trailing={reports.length ? <Badge label={String(reports.length)} tone="primary" /> : undefined}
            onPress={() => router.push('/reports')}
          />
          <ListRow title={tr('profile.signIn')} subtitle={tr('profile.signInSub')} onPress={() => router.push('/sign-in')} />
          <ListRow title={tr('profile.settings')} onPress={() => router.push('/settings')} />
          <ListRow title={tr('profile.about')} onPress={() => router.push('/about')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xl },
    stat: { gap: space.xs, padding: space.xl, borderRadius: radius.lg, backgroundColor: t.primary },
    bar: { height: 8, marginTop: space.sm, borderRadius: 4, backgroundColor: `${t.onPrimary}33`, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4, backgroundColor: t.onPrimary },
    card: { backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
    row: { padding: space.lg, gap: space.xs },
    rowBorder: { borderTopWidth: 1, borderTopColor: t.border },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  });
