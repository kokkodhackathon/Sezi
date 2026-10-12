import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Badge } from '@/components/ui';
import { ChevronIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { planTour, TOURS } from '@/lib/tours';

export default function Tours() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const { profile } = useProfile();
  const plans = useMemo(() => (profile ? TOURS.map((d) => planTour(d.id, profile)) : []), [profile]);
  if (!profile) return null;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <ScreenHeader eyebrow={tr('tours.eyebrow')} title={tr('tours.title')} subtitle={tr('tours.subtitle')} />
        {plans.map((plan, i) => {
          if (!plan || plan.stops.length === 0) return null;
          const id = TOURS[i]!.id;
          const title = tr(`tours.${id}.title` as MessageKey);
          const body = tr(`tours.${id}.body` as MessageKey);
          const minutes = Math.max(1, Math.round(plan.lengthM / walkingSpeed(profile) / 60));
          const glyphs = [...new Set(plan.stops.map((x) => x.type))].slice(0, 4);
          return (
            <Pressable
              key={id}
              onPress={() => router.push({ pathname: '/tour/[id]', params: { id } })}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${body} ${tr('tours.stops', { n: plan.stops.length })}, ${Math.round(plan.lengthM)} m, ${tr('common.min', { n: minutes })}. ${plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.stairs', { n: plan.stairs })}`}
              style={({ pressed }) => [s.card, pressed && { backgroundColor: t.background }]}>
              <View style={s.glyphs}>
                {glyphs.map((g, k) => (
                  <View key={g} style={[s.glyphWrap, { marginLeft: k === 0 ? 0 : -14, zIndex: 10 - k, borderColor: t.surface }]}>
                    <WorkGlyph slug={g} size={44} />
                  </View>
                ))}
              </View>
              <View style={{ gap: space.xs }}>
                <Text style={[type.title, { color: t.text, fontSize: 24, lineHeight: 30 }]}>{title}</Text>
                <Text style={[type.body, { color: t.textMuted }]}>{body}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={[type.button, { color: t.text, fontSize: 15 }]}>
                  {tr('tours.stops', { n: plan.stops.length })} · {Math.round(plan.lengthM)} m · {tr('common.min', { n: minutes })}
                </Text>
                <View style={{ flex: 1 }} />
                <ChevronIcon color={t.textMuted} />
              </View>
              <Badge label={plan.stairs === 0 ? tr('tours.stepFree') : tr('tours.stairs', { n: plan.stairs })} tone={plan.stairs === 0 ? 'primary' : 'accent'} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.lg },
    card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    glyphs: { flexDirection: 'row' },
    glyphWrap: { borderWidth: 3, borderRadius: 16 },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
  });
