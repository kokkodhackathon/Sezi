import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import * as Speech from 'expo-speech';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { DeferredMap } from '@/components/deferred-map';
import { Badge, Button, Card, ListRow, Note } from '@/components/ui';
import { ExternalIcon, InfoIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { CengelMark, KilimBand } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { colorForType, WorkGlyph, WorkGlyphInline } from '@/design/work-glyph';
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
      <View style={s.center}>
        <Text style={[type.body, { color: t.text }]}>{error ? tr('work.error') : tr('work.notFound')}</Text>
      </View>
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
    });
  };

  const citation = inv
    ? `${name}. ${inv.title}${inv.page ? `, ${tr('inv.refPage', { page: inv.page })}` : ''}. Vakıf Katılım${inv.year ? `, ${inv.year}` : ''}.${inv.url ? ` ${inv.url}` : ''}`
    : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />

      <View style={s.hero}>
        <WorkGlyph slug={work.type_slug} size={72} />
        <View style={s.heroText}>
          <Text style={[type.eyebrow, { color: t.primary }]}>{upper(kind, lang)}</Text>
          <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
            {name}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{[place, complex].filter(Boolean).join(' · ')}</Text>
          {address ? <Text style={[type.meta, { color: t.textMuted }]}>{address}</Text> : null}
          <View style={s.badges}>
            {isVisited ? <Badge label={tr('work.visited')} tone="primary" /> : null}
            {work.unesco ? <Badge label={tr('work.unesco')} tone="primary" /> : null}
            {work.condition !== 'unknown' ? (
              <Badge
                label={tr(`work.condition.${work.condition}` as MessageKey)}
                tone={work.condition === 'destroyed' || work.condition === 'damaged' ? 'danger' : 'neutral'}
              />
            ) : null}
          </View>
        </View>
      </View>

      {work.condition_note ? <Note text={loc(work.condition_note, lang)} icon={<InfoIcon color={t.textMuted} />} /> : null}

      <View style={{ gap: space.md }}>
        {canHear ? (
          <Pressable
            onPress={toggleSpeech}
            accessibilityRole="button"
            accessibilityState={{ busy: speaking }}
            style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.88 }]}>
            {speaking ? <StopIcon color={t.onPrimary} /> : <PlayIcon color={t.onPrimary} />}
            <Text style={[type.button, { color: t.onPrimary }]}>{speaking ? tr('work.stop') : tr('work.listen')}</Text>
          </Pressable>
        ) : null}
        {hasRouteTo(work.slug) ? (
          <Button
            variant="outline"
            label={tr('work.directions')}
            icon={(c) => <TurnIcon turn="slight_right" color={c} size={22} />}
            onPress={() => router.push({ pathname: '/route/[slug]', params: { slug: work.slug } })}
          />
        ) : null}
      </View>

      {/* İşitme engelli ve az duyan kullanıcı: sesli anlatımın tam metni her zaman ekranda */}
      {showTranscript ? (
        <Card style={{ gap: space.sm }}>
          <Text style={[type.eyebrow, { color: t.primary }]}>{upper(tr('work.transcript'), lang)}</Text>
          <Text style={[type.body, { color: t.text }]}>{narration}</Text>
        </Card>
      ) : null}

      {hasLocation(work) ? (
        <View style={{ gap: space.sm }}>
          <View style={s.map} accessible accessibilityLabel={tr('work.mapLabel', { name })} importantForAccessibility="no-hide-descendants">
            <DeferredMap dragPan={false} touchZoom={false} touchRotate={false}>
              <Camera initialViewState={{ center: [work.lng, work.lat], zoom: work.location_precision === 'exact' ? 17 : 15 }} />
              <GeoJSONSource id="work" data={{ type: 'Point', coordinates: [work.lng, work.lat] }}>
                {work.location_precision !== 'exact' ? (
                  <Layer
                    id="work-area"
                    type="circle"
                    paint={{
                      'circle-radius': 46,
                      'circle-color': colorForType(work.type_slug),
                      'circle-opacity': 0.14,
                      'circle-stroke-width': 2,
                      'circle-stroke-color': colorForType(work.type_slug),
                      'circle-stroke-opacity': 0.5,
                    }}
                  />
                ) : null}
                <Layer id="work-halo" type="circle" paint={{ 'circle-radius': 18, 'circle-color': t.surface, 'circle-opacity': 0.9 }} />
                <Layer
                  id="work-circle"
                  type="circle"
                  paint={{ 'circle-radius': 11, 'circle-color': colorForType(work.type_slug), 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }}
                />
              </GeoJSONSource>
            </DeferredMap>
          </View>
          {work.location_precision !== 'exact' ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.locApprox')}</Text> : null}
        </View>
      ) : (
        <Note text={tr('work.locUnknown')} icon={<InfoIcon color={t.textMuted} />} />
      )}

      {t.motifOpacity > 0 ? (
        <View style={s.band}>
          <KilimBand color={t.accent} accent={t.primary} height={10} opacity={0.6} />
        </View>
      ) : null}

      <Section title={tr('work.history')} t={t}>
        {period ? <Text style={[type.itemTitle, { color: t.text }]}>{period}</Text> : null}
        {history ? (
          <Text style={[type.body, { color: t.text }]}>{history}</Text>
        ) : (
          <Note
            text={inv?.page ? `${tr('work.historyInBook')} (${tr('inv.ref', { book: inv.title, page: inv.page })})` : tr('work.historyInBook')}
            icon={<InfoIcon color={t.textMuted} />}
          />
        )}
        {architecture ? <Text style={[type.body, { color: t.text }]}>{architecture}</Text> : null}
      </Section>

      <Section title={tr('work.gallery')} t={t}>
        <View style={s.gallery}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[s.galleryTile, { borderColor: t.border, backgroundColor: t.surface }]}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colorForType(work.type_slug), opacity: 0.06 + i * 0.04, borderRadius: radius.md }]} />
              <WorkGlyphInline slug={work.type_slug} color={colorForType(work.type_slug)} size={28} />
            </View>
          ))}
        </View>
        <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.noGallery')}</Text>
      </Section>

      {access ? (
        <Section title={tr('work.access')} t={t}>
          <Card padded={false}>
            <ListRow
              first
              title={access.stairSegments === 0 ? tr('work.accessStepFree') : tr('work.accessStairs', { n: access.stairSegments })}
              subtitle={tr('work.accessRoute', { m: Math.round(access.route.lengthM) })}
            />
            <ListRow title={tr('work.report')} hint={tr('work.reportHint')} onPress={() => router.push({ pathname: '/report/new', params: { work: work.slug } })} />
          </Card>
        </Section>
      ) : null}

      {work.exhibitions.length ? (
        <Section title={tr('work.exhibitions')} t={t}>
          <Card padded={false}>
            {work.exhibitions.map((e, i) => (
              <ListRow key={e.slug} first={i === 0} title={loc(e.title, lang)} subtitle={loc(e.venue, lang)} onPress={() => router.push('/exhibitions')} />
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={tr('work.sources')} t={t}>
        {inv ? (
          <View style={[s.invCard, { borderColor: t.primary }]}>
            <Text style={[type.eyebrow, { color: t.primary }]}>{upper(tr('inv.eyebrow'), lang)}</Text>
            <Text style={[type.itemTitle, { color: t.text }]}>{inv.title}</Text>
            <Text style={[type.meta, { color: t.textMuted }]}>
              {[inv.page ? tr('inv.refPage', { page: inv.page }) : null, 'Vakıf Katılım', inv.year ? String(inv.year) : null].filter(Boolean).join(' · ')}
            </Text>
            {inv.section ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.inventorySection', { section: loc(inv.section, lang) })}</Text> : null}
            <View style={s.invActions}>
              {inv.url ? (
                <Button compact label={tr('inv.openBook')} hint={tr('inv.openBookHint')} icon={(c) => <ExternalIcon color={c} />} onPress={() => Linking.openURL(inv.url!)} />
              ) : null}
              {citation ? <Button compact variant="outline" label={tr('inv.cite')} onPress={() => Share.share({ message: citation })} /> : null}
            </View>
          </View>
        ) : null}
        {otherSources.length === 0 && !inv ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.noSources')}</Text> : null}
        {otherSources.map((src) => (
          <Pressable
            key={src.id}
            disabled={!src.url}
            onPress={() => src.url && Linking.openURL(src.url)}
            accessibilityRole={src.url ? 'link' : 'text'}
            accessibilityHint={src.url ? tr('work.sourceHint') : undefined}
            style={({ pressed }) => [s.source, pressed && { backgroundColor: t.background }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{src.title}</Text>
              <Text style={[type.meta, { color: t.textMuted }]}>
                {[src.publisher, src.year, src.page && tr('inv.refPage', { page: src.page })].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {src.url ? <ExternalIcon color={t.primary} /> : null}
          </Pressable>
        ))}
      </Section>
    </ScrollView>
  );
}

function Section({ title, t, children }: { title: string; t: ThemeColors; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <CengelMark color={t.accent} />
        <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    hero: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
    heroText: { flex: 1, gap: space.xs },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    primaryBtn: {
      flexDirection: 'row',
      gap: space.sm,
      minHeight: 56,
      borderRadius: radius.pill,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    map: { height: 200, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    band: { height: 10, marginHorizontal: -space.lg },
    gallery: { flexDirection: 'row', gap: space.sm },
    galleryTile: { flex: 1, height: 88, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
    invCard: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, backgroundColor: t.surface },
    invActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
    source: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  });
