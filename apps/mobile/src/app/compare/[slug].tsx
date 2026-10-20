import type { LngLat, SweetTheme, UserProfile } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EndPin, ExtraLines, PointsLayer, SeziMap, type SeziMapHandle } from '@/components/map';
import { Badge, Chip, Note } from '@/components/ui';
import { CheckIcon, CloseIcon, MapIcon } from '@/design/icons';
import { SoftPressable, sweetShadow } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { formatDistance, inPilotArea, pilotWorks, planRoute, routeStats, startLocation, useNavVersion, useStartPoints, walkingSpeed, type PlannedRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';

type ProfileKey = 'walker' | 'wheelchair' | 'blind';
const KEYS: ProfileKey[] = ['walker', 'wheelchair', 'blind'];
type Start = { kind: 'point'; id: string } | { kind: 'pick'; location: LngLat };

const DESTINATIONS = [...pilotWorks].sort((a, b) => (a.name?.tr ?? '').localeCompare(b.name?.tr ?? '', 'tr'));

/**
 * Profil karşılaştırması: aynı başlangıçtan aynı hedefe üç profilin rotası aynı haritada.
 * Başlangıç bir başlangıç noktası ya da haritada seçilen yer; hedef değiştirilebilir.
 * Seçili profilin çizgisi öne çıkar; çizgiler renk yanında kalınlık ve kesiklikle de ayrışır.
 */
export default function Compare() {
  const params = useLocalSearchParams<{ slug: string }>();
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { profile } = useProfile();
  const starts = useStartPoints();
  const navVersion = useNavVersion();
  const mapRef = useRef<SeziMapHandle>(null);
  const [dest, setDest] = useState(params.slug);
  const [start, setStart] = useState<Start | null>(null);
  const [picking, setPicking] = useState(false);

  const base: UserProfile = useMemo(() => ({ vision: 'full', mobility: 'none', hearing: 'full', senses: { audio: true, haptic: true, visual: true }, lang }), [lang]);
  const profiles: Record<ProfileKey, UserProfile> = useMemo(
    () => ({ walker: base, wheelchair: { ...base, mobility: 'wheelchair' }, blind: { ...base, vision: 'blind', mobility: 'cane', senses: { audio: true, haptic: true, visual: false } } }),
    [base],
  );
  // Kullanıcının profiline en yakın satır başta seçili gelir.
  const yours: ProfileKey = profile?.mobility === 'wheelchair' ? 'wheelchair' : profile?.vision === 'blind' ? 'blind' : 'walker';
  const [selected, setSelected] = useState<ProfileKey>(yours);

  const from: LngLat = start?.kind === 'pick' ? start.location : startLocation(start?.kind === 'point' ? start.id : starts[0]?.id);
  const outside = !inPilotArea(from);
  const rows = useMemo(
    () =>
      KEYS.map((key) => {
        const plan = outside ? null : planRoute(dest, profiles[key], from, { leadIn: start?.kind === 'pick' });
        return { key, plan, stats: plan ? routeStats(plan) : null, minutes: plan ? Math.max(1, Math.round(plan.route.lengthM / walkingSpeed(profiles[key]) / 60)) : 0 };
      }),
    // navVersion: nokta ya da bildirim değişince rotalar yeniden hesaplanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dest, from[0], from[1], profiles, navVersion, outside],
  );
  const shortest = Math.min(...rows.flatMap((r) => (r.stats ? [r.stats.lengthM] : [])));
  const all = rows.flatMap((r) => (r.plan ? r.plan.geometry.line : []));
  const end = DESTINATIONS.find((n) => n.workSlug === dest);
  const endName = end ? (end.name?.[lang] ?? end.name?.tr ?? '') : '';

  useEffect(() => {
    if (all.length > 1) mapRef.current?.fit(all, { top: insets.top + 72, bottom: 40 });
    // Rota kümesi değişince (başlangıç, hedef) yeniden sığdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const line: Record<ProfileKey, { color: string; width: number; dash?: number[] }> = {
    walker: { color: t.text, width: 4 },
    wheelchair: { color: t.primaryText, width: 9 },
    blind: { color: t.accentText, width: 5, dash: [1.4, 1] },
  };

  return (
    <View style={s.screen}>
      <SeziMap
        ref={mapRef}
        style={{ height: Math.round(height * 0.42) }}
        initial={all.length > 1 ? all : [from]}
        initialPadding={{ top: insets.top + 72 }}
        onPress={(p) => {
          if (!picking) return;
          setPicking(false);
          setStart({ kind: 'pick', location: p });
        }}
        accessibilityLabel={tr('compare.mapLabel')}>
        {/* Seçili profil en üstte çizilir; diğerleri soluk. */}
        {[...KEYS.filter((k) => k !== selected), selected].map((k) => {
          const plan = rows.find((r) => r.key === k)?.plan;
          if (!plan) return null;
          const st = line[k];
          return <ExtraLines key={k} id={`route-${k}`} data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plan.geometry.line } }} color={st.color} width={st.width} dashed={!!st.dash} opacity={k === selected ? 1 : 0.35} />;
        })}
        <PointsLayer
          points={starts.map((p) => ({ id: p.id, location: p.location, kind: 'start', label: p.name[lang] ?? p.name.tr, selected: start?.kind === 'point' ? start.id === p.id : !start && p.id === starts[0]?.id }))}
          onPress={(id) => !picking && setStart({ kind: 'point', id })}
        />
        <EndPin id="start" location={from} kind="start" />
        {end ? <EndPin id="end" location={end.location} kind="end" /> : null}
      </SeziMap>

      <View style={[s.mapBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <SoftPressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('nav.close')} style={[s.round, { backgroundColor: t.surface }, sweetShadow(t)]}>
          <CloseIcon color={t.text} />
        </SoftPressable>
      </View>
      {picking ? (
        <View style={[s.pickBanner, { top: insets.top + 72 }, sweetShadow(t)]} accessibilityLiveRegion="polite">
          <Text style={[type.button, { color: t.primary.ink }]}>{tr('nav.pickHint')}</Text>
        </View>
      ) : null}

      <View style={s.panel}>
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={{ gap: space.xs }}>
            <Text style={[type.eyebrow, { color: t.primaryText }]}>{tr('compare.title')}</Text>
            <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
              {endName}
            </Text>
            <Text style={[type.body, { color: t.textMuted }]}>{tr('compare.lead')}</Text>
          </View>

          <View style={{ gap: space.sm }}>
            <Text style={s.label}>{tr('nav.from')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipScroll}>
              <Chip label={start?.kind === 'pick' ? tr('nav.picked') : tr('nav.pickOnMap')} selected={start?.kind === 'pick' || picking} onPress={() => setPicking(!picking)} icon={(c) => <MapIcon color={c} size={18} />} />
              {starts.map((p) => (
                <Chip key={p.id} label={p.name[lang] ?? p.name.tr} selected={start?.kind === 'point' ? start.id === p.id : !start && p.id === starts[0]?.id} onPress={() => setStart({ kind: 'point', id: p.id })} />
              ))}
            </ScrollView>
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={s.label}>{tr('nav.to')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipScroll}>
              {DESTINATIONS.map((n) => (
                <Chip key={n.id} label={n.name?.[lang] ?? n.name?.tr ?? ''} selected={dest === n.workSlug} onPress={() => setDest(n.workSlug!)} />
              ))}
            </ScrollView>
          </View>
          {outside ? <Note text={tr('nav.note.outside_pilot')} /> : null}

          <View style={{ gap: space.md }} accessibilityRole="radiogroup" accessibilityLabel={tr('compare.pick')}>
            {rows.map((r) => (
              <ProfileCard
                key={r.key}
                k={r.key}
                plan={r.plan}
                stats={r.stats}
                minutes={r.minutes}
                shortest={shortest}
                line={line[r.key]}
                isYou={yours === r.key}
                selected={selected === r.key}
                onPress={() => setSelected(r.key)}
                t={t}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
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
  selected,
  onPress,
  t,
}: {
  k: ProfileKey;
  plan: PlannedRoute | null;
  stats: ReturnType<typeof routeStats> | null;
  minutes: number;
  shortest: number;
  line: { color: string; width: number; dash?: number[] };
  isYou: boolean;
  selected: boolean;
  onPress: () => void;
  t: SweetTheme;
}) {
  const { t: tr, lang } = useT();
  const title = tr(`compare.${k}` as MessageKey);
  const diff = stats ? Math.round(stats.lengthM - shortest) : 0;
  const facts = stats
    ? [
        { label: tr('compare.statLength'), value: `${formatDistance(stats.lengthM, lang)} · ${tr('nav.minutes', { n: minutes })}` },
        { label: tr('compare.statStairs'), value: stats.stairs > 0 ? String(stats.stairs) : tr('compare.none') },
        { label: tr('compare.statBusy'), value: `${stats.busyM} m` },
        { label: tr('compare.statCobble'), value: `${stats.cobbleM} m` },
        { label: tr('compare.statPoints'), value: String(plan?.via.pointIds.length ?? 0) },
      ]
    : [];
  const summary = stats ? (diff > 5 ? tr('compare.diff', { m: diff }) : tr('compare.shortest')) : tr('compare.noRoute');
  return (
    <SoftPressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, isYou ? tr('compare.you') : null, summary, ...facts.map((f) => `${f.label}: ${f.value}`), tr(`compare.why.${k}` as MessageKey)].filter(Boolean).join('. ')}
      style={[cardStyles.card, { backgroundColor: t.surface, borderColor: selected ? t.primaryText : t.outlined ? t.border : 'transparent' }]}>
      <View style={cardStyles.head}>
        {/* Haritadaki çizginin küçük örneği. */}
        <View style={cardStyles.swatch}>
          {line.dash ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ width: 8, height: line.width, backgroundColor: line.color }} />
              ))}
            </View>
          ) : (
            <View style={{ width: 32, height: line.width, borderRadius: line.width, backgroundColor: line.color }} />
          )}
        </View>
        <Text style={[selected ? type.heading : type.itemTitle, { color: t.text, flex: 1 }]}>{title}</Text>
        {isYou ? <Badge label={tr('compare.you')} tone="primary" /> : null}
        <View style={[cardStyles.check, selected ? { backgroundColor: t.primary.fill, borderColor: t.primaryText } : { backgroundColor: t.soft, borderColor: t.border }]}>
          {selected ? <CheckIcon color={t.primary.ink} size={16} /> : null}
        </View>
      </View>
      <Text style={[type.button, { color: stats ? t.text : t.danger }]}>{summary}</Text>
      {stats ? (
        <View style={cardStyles.grid}>
          {facts.map((f) => (
            <View key={f.label} style={cardStyles.fact}>
              <Text style={[type.meta, { color: t.textMuted }]}>{f.label}</Text>
              <Text style={[type.button, { color: t.text }]}>{f.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {selected ? <Text style={[type.meta, { color: t.textMuted }]}>{tr(`compare.why.${k}` as MessageKey)}</Text> : null}
    </SoftPressable>
  );
}

const cardStyles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 40, alignItems: 'center', justifyContent: 'center' },
  check: { width: 28, height: 28, borderRadius: radius.pill, borderCurve: 'continuous', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  fact: { width: '50%', gap: 2 },
});

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    mapBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row' },
    round: { width: 48, height: 48, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
    pickBanner: { position: 'absolute', alignSelf: 'center', backgroundColor: t.primary.fill, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderCurve: 'continuous' },
    panel: { flex: 1, marginTop: -radius.xl, backgroundColor: t.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderCurve: 'continuous' },
    body: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.lg },
    label: { ...type.eyebrow, color: t.textMuted },
    chips: { gap: space.sm, paddingHorizontal: space.xl },
    chipScroll: { marginHorizontal: -space.xl },
  });
