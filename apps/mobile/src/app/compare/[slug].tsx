import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors, UserProfile } from '@sezi/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeferredMap } from '@/components/deferred-map';
import { Badge } from '@/components/ui';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { boundsOf, planRoute, routeStats, walkingSpeed, type PlannedRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';

type ProfileKey = 'walker' | 'wheelchair' | 'blind';

/**
 * Profil karşılaştırması: aynı hedefe üç profilin rotası aynı haritada.
 * Sezi'nin farkını görünür kılar: rota kişinin algısına ve hareketine göre değişir.
 * Çizgiler renk yanında kalınlık ve kesiklikle de ayrışır (renk tek başına anlam taşımaz).
 */
export default function Compare() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();

  const rows = useMemo(() => {
    const base: UserProfile = { vision: 'full', mobility: 'none', hearing: 'full', senses: { audio: true, haptic: true, visual: true }, lang };
    const profiles: Record<ProfileKey, UserProfile> = {
      walker: base,
      wheelchair: { ...base, mobility: 'wheelchair' },
      blind: { ...base, vision: 'blind', mobility: 'cane', senses: { audio: true, haptic: true, visual: false } },
    };
    return (Object.keys(profiles) as ProfileKey[]).map((key) => {
      const p = profiles[key];
      const plan = planRoute(slug, p);
      return { key, profile: p, plan, stats: plan ? routeStats(plan) : null };
    });
  }, [slug, lang]);

  const style: Record<ProfileKey, { color: string; width: number; dash?: number[] }> = {
    walker: { color: t.text, width: 3 },
    wheelchair: { color: t.primary, width: 8 },
    blind: { color: t.accent, width: 5, dash: [1.4, 1] },
  };
  const shortest = Math.min(...rows.flatMap((r) => (r.stats ? [r.stats.lengthM] : [])));
  const all = rows.flatMap((r) => (r.plan ? r.plan.geometry.line : []));
  const end = rows.find((r) => r.plan)?.plan;
  const endName = end ? (end.end.name?.[lang] ?? end.end.name?.tr ?? '') : '';
  const yours = profile ? rows.find((r) => r.profile.mobility === profile.mobility && (r.profile.vision === 'blind') === (profile.vision === 'blind'))?.key : undefined;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: tr('compare.title') }} />
      <Text style={[type.title, { color: t.text }]} accessibilityRole="header">{endName}</Text>
      <Text style={[type.body, { color: t.text }]}>{tr('compare.lead')}</Text>

      {all.length > 1 ? (
        <View style={s.map} accessible accessibilityLabel={tr('compare.mapLabel')} importantForAccessibility="no-hide-descendants">
          <DeferredMap>
            <Camera initialViewState={{ bounds: boundsOf(all), padding: { top: 40, bottom: 40, left: 40, right: 40 } }} />
            {/* Kalın çizgi altta, ince üstte: üst üste binen rotalar da seçilebilir kalır. */}
            {(['wheelchair', 'blind', 'walker'] as ProfileKey[]).map((key) => {
              const plan = rows.find((r) => r.key === key)?.plan;
              if (!plan) return null;
              const st = style[key];
              return (
                <GeoJSONSource key={key} id={`route-${key}`} data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plan.geometry.line } }}>
                  <Layer
                    id={`route-${key}-line`}
                    type="line"
                    layout={{ 'line-cap': st.dash ? 'butt' : 'round', 'line-join': 'round' }}
                    paint={{ 'line-color': st.color, 'line-width': st.width, 'line-opacity': key === 'wheelchair' ? 0.55 : 1, ...(st.dash ? { 'line-dasharray': st.dash as never } : {}) }}
                  />
                </GeoJSONSource>
              );
            })}
            {end ? (
              <GeoJSONSource id="end" data={{ type: 'Point', coordinates: end.end.location }}>
                <Layer id="end-halo" type="circle" paint={{ 'circle-radius': 12, 'circle-color': t.surface }} />
                <Layer id="end-dot" type="circle" paint={{ 'circle-radius': 7, 'circle-color': t.danger }} />
              </GeoJSONSource>
            ) : null}
          </DeferredMap>
        </View>
      ) : null}

      {rows.map((r) => (
        <ProfileCard
          key={r.key}
          k={r.key}
          plan={r.plan}
          stats={r.stats}
          minutes={r.stats ? Math.max(1, Math.round(r.stats.lengthM / walkingSpeed(r.profile) / 60)) : 0}
          shortest={shortest}
          line={style[r.key]}
          isYou={yours === r.key}
          t={t}
          tr={tr}
        />
      ))}
    </ScrollView>
  );
}

function ProfileCard({
  k,
  plan,
  stats,
  minutes,
  shortest,
  line,
  isYou,
  t,
  tr,
}: {
  k: ProfileKey;
  plan: PlannedRoute | null;
  stats: ReturnType<typeof routeStats> | null;
  minutes: number;
  shortest: number;
  line: { color: string; width: number; dash?: number[] };
  isYou: boolean;
  t: ThemeColors;
  tr: ReturnType<typeof useT>['t'];
}) {
  const title = tr(`compare.${k}` as MessageKey);
  const facts = stats
    ? [
        tr('compare.length', { m: Math.round(stats.lengthM), min: minutes }),
        stats.stairs > 0 ? tr('compare.stairs', { n: stats.stairs }) : tr('compare.noStairs'),
        tr('compare.busy', { m: stats.busyM }),
        stats.cobbleM > 0 ? tr('compare.cobble', { m: stats.cobbleM }) : null,
        Math.round(stats.lengthM - shortest) > 5 ? tr('compare.diff', { m: Math.round(stats.lengthM - shortest) }) : tr('compare.shortest'),
      ].filter(Boolean)
    : [];
  return (
    <View
      style={[cardStyles.card, { borderColor: isYou ? t.primary : t.border, backgroundColor: t.surface }]}
      accessible
      accessibilityLabel={[title, isYou ? tr('compare.you') : null, ...(plan ? facts : [tr('compare.noRoute')]), tr(`compare.why.${k}` as MessageKey)].filter(Boolean).join('. ')}>
      <View style={cardStyles.head}>
        {/* Haritadaki çizginin küçük örneği. */}
        <View style={cardStyles.swatch}>
          {line.dash ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ width: 8, height: line.width, backgroundColor: line.color }} />)}
            </View>
          ) : (
            <View style={{ width: 32, height: line.width, borderRadius: line.width, backgroundColor: line.color }} />
          )}
        </View>
        <Text style={[type.itemTitle, { color: t.text, flex: 1 }]}>{title}</Text>
        {isYou ? <Badge label={tr('compare.you')} tone="primary" /> : null}
      </View>
      {plan ? facts.map((f) => <Text key={f} style={[type.body, { color: t.text }]}>{f}</Text>) : <Text style={[type.body, { color: t.danger }]}>{tr('compare.noRoute')}</Text>}
      <Text style={[type.meta, { color: t.textMuted }]}>{tr(`compare.why.${k}` as MessageKey)}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{`${tr('compare.legend')}: ${tr(`compare.line.${k}` as MessageKey)}`}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  swatch: { width: 40, alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.lg, paddingBottom: 56 },
    map: { height: 340, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  });
