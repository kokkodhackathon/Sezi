import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/screen-header';
import { Badge, EmptyState, Note } from '@/components/ui';
import { ChevronIcon, TurnIcon } from '@/design/icons';
import { type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { planTour, TOURS } from '@/lib/tours';

export default function Tours() {
  const t = useSeziTheme();
  const { t: tr } = useT();
  const { profile } = useProfile();
  const plans = useMemo(() => profile ? TOURS.map((d) => planTour(d.id, profile)) : [], [profile]);
  if (!profile) return null;
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
    <ScrollView contentContainerStyle={s.body}>
      <ScreenHeader title={tr('tours.title')} subtitle={tr('tours.subtitle')} />
      <Note text={tr('design.pilotSubtitle')} icon={<TurnIcon turn="slight_right" color={t.primary} />} />
      {!plans.some((plan) => plan?.stops.length) ? <EmptyState title={tr('tours.none')} /> : null}
      {plans.map((plan, i) => {
        if (!plan?.stops.length) return null;
        const id = TOURS[i]!.id;
        const title = tr(`tours.${id}.title` as MessageKey);
        const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));
        const access = plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.stairs', { n: plan.stairs });
        const meta = `${tr('tours.stops', { n: plan.stops.length })} · ${Math.round(plan.lengthM)} m · ${tr('common.min', { n: minutes })}`;
        return <Pressable key={id} onPress={() => router.push({ pathname: '/tour/[id]', params: { id } })} accessibilityRole="button" accessibilityLabel={`${title}. ${meta}. ${access}`} accessibilityHint={tr('design.tourOpen')} style={({ pressed }) => [s.tour, { backgroundColor: pressed ? t.surface : t.background, borderColor: t.border }]}>
          <View style={s.heading}><Text style={[type.editorial, { color: t.text, flex: 1 }]}>{title}</Text><ChevronIcon color={t.primary} size={20} /></View>
          <Text style={[type.body, { color: t.textMuted }]}>{tr(`tours.${id}.body` as MessageKey)}</Text>
          <Text style={[type.meta, { color: t.text }]}>{meta}</Text>
          <Badge label={access} tone={plan.stairs === 0 ? 'primary' : 'accent'} />
          <Text style={[type.button, { color: t.primary }]}>{tr('design.tourOpen')}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({ body: { paddingHorizontal: 24, paddingBottom: 32, gap: 24 }, tour: { gap: 16, paddingVertical: 24, borderTopWidth: 1 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 16 } });
