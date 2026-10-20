import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tabs';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui';
import { SoundIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { toneForType } from '@/design/sweet/tones';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { defaultStart, formatDistance, useNavVersion, walkingSpeed } from '@/lib/nav';
import { useNavPoints } from '@/lib/points';
import { useProfile } from '@/lib/profile';
import { TOURS } from '@sezi/shared';
import { planTour } from '@/lib/tours';
import { photoUrl, useWorks } from '@/lib/works';

/** Turlar: her tur bir fotoğraf kartı; açıklama ekran okuyucu etiketinde, görünen metin tek satır. */
export default function Tours() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const tabSpace = useTabBarSpace();
  const { data: works } = useWorks('bursa');
  const navVersion = useNavVersion();
  const stories = useNavPoints().filter((p) => p.roles.includes('story')).length;
  const plans = useMemo(
    () => (profile ? TOURS.map((d) => planTour(d.id, profile, defaultStart())) : []),
    // navVersion: başlangıç noktaları ve onaylı bildirimler değişince turlar yeniden hesaplanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, navVersion],
  );
  const bySlug = useMemo(() => new Map((works ?? []).map((w) => [w.slug, w])), [works]);
  // Her tur kapak olarak, önceki turlarda kullanılmamış ilk fotoğrafı alır (aynı kare tekrarlanmasın).
  const covers = useMemo(() => {
    const used = new Set<string>();
    return plans.map((plan) => {
      const photos = (plan?.stops ?? []).map((st) => bySlug.get(st.slug)).flatMap((w) => (w ? w.photos : []));
      const pick = photos.find((p) => !used.has(p.id));
      if (pick) used.add(pick.id);
      return pick;
    });
  }, [plans, bySlug]);
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
        {!plans.some((plan) => plan?.stops.length) ? <EmptyState title={tr('tours.none')} /> : null}
        {plans.map((plan, i) => {
          if (!plan?.stops.length) return null;
          const id = TOURS[i]!.id;
          const title = tr(`tours.${id}.title` as MessageKey);
          const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));
          const access = plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.stairs', { n: plan.stairs });
          const meta = [tr('tours.stops', { n: plan.stops.length }), formatDistance(plan.lengthM, lang), tr('common.min', { n: minutes })].join(' · ');
          const cover = covers[i];
          const tone = t.tones[toneForType(plan.stops[0]!.type)];
          return (
            <SoftPressable
              key={id}
              onPress={() => router.push({ pathname: '/tour/[id]', params: { id } })}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${tr(`tours.${id}.body` as MessageKey)} ${meta}. ${access}`}
              accessibilityHint={tr('design.tourOpen')}
              style={[s.card, { backgroundColor: t.surface }, outline(t), !cover && s.compact]}>
              {cover ? (
                <View style={[s.imgWrap, { backgroundColor: t.soft }]}>
                  <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
                </View>
              ) : (
                // Fotoğrafı olmayan tur: büyük boş alan yerine küçük simgeli kare.
                <View style={[s.tile, { backgroundColor: tone.fill }]}>
                  <WorkGlyphInline slug={plan.stops[0]!.type} color={tone.ink} size={30} />
                </View>
              )}
              <View style={[s.cap, !cover && { flex: 1, paddingLeft: 0 }]}>
                <Text style={[type.title, { color: t.text }]}>{title}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>{meta}</Text>
                <Text style={[type.meta, { color: plan.stairs === 0 ? t.primaryText : t.accentText, fontFamily: type.button.fontFamily }]}>{access}</Text>
              </View>
            </SoftPressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xl },
  card: { borderRadius: radius.xl, borderCurve: 'continuous', padding: space.sm, gap: space.xs },
  imgWrap: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  cap: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  compact: { flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.md },
  tile: { width: 64, height: 64, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
