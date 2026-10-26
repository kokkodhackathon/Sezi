import { ScrollView, View } from 'react-native';
import { AchievementBadge } from '@/components/achievement-badge';
import { EmptyState, SectionTitle } from '@/components/ui';
import { space } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAchievements } from '@/lib/achievements';
import { useT } from '@/lib/i18n';

export default function AchievementsScreen() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const { list } = useAchievements();
  const earned = list.filter((item) => item.level > 0);
  const next = list.filter((item) => item.level === 0);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxl }}>
      <View style={{ gap: space.md }}>
        <SectionTitle title={tr('ach.earned')} />
        {earned.length ? (
          earned.map((achievement) => <AchievementBadge key={achievement.id} achievement={achievement} />)
        ) : (
          <EmptyState title={tr('ach.noneEarned')} />
        )}
      </View>
      <View style={{ gap: space.md }}>
        <SectionTitle title={tr('ach.next')} />
        {next.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </View>
    </ScrollView>
  );
}
