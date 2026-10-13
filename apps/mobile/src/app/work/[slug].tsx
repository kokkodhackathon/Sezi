import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import * as Speech from 'expo-speech';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { DeferredMap } from '@/components/deferred-map';
import { Badge, Button, Card, ListRow, Note, SectionTitle, EmptyState } from '@/components/ui';
import { ExternalIcon, InfoIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { radius, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { hasRouteTo, planRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { hasLocation, inventorySource, loc, useWork, type WorkRow } from '@/lib/works';

export default function WorkDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const { data: work, isLoading, error } = useWork(slug);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.primary} accessibilityLabel={tr('work.loading')} />
      </View>
    );
  }
  if (error || !work) {
    return (
      <View style={s.center}><EmptyState title={error ? tr('work.error') : tr('work.notFound')} /></View>
    );
  }
  return <Detail work={work} t={t} s={s} />;
}

function Detail({ work, t, s }: { work: WorkRow; t: ThemeColors; s: ReturnType<typeof makeStyles> }) {
  const [speaking, setSpeaking] = useState(false);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { visited, settings } = useSettings();
  const name = loc(work.name, lang);
  const kind = loc(work.type_name, lang);
  const city = loc(work.city_name, lang);
  const complex = loc(work.complex_name, lang);
  const history = loc(work.history, lang);
  const architecture = loc(work.architecture, lang);
  const period = loc(work.period, lang);
  const address = loc(work.address, lang);
  const isVisited = visited.includes(work.slug);
  const inv = inventorySource(work);
  const otherSources = work.sources.filter((x) => x.kind !== 'inventory');
  const access = profile && hasRouteTo(work.slug) ? planRoute(work.slug, profile) : null;
  const canHear = profile?.hearing !== 'deaf';
  const showTranscript = profile?.hearing === 'hard' || profile?.hearing === 'deaf';
  const place = work.district ? tr('work.district', { district: work.district, city }) : city;

  useEffect(() => () => void Speech.stop(), []);

  const narration = [name, kind, place, period, complex && tr('work.partOf', { complex }), history || tr('work.historyInBook')]
    .filter(Boolean)
    .join('. ');
  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(narration, {
      language: lang === 'tr' ? 'tr-TR' : 'en-US',
      rate: settings.speechRate,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const citation = inv
    ? `${name}. ${inv.title}${inv.page ? `, ${tr('inv.refPage', { page: inv.page })}` : ''}. Vakıf Katılım${inv.year ? `, ${inv.year}` : ''}.${inv.url ? ` ${inv.url}` : ''}`
    : null;


  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />
      <View style={s.hero}>
        <View style={s.kind}><WorkGlyphInline slug={work.type_slug} color={t.primary} size={24} /><Text style={[type.meta, { color: t.primary }]}>{kind}</Text></View>
        <Text style={[type.editorial, { color: t.text }]} accessibilityRole="header">{name}</Text>
        <Text style={[type.body, { color: t.textMuted }]}>{[place, complex].filter(Boolean).join(' · ')}</Text>
        {inv ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('design.inventory')} · {inv.volume && inv.page ? tr('inv.refShort', { v: inv.volume, page: inv.page }) : inv.page ? tr('inv.refPage', { page: inv.page }) : inv.title}</Text> : null}
        <View style={s.badges}>
          {isVisited ? <Badge label={tr('work.visited')} tone="primary" /> : null}
          {work.unesco ? <Badge label={tr('work.unesco')} tone="primary" /> : null}
          {work.condition !== 'unknown' ? <Badge label={tr(`work.condition.${work.condition}` as MessageKey)} tone={work.condition === 'destroyed' || work.condition === 'damaged' ? 'danger' : 'neutral'} /> : null}
        </View>
      </View>
      {work.condition_note ? <Note text={loc(work.condition_note, lang)} icon={<InfoIcon color={t.textMuted} />} /> : null}
      {hasRouteTo(work.slug) ? <Button label={tr('work.directions')} icon={(c) => <TurnIcon turn="slight_right" color={c} />} onPress={() => router.push({ pathname: '/route/[slug]', params: { slug: work.slug } })} /> : null}

      <Section title={tr('work.history')} t={t}>
        {period ? <Text style={[type.itemTitle, { color: t.text }]}>{period}</Text> : null}
        {canHear ? <Button variant="outline" label={speaking ? tr('work.stop') : tr('work.listen')} onPress={toggleSpeech} icon={(c) => speaking ? <StopIcon color={c} /> : <PlayIcon color={c} />} /> : null}
        {history ? <Text style={[type.body, { color: t.text }]}>{history}</Text> : <Text style={[type.body, { color: t.textMuted }]}>{tr('work.historyInBook')}</Text>}
        {architecture ? <Text style={[type.body, { color: t.text }]}>{architecture}</Text> : null}
        {showTranscript ? <View style={{ gap: 8 }}><Text style={[type.heading, { color: t.text }]}>{tr('work.transcript')}</Text><Text style={[type.body, { color: t.text }]}>{narration}</Text></View> : null}
      </Section>

      <Section title={tr('design.location')} t={t}>
        {address ? <Text style={[type.body, { color: t.text }]}>{address}</Text> : null}
        {hasLocation(work) ? <>
          <View style={s.map} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <DeferredMap dragPan={false} touchZoom={false} touchRotate={false}>
              <Camera initialViewState={{ center: [work.lng, work.lat], zoom: work.location_precision === 'exact' ? 17 : 15 }} />
              <GeoJSONSource id="work" data={{ type: 'Point', coordinates: [work.lng, work.lat] }}>
                {work.location_precision !== 'exact' ? <Layer id="work-area" type="circle" paint={{ 'circle-radius': 46, 'circle-color': t.primary, 'circle-opacity': 0.14, 'circle-stroke-width': 2, 'circle-stroke-color': t.primary }} /> : null}
                <Layer id="work-halo" type="circle" paint={{ 'circle-radius': 18, 'circle-color': t.surface }} />
                <Layer id="work-circle" type="circle" paint={{ 'circle-radius': 10, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
              </GeoJSONSource>
            </DeferredMap>
          </View>
          {work.location_precision !== 'exact' ? <Note text={tr('work.locApprox')} icon={<InfoIcon color={t.textMuted} />} /> : null}
        </> : <Note text={tr('work.locUnknown')} icon={<InfoIcon color={t.textMuted} />} />}
      </Section>

      {access ? <Section title={tr('work.access')} t={t}><Card padded={false}>
        <ListRow first title={access.stairSegments === 0 ? tr('work.accessStepFree') : tr('work.accessStairs', { n: access.stairSegments })} subtitle={tr('work.accessRoute', { m: Math.round(access.route.lengthM) })} />
        <ListRow title={tr('work.report')} hint={tr('work.reportHint')} onPress={() => router.push({ pathname: '/report/new', params: { work: work.slug } })} />
      </Card></Section> : null}

      {work.exhibitions.length ? <Section title={tr('work.exhibitions')} t={t}><Card padded={false}>{work.exhibitions.map((e, i) => <ListRow key={e.slug} first={i === 0} title={loc(e.title, lang)} subtitle={loc(e.venue, lang)} onPress={() => router.push('/exhibitions')} />)}</Card></Section> : null}

      <Section title={tr('work.sources')} t={t}>
        {inv ? <View style={s.inventory}>
          <Text style={[type.itemTitle, { color: t.text }]}>{inv.title}</Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{[inv.volume ? tr('city.volume', { v: inv.volume }) : null, inv.page ? tr('inv.refPage', { page: inv.page }) : null, 'Vakıf Katılım', inv.year ? String(inv.year) : null].filter(Boolean).join(' · ')}</Text>
          {inv.section ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.inventorySection', { section: loc(inv.section, lang) })}</Text> : null}
          {inv.url ? <Button variant="outline" label={tr('inv.openBook')} hint={tr('inv.openBookHint')} icon={(c) => <ExternalIcon color={c} />} onPress={() => Linking.openURL(inv.url!)} /> : null}
          {citation ? <Button variant="ghost" label={tr('inv.cite')} onPress={() => Share.share({ message: citation })} /> : null}
        </View> : null}
        {otherSources.length === 0 && !inv ? <Text style={[type.body, { color: t.textMuted }]}>{tr('work.noSources')}</Text> : null}
        {otherSources.map((src) => <ListRow key={src.id} title={src.title} subtitle={[src.publisher, src.year, src.page && tr('inv.refPage', { page: src.page })].filter(Boolean).join(' · ')} hint={src.url ? tr('work.sourceHint') : undefined} onPress={src.url ? () => Linking.openURL(src.url!) : undefined} trailing={src.url ? <ExternalIcon color={t.primary} /> : null} />)}
      </Section>
      <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.noGallery')}</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; t: ThemeColors; children: ReactNode }) {
  return <View style={{ gap: 16 }}><SectionTitle title={title} />{children}</View>;
}
const makeStyles = (t: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  body: { paddingHorizontal: 24, paddingTop: 8, gap: 28, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: t.background },
  hero: { gap: 12, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: t.border },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  map: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: t.surface },
  inventory: { gap: 12, padding: 20, borderWidth: 1, borderColor: t.border, borderRadius: radius.lg, backgroundColor: t.surface },
});
