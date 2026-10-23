import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tabs';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui';
import { PhotoCard } from '@/components/photo-card';
import { SoundIcon } from '@/design/icons';
import { FadeInItem, outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { defaultStart, formatDistance, planner, useNavVersion, walkingSpeed } from '@/lib/nav';
import { useNavPoints } from '@/lib/points';
import { useProfile } from '@/lib/profile';
import { useTours } from '@/lib/tours';
import { loc, planTour } from '@sezi/shared';
import { useWorks } from '@/lib/works';

/** Turlar: her tur bir fotoğraf kartı; açıklama ekran okuyucu etiketinde, görünen metin tek satır. */
export default function Tours() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - space.xl * 2, 360);
  const { data: works } = useWorks('bursa');
  const navVersion = useNavVersion();
  const stories = useNavPoints().filter((p) => p.roles.includes('story')).length;
  const tours = useTours();
  const items = useMemo(
    () =>
      profile
        ? tours.flatMap((tour) => {
            const plan = planTour(planner, tour, profile, defaultStart());
            return plan?.stops.length ? [{ tour, plan }] : [];
          })
        : [],
    // navVersion: başlangıç noktaları ve onaylı bildirimler değişince turlar yeniden hesaplanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tours, profile, navVersion],
  );
  const bySlug = useMemo(() => new Map((works ?? []).map((w) => [w.slug, w])), [works]);
  // Her tur kapak olarak, önceki turlarda kullanılmamış ilk fotoğrafı alır (aynı kare tekrarlanmasın).
  const covers = useMemo(() => {
    const used = new Set<string>();
    return items.map(({ plan }) => {
      const photos = plan.stops.map((st) => bySlug.get(st.slug)).flatMap((w) => (w ? w.photos : []));
      const pick = photos.find((p) => !used.has(p.id));
      if (pick) used.add(pick.id);
      return pick;
    });
  }, [items, bySlug]);
  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: tabSpace }]}>
        <ScreenHeader title={tr('tours.title')} subtitle={tr('design.pilotSubtitle')} />
        {/* Canlı yürüyüş: anlatım noktaları her ilde çalışır; tur kartlarıyla aynı kapaksız düzen. */}
        <SoftPressable
          onPress={() => router.push('/navigate')}
          accessibilityRole="button"
          accessibilityLabel={`${tr('nav.walkCard')}. ${tr('nav.walkCardBody')}. ${tr('nav.storyCount', { n: stories })}`}
          accessibilityHint={tr('nav.beginHint')}
          style={[s.card, { backgroundColor: t.surface }, outline(t), s.compact]}>
          <View style={[s.tile, { backgroundColor: t.primary.fill }]}>
            <SoundIcon color={t.primary.ink} size={30} />
          </View>
          <View style={[s.cap, { flex: 1, paddingLeft: 0 }]}>
            <Text style={[type.title, { color: t.text }]}>{tr('nav.walkCard')}</Text>
            <Text style={[type.meta, { color: t.textMuted }]}>{tr('nav.walkCardBody')}</Text>
            <Text style={[type.meta, { color: t.primaryText, fontFamily: type.button.fontFamily }]}>{tr('nav.storyCount', { n: stories })}</Text>
          </View>
        </SoftPressable>
        {items.length === 0 ? <EmptyState title={tr('tours.none')} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + space.md} decelerationRate="fast"
          style={{ marginHorizontal: -space.xl }} contentContainerStyle={s.carousel}>
          {items.map(({ tour, plan }, i) => {
            const title = loc(tour.title, lang);
            const body = tour.body ? `${loc(tour.body, lang)} ` : '';
            const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));
            const access = plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.stairs', { n: plan.stairs });
            const meta = [tr('tours.stops', { n: plan.stops.length }), formatDistance(plan.lengthM, lang), tr('common.min', { n: minutes })].join(' · ');
            return (
              <FadeInItem key={tour.slug} index={i}>
                <PhotoCard width={cardWidth} title={title} meta={meta} detail={access} photo={covers[i]} typeSlug={plan.stops[0]!.type}
                  onPress={() => router.push({ pathname: '/tour/[id]', params: { id: tour.slug } })}
                  accessibilityLabel={`${title}. ${body}${meta}. ${access}`} accessibilityHint={tr('design.tourOpen')} />
              </FadeInItem>
            );
          })}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xl },
  card: { borderRadius: radius.xl, borderCurve: 'continuous', padding: space.sm, gap: space.xs },
  carousel: { paddingHorizontal: space.xl, gap: space.md },
  cap: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  compact: { flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.md },
  tile: { width: 64, height: 64, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
