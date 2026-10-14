import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, softShadow } from '@/components/ui';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { formatDistance, walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { planTour, TOURS } from '@/lib/tours';
import { coverOf, photoUrl, useWorks } from '@/lib/works';

/** Turlar: her tur bir fotoğraf kartı; açıklama ekran okuyucu etiketinde, görünen metin tek satır. */
export default function Tours() {
  const t = useSeziTheme();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { data: works } = useWorks('bursa');
  const plans = useMemo(() => (profile ? TOURS.map((d) => planTour(d.id, profile)) : []), [profile]);
  const bySlug = useMemo(() => new Map((works ?? []).map((w) => [w.slug, w])), [works]);
  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <ScreenHeader title={tr('tours.title')} subtitle={tr('design.pilotSubtitle')} />
        {!plans.some((plan) => plan?.stops.length) ? <EmptyState title={tr('tours.none')} /> : null}
        {plans.map((plan, i) => {
          if (!plan?.stops.length) return null;
          const id = TOURS[i]!.id;
          const title = tr(`tours.${id}.title` as MessageKey);
          const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));
          const access = plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.stairs', { n: plan.stairs });
          const meta = [tr('tours.stops', { n: plan.stops.length }), formatDistance(plan.lengthM, lang), tr('common.min', { n: minutes })].join(' · ');
          // Kapak: fotoğrafı olan ilk durak.
          const cover = plan.stops.map((st) => bySlug.get(st.slug)).map((w) => (w ? coverOf(w) : undefined)).find(Boolean);
          return (
            <Pressable
              key={id}
              onPress={() => router.push({ pathname: '/tour/[id]', params: { id } })}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${tr(`tours.${id}.body` as MessageKey)} ${meta}. ${access}`}
              accessibilityHint={tr('design.tourOpen')}
              style={({ pressed }) => [s.card, softShadow(t), { backgroundColor: t.surface }, !cover && s.compact, pressed && { opacity: 0.92 }]}>
              {cover ? (
                <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} style={s.img} contentFit="cover" transition={150} accessible={false} />
              ) : (
                // Fotoğrafı olmayan tur: büyük boş alan yerine küçük simgeli kare.
                <View style={[s.tile, { backgroundColor: t.soft }]}>
                  <WorkGlyphInline slug={plan.stops[0]!.type} color={t.primary} size={32} />
                </View>
              )}
              <View style={[s.cap, !cover && { flex: 1, paddingLeft: 0 }]}>
                <Text style={[type.title, { color: t.text, fontSize: 22, lineHeight: 28 }]}>{title}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>{meta}</Text>
                <Text style={[type.meta, { color: plan.stairs === 0 ? t.primary : t.accent, fontFamily: type.button.fontFamily }]}>{access}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xl },
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 16 / 9 },
  cap: { padding: space.lg, gap: 2 },
  compact: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg },
  tile: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginRight: space.lg },
});
