import { coverOf, loc, planTour, type SweetTheme } from '@sezi/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader, useFloatingHeaderScroll } from '@/components/floating-header';
import { LynchLine, type LynchStop } from '@/components/lynch-line';
import { PhotoSourceTag } from '@/components/photo-source';
import { Button, EmptyState, SectionTitle } from '@/components/ui';
import { RouteIcon, TurnIcon } from '@/design/icons';
import { FadeInItem, outline, Skeleton } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { defaultStart, planner, useNavVersion, walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { photoUrl, useWorks } from '@/lib/works';

const TOUR_COPY: Record<string, { title: MessageKey; body: MessageKey }> = {
  tum: { title: 'tours.tum.title', body: 'tours.tum.body' },
  hanlar: { title: 'tours.hanlar.title', body: 'tours.hanlar.body' },
  camiler: { title: 'tours.camiler.title', body: 'tours.camiler.body' },
  su: { title: 'tours.su.title', body: 'tours.su.body' },
};

export default function TourDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { visited } = useSettings();
  const navVersion = useNavVersion();
  const header = useFloatingHeaderScroll();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: works, isLoading } = useWorks('bursa');
  const plan = useMemo(
    () => (profile ? planTour(planner, id, profile, defaultStart()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, profile, navVersion],
  );
  const bySlug = useMemo(() => new Map((works ?? []).map((w) => [w.slug, w])), [works]);
  const stops = useMemo(() => {
    const result: LynchStop[] = [];
    if (!plan || !profile) return result;
    let from = defaultStart();
    plan.stops.forEach((stop, index) => {
      // Tur hesabıyla aynı bacak; ek anlatım sapması olmadan gerçek yer işaretleri.
      const leg = planner.planRoute(stop.slug, profile, from, { via: false });
      for (const landmark of leg?.passedLandmarks ?? []) {
        if (!landmark.name) continue;
        result.push({ key: `${stop.slug}:landmark:${landmark.id}`, kind: 'landmark', title: loc(landmark.name, lang) });
      }
      const work = bySlug.get(stop.slug);
      const stairs = stop.legStairs > 0 ? tr('tours.stairs', { n: stop.legStairs }) : null;
      result.push({
        key: stop.slug, kind: 'stop', index: index + 1, title: loc(stop.name, lang),
        subtitle: [tr('tours.leg', { m: Math.round(stop.legM) }), stairs].filter(Boolean).join(' · '),
        photo: work ? coverOf(work) : null, done: visited.includes(stop.slug),
        onPress: () => router.push({ pathname: '/work/[slug]', params: { slug: stop.slug } }),
      });
      from = planner.landmarkNodeForWork(stop.slug)?.location ?? from;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, profile, bySlug, visited, lang, tr, navVersion]);
  const copy = TOUR_COPY[id];
  const title = copy ? tr(copy.title) : tr('tours.title');
  const coverWork = plan?.stops.map((stop) => bySlug.get(stop.slug)).find((work) => work && coverOf(work));
  const cover = coverWork ? coverOf(coverWork) : null;

  if (isLoading) return (
    <View style={[s.screen, { backgroundColor: t.background, paddingTop: insets.top + 80, paddingHorizontal: space.xl, gap: space.xl }]} accessibilityLabel={tr('tours.loading')} accessibilityState={{ busy: true }}>
      <Skeleton width={width - 48} height={240} /><Skeleton width={width - 96} height={34} /><Skeleton width={width - 48} height={100} />
      <FloatingHeader title={title} scrollY={header.scrollY} coverHeight={header.coverHeight} />
    </View>
  );
  if (!profile || !plan || plan.stops.length === 0) return (
    <View style={[s.screen, { backgroundColor: t.background, paddingTop: insets.top + 80 }]}>
      <EmptyState title={tr('tours.none')} /><FloatingHeader title={title} scrollY={header.scrollY} coverHeight={header.coverHeight} />
    </View>
  );
  const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));
  return (
    <View style={[s.screen, { backgroundColor: t.background }]}>
      <Animated.ScrollView onScroll={header.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 56 }}>
        <View onLayout={(e) => header.coverHeight.set(e.nativeEvent.layout.height)} style={[s.cover, { backgroundColor: t.primary.fill, paddingTop: insets.top + 72 }, outline(t)]}>
          {cover ? <><Image source={{ uri: photoUrl(cover, 'full') }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /><PhotoSourceTag photo={cover} /></> : <RouteIcon color={t.primary.ink} size={72} />}
        </View>
        <View style={s.body}>
          <FadeInItem index={0} style={{ gap: space.sm }}><Text style={[type.editorial, { color: t.text }]} accessibilityRole="header">{title}</Text>{copy ? <Text style={[type.body, { color: t.textMuted }]}>{tr(copy.body)}</Text> : null}</FadeInItem>
          <FadeInItem index={1} style={s.stats}>
            <Stat value={String(plan.stops.length)} label={tr('tours.stopsTitle')} t={t} />
            <Stat value={`${Math.round(plan.lengthM)} m`} label={tr('tours.statWalk', { n: minutes })} t={t} />
            <Stat value={String(plan.stairs)} label={plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.statStairs')} t={t} />
          </FadeInItem>
          <Button label={tr('tours.start')} onPress={() => router.push({ pathname: '/navigate', params: { tour: plan.stops.map((stop) => stop.slug).join(',') } })} icon={(color) => <TurnIcon turn="slight_right" color={color} size={22} />} />
          <FadeInItem index={2}><SectionTitle title={tr('tours.stopsTitle')} /><LynchLine stops={stops} /></FadeInItem>
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('route.dataNote')}</Text>
        </View>
      </Animated.ScrollView>
      <FloatingHeader title={title} scrollY={header.scrollY} coverHeight={header.coverHeight} lightOnCover={!!cover} />
    </View>
  );
}

function Stat({ value, label, t }: { value: string; label: string; t: SweetTheme }) {
  return <View style={[s.stat, { backgroundColor: t.soft }, outline(t)]} accessible accessibilityLabel={`${value} ${label}`}><Text style={[type.title, { color: t.text }]}>{value}</Text><Text style={[type.meta, { color: t.textMuted }]}>{label}</Text></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: space.xl, gap: space.xl },
  cover: { minHeight: 280, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stats: { flexWrap: 'wrap', flexDirection: 'row', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: 100, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, borderCurve: 'continuous', gap: space.xs },
});
