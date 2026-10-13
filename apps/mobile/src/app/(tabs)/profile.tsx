import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/screen-header';
import { Badge, Button, Card, ListRow, SectionTitle } from '@/components/ui';
import { type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';
import { useReports } from '@/lib/reports';
import { useSettings } from '@/lib/settings';
import { useWorks } from '@/lib/works';

export default function Profile() {
  const t = useSeziTheme();
  const { t: tr } = useT();
  const { profile } = useProfile();
  const { visited } = useSettings();
  const reports = useReports();
  const { data: works } = useWorks();
  if (!profile) return null;
  const visitedCount = works ? works.filter((w) => visited.includes(w.slug)).length : visited.length;
  const senses = (['audio', 'haptic', 'visual'] as const).filter((k) => profile.senses[k]).map((k) => tr(`onb.senses.${k}`)).join(', ');
  const rows = [
    [tr('profile.vision'), tr(`onb.vision.${profile.vision}`)],
    [tr('profile.hearing'), tr(`onb.hearing.${profile.hearing}`)],
    [tr('profile.mobility'), tr(`onb.mobility.${profile.mobility}`)],
    [tr('profile.senses'), senses],
    [tr('profile.lang'), profile.lang === 'tr' ? 'Türkçe' : 'English'],
  ];
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
    <ScrollView contentContainerStyle={s.body}>
      <ScreenHeader title={tr('profile.title')} subtitle={tr('design.profileIntro')} />
      <View style={{ gap: 8 }}>
        <SectionTitle title={tr('profile.stats.visited')} />
        <Text style={[type.body, { color: t.text }]}>{tr('profile.stats.of', { n: visitedCount, total: works?.length ?? 0 })}</Text>
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle title={tr('profile.edit')} />
        <Card padded={false}>{rows.map(([label, value], i) => <ListRow key={label} first={i === 0} title={label!} subtitle={value} />)}</Card>
        <Button label={tr('profile.edit')} onPress={() => router.push('/onboarding')} />
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle title={tr('profile.more')} />
        <Card padded={false}>
          <ListRow first title={tr('profile.reports')} trailing={reports.length ? <Badge label={String(reports.length)} /> : undefined} onPress={() => router.push('/reports')} />
          <ListRow title={tr('profile.signIn')} subtitle={tr('profile.signInSub')} onPress={() => router.push('/sign-in')} />
          <ListRow title={tr('profile.settings')} onPress={() => router.push('/settings')} />
          <ListRow title={tr('exh.title')} onPress={() => router.push('/exhibitions')} />
          <ListRow title={tr('profile.about')} onPress={() => router.push('/about')} />
        </Card>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({ body: { paddingHorizontal: 24, paddingBottom: 32, gap: 28 } });
