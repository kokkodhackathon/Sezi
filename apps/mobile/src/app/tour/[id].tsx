import type { ThemeColors } from '@sezi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, EmptyState, SectionTitle } from '@/components/ui';
import { ChevronIcon, TurnIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { colorForType, WorkGlyphInline } from '@/design/work-glyph';
import { Image } from 'expo-image';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { defaultStart, useNavVersion, walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { planTour } from '@/lib/tours';
import { coverOf, photoUrl, useWorks } from '@/lib/works';

export default function TourDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { visited } = useSettings();
  const navVersion = useNavVersion();
  const plan = useMemo(
    () => (profile ? planTour(id, profile, defaultStart()) : null),
    // navVersion: başlangıç noktaları ve onaylı bildirimler değişince tur yeniden hesaplanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, profile, navVersion],
  );
  const { data: works } = useWorks('bursa');
  const bySlug = useMemo(() => new Map((works ?? []).map((w) => [w.slug, w])), [works]);

  if (!profile || !plan || plan.stops.length === 0) {
    return (
      <View style={s.center}>
        <EmptyState title={tr('tours.none')} />
      </View>
    );
  }

  const title = tr(`tours.${id}.title` as MessageKey);
  const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: space.xs }}>
        <Text style={[type.title, { color: t.text, fontSize: 30, lineHeight: 36 }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[type.body, { color: t.textMuted }]}>{tr(`tours.${id}.body` as MessageKey)}</Text>
      </View>

      <View style={s.stats}>
        <Stat value={String(plan.stops.length)} label={tr('tours.stopsTitle')} t={t} />
        <Stat value={`${Math.round(plan.lengthM)} m`} label={tr('tours.statWalk', { n: minutes })} t={t} />
        <Stat value={String(plan.stairs)} label={plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.statStairs')} t={t} />
      </View>

      <Button
        label={tr('tours.start')}
        onPress={() => router.push({ pathname: '/navigate', params: { tour: plan.stops.map((x) => x.slug).join(',') } })}
        icon={(c) => <TurnIcon turn="slight_right" color={c} size={22} />}
      />

      <SectionTitle title={tr('tours.stopsTitle')} />
      <View>
        {plan.stops.map((stop, i) => {
          const name = stop.name[lang] ?? stop.name.tr;
          const isVisited = visited.includes(stop.slug);
          const last = i === plan.stops.length - 1;
          return (
            <View key={stop.slug} style={s.stopRow}>
              {/* Zaman çizgisi: durak numarası ve aradaki bağlantı çizgisi */}
              <View style={s.rail} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <View style={[s.dot, { backgroundColor: isVisited ? t.primary : t.surface, borderColor: t.primary }]}>
                  <Text style={[type.button, { fontSize: 14, color: isVisited ? t.onPrimary : t.primary }]}>{i + 1}</Text>
                </View>
                {!last ? <View style={[s.line, { backgroundColor: t.border }]} /> : null}
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: stop.slug } })}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${name}. ${tr('tours.leg', { m: Math.round(stop.legM) })}${isVisited ? `. ${tr('work.visited')}` : ''}`}
                style={({ pressed }) => [s.stopCard, pressed && { backgroundColor: t.background }]}>
                {(() => {
                  const w = bySlug.get(stop.slug);
                  const c = w ? coverOf(w) : undefined;
                  return c ? (
                    <Image source={{ uri: photoUrl(c, 'thumb') }} style={s.thumb} contentFit="cover" accessible={false} />
                  ) : (
                    <View style={[s.thumb, { backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center' }]}>
                      <WorkGlyphInline slug={stop.type} color={colorForType(stop.type)} size={24} />
                    </View>
                  );
                })()}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[type.itemTitle, { color: t.text }]}>{name}</Text>
                  <Text style={[type.meta, { color: t.textMuted }]}>{tr('tours.leg', { m: Math.round(stop.legM) })}</Text>
                  {isVisited ? <Badge label={tr('work.visited')} tone="primary" /> : null}
                  {stop.legStairs > 0 ? <Badge label={tr('tours.stairs', { n: stop.legStairs })} tone="accent" /> : null}
                </View>
                <ChevronIcon color={t.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text style={[type.meta, { color: t.textMuted }]}>{tr('route.dataNote')}</Text>
    </ScrollView>
  );
}

function Stat({ value, label, t }: { value: string; label: string; t: ThemeColors }) {
  return (
    <View style={statStyle.box} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[type.title, { color: t.text, fontSize: 24, lineHeight: 30 }]}>{value}</Text>
      <Text style={[type.meta, { color: t.textMuted }]} >
        {label}
      </Text>
    </View>
  );
}

const statStyle = StyleSheet.create({ box: { flexGrow: 1, flexBasis: 100, paddingVertical: space.md, gap: 4 } });

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, padding: space.xl, justifyContent: 'center', backgroundColor: t.background },
    stats: { flexWrap: 'wrap', flexDirection: 'row', gap: space.sm },
    stopRow: { flexDirection: 'row', gap: space.md },
    rail: { width: 36, alignItems: 'center' },
    dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    line: { width: 2, flex: 1, marginVertical: 4 },
    stopCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.sm,
      marginBottom: space.md,
      borderRadius: radius.lg,
    },
    thumb: { width: 64, height: 64, borderRadius: radius.lg },
  });
