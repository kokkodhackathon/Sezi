import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import { Image } from 'expo-image';
import * as Speech from 'expo-speech';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeferredMap } from '@/components/deferred-map';
import { PhotoViewer } from '@/components/photo-viewer';
import { Badge, Button, EmptyState, ListRow, softShadow } from '@/components/ui';
import { ChevronIcon, ExternalIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { colorForType, WorkGlyphInline } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { hasRouteTo, planRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { coverOf, hasLocation, inventorySource, loc, photoUrl, useWork, type WorkRow } from '@/lib/works';

export default function WorkDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const { data: work, isLoading, error } = useWork(slug);

  if (isLoading) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={t.primary} accessibilityLabel={tr('work.loading')} />
      </View>
    );
  }
  if (error || !work) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState title={error ? tr('work.error') : tr('work.notFound')} />
      </View>
    );
  }
  return <Detail work={work} t={t} s={s} />;
}

/**
 * Eser sayfası: önce fotoğraf ve ad, sonra iki eylem (dinle, yol tarifi), sonra kısa bölümler.
 * Uzun açıklama yok: tarihçe resmî metin gelene kadar kitap sayfasına yönlendirir.
 */
function Detail({ work, t, s }: { work: WorkRow; t: ThemeColors; s: ReturnType<typeof makeStyles> }) {
  const [speaking, setSpeaking] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  // Kapak geçilince durum çubuğunun altına zemin rengi şerit gelir (içerik saatin altına girmesin).
  const [scrolled, setScrolled] = useState(false);
  const insets = useSafeAreaInsets();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { visited, settings } = useSettings();
  const name = loc(work.name, lang);
  const kind = loc(work.type_name, lang);
  const city = loc(work.city_name, lang);
  const history = loc(work.history, lang);
  const architecture = loc(work.architecture, lang);
  const period = loc(work.period, lang);
  const address = loc(work.address, lang);
  const cover = coverOf(work);
  const inv = inventorySource(work);
  const ref = inv?.page ? (inv.volume ? tr('inv.refShort', { v: inv.volume, page: inv.page }) : tr('inv.refPage', { page: inv.page })) : null;
  const otherSources = work.sources.filter((x) => x.kind !== 'inventory');
  const access = profile && hasRouteTo(work.slug) ? planRoute(work.slug, profile) : null;
  const canHear = profile?.hearing !== 'deaf';
  const place = [work.district, city].filter(Boolean).join(', ');
  const credit = work.photos.find((p) => p.credit)?.credit;

  useEffect(() => () => void Speech.stop(), []);

  const narration = [name, kind, place, period, history || (ref ? tr('work.historyRef', { ref }) : tr('work.historyInBook'))].filter(Boolean).join('. ');
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
  const citation = inv ? `${name}. ${inv.title}${ref ? `, ${ref}` : ''}. Vakıf Katılım${inv.year ? `, ${inv.year}` : ''}.${inv.url ? ` ${inv.url}` : ''}` : null;

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={cover && !scrolled ? 'light' : 'auto'} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom }}
        scrollEventThrottle={64}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > (cover ? 360 : 40))}>
        {/* Kapak: fotoğraf varsa tam genişlik, ad fotoğrafın üstünde; yoksa tür simgeli yumuşak alan. */}
        {cover ? (
          <Pressable onPress={() => setViewer(0)} accessibilityRole="imagebutton" accessibilityLabel={`${loc(cover.alt, lang)}. ${tr('work.openPhotos')}`}>
            <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} style={s.heroImg} contentFit="cover" transition={150} accessible={false} />
            <View style={s.shade} pointerEvents="none">
              {/* Yumuşak karartma: çok sayıda ince şerit, yazının okunurluğu için (yerel degrade modülü gerektirmez). */}
              {SHADE.map((o, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: `rgba(14,12,11,${o})` }} />
              ))}
            </View>
            <View style={s.heroText} pointerEvents="none">
              <Text style={[type.meta, s.onPhotoDim]}>{kind}</Text>
              <Text style={[type.title, s.onPhoto, { fontSize: 30, lineHeight: 36 }]} accessibilityRole="header">
                {name}
              </Text>
              <Text style={[type.meta, s.onPhotoDim]}>{place}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[s.plainHero, { paddingTop: insets.top + 64, backgroundColor: t.soft }]}>
            <WorkGlyphInline slug={work.type_slug} color={colorForType(work.type_slug)} size={44} />
            <Text style={[type.meta, { color: t.textMuted }]}>{kind}</Text>
            <Text style={[type.title, { color: t.text, fontSize: 30, lineHeight: 36 }]} accessibilityRole="header">
              {name}
            </Text>
            <Text style={[type.meta, { color: t.textMuted }]}>{place}</Text>
          </View>
        )}

        <View style={s.body}>
          <View style={s.facts}>
            {ref ? <Badge label={ref} /> : null}
            {work.condition !== 'unknown' ? (
              <Badge label={tr(`work.condition.${work.condition}` as MessageKey)} tone={work.condition === 'destroyed' || work.condition === 'damaged' ? 'danger' : 'neutral'} />
            ) : null}
            {work.unesco ? <Badge label={tr('work.unesco')} tone="accent" /> : null}
            {visited.includes(work.slug) ? <Badge label={tr('work.visited')} tone="primary" /> : null}
          </View>

          <View style={s.actions}>
            {canHear ? (
              <Button
                style={{ flex: 1 }}
                label={speaking ? tr('work.stop') : tr('work.listen')}
                onPress={toggleSpeech}
                icon={(c) => (speaking ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
              />
            ) : null}
            {hasRouteTo(work.slug) ? (
              <Button
                style={{ flex: 1 }}
                variant={canHear ? 'outline' : 'primary'}
                label={tr('work.directions')}
                icon={(c) => <TurnIcon turn="slight_right" color={c} />}
                onPress={() => router.push({ pathname: '/route/[slug]', params: { slug: work.slug } })}
              />
            ) : null}
          </View>

          {/* Duymayan ve az duyan kullanıcı: sesli anlatımın her cümlesi bu sayfada yazılı olarak zaten var
              (ad, tür, yer, tarihçe), ayrı bir anlatım metni kutusu gerekmez. */}
          {work.photos.length > 1 ? (
            <Section title={tr('work.photos')} t={t}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }} style={{ marginHorizontal: -space.xl }}>
                {work.photos.map((p, i) => (
                  <Pressable key={p.id} onPress={() => setViewer(i)} accessibilityRole="imagebutton" accessibilityLabel={loc(p.alt, lang)}>
                    <Image source={{ uri: photoUrl(p, 'thumb') }} style={s.thumb} contentFit="cover" accessible={false} />
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          <Section title={tr('work.history')} t={t}>
            {period ? <Text style={[type.itemTitle, { color: t.text }]}>{period}</Text> : null}
            {history ? (
              <Text style={[type.body, { color: t.text }]}>{history}</Text>
            ) : (
              <Text style={[type.body, { color: t.textMuted }]}>{ref ? tr('work.historyRef', { ref }) : tr('work.historyInBook')}</Text>
            )}
            {architecture ? <Text style={[type.body, { color: t.text }]}>{architecture}</Text> : null}
          </Section>

          <Section title={tr('design.location')} t={t}>
            {address ? <Text style={[type.body, { color: t.text }]}>{address}</Text> : null}
            {hasLocation(work) ? (
              <View style={s.map} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <DeferredMap dragPan={false} touchZoom={false} touchRotate={false}>
                  <Camera initialViewState={{ center: [work.lng, work.lat], zoom: work.location_precision === 'exact' ? 16.5 : 15 }} />
                  <GeoJSONSource id="work" data={{ type: 'Point', coordinates: [work.lng, work.lat] }}>
                    {work.location_precision !== 'exact' ? (
                      <Layer id="work-area" type="circle" paint={{ 'circle-radius': 46, 'circle-color': t.primary, 'circle-opacity': 0.14, 'circle-stroke-width': 2, 'circle-stroke-color': t.primary }} />
                    ) : null}
                    <Layer id="work-halo" type="circle" paint={{ 'circle-radius': 16, 'circle-color': t.surface }} />
                    <Layer id="work-circle" type="circle" paint={{ 'circle-radius': 9, 'circle-color': t.accent, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
                  </GeoJSONSource>
                </DeferredMap>
              </View>
            ) : (
              <Text style={[type.body, { color: t.textMuted }]}>{tr('inv.unlocated')}</Text>
            )}
            {hasLocation(work) && work.location_precision !== 'exact' ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.mapApprox')}</Text> : null}
          </Section>

          {access ? (
            <Section title={tr('work.access')} t={t}>
              <View style={[s.panel, softShadow(t), { backgroundColor: t.surface, padding: 0 }]}>
                <ListRow
                  first
                  title={access.stairSegments === 0 ? tr('work.accessStepFree') : tr('work.accessStairs', { n: access.stairSegments })}
                  subtitle={tr('work.accessRoute', { m: Math.round(access.route.lengthM) })}
                />
                <ListRow title={tr('work.report')} hint={tr('work.reportHint')} onPress={() => router.push({ pathname: '/report/new', params: { work: work.slug } })} />
              </View>
            </Section>
          ) : null}

          {work.exhibitions.length ? (
            <Section title={tr('work.exhibitions')} t={t}>
              {work.exhibitions.map((e) => (
                <ListRow key={e.slug} first title={loc(e.title, lang)} subtitle={loc(e.venue, lang)} onPress={() => router.push('/exhibitions')} />
              ))}
            </Section>
          ) : null}

          <Section title={tr('work.sources')} t={t}>
            {inv ? (
              <View style={{ gap: space.xs }}>
                <Text style={[type.itemTitle, { color: t.text }]}>{inv.title}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>{[inv.page ? tr('inv.refPage', { page: inv.page }) : null, 'Vakıf Katılım', inv.year ? String(inv.year) : null].filter(Boolean).join(' · ')}</Text>
                <View style={s.links}>
                  {inv.url ? <Button compact variant="ghost" label={tr('inv.openBook')} hint={tr('inv.openBookHint')} icon={(c) => <ExternalIcon color={c} />} onPress={() => Linking.openURL(inv.url!)} /> : null}
                  {citation ? <Button compact variant="ghost" label={tr('inv.cite')} onPress={() => Share.share({ message: citation })} /> : null}
                </View>
              </View>
            ) : null}
            {otherSources.map((src) => (
              <ListRow
                key={src.id}
                first
                title={src.title}
                subtitle={[src.publisher, src.year].filter(Boolean).join(' · ')}
                hint={src.url ? tr('work.sourceHint') : undefined}
                onPress={src.url ? () => Linking.openURL(src.url!) : undefined}
                trailing={src.url ? <ExternalIcon color={t.primary} /> : null}
              />
            ))}
            {!inv && otherSources.length === 0 ? <Text style={[type.body, { color: t.textMuted }]}>{tr('work.noSources')}</Text> : null}
            {credit ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.photoCredit', { credit })}</Text> : null}
          </Section>
        </View>
      </ScrollView>

      {scrolled ? <View style={[s.topBar, { height: insets.top, backgroundColor: t.background }]} /> : null}
      {/* Yüzen geri düğmesi: üst çubuk yerine (fotoğraf tam ekrana kadar uzanır). */}
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('work.back')} style={[s.back, softShadow(t), { top: insets.top + space.sm, backgroundColor: t.surface }]}>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <ChevronIcon color={t.text} />
        </View>
      </Pressable>

      {work.photos.length ? <PhotoViewer key={viewer ?? -1} photos={work.photos} start={viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

// Karartma şeritlerinin opaklığı: yumuşak (kareli) bir artış, bant görünmesin.
const SHADE = Array.from({ length: 24 }, (_, i) => Number((0.7 * ((i + 1) / 24) ** 1.6).toFixed(3)));

function Section({ title, t, children }: { title: string; t: ThemeColors; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    heroImg: { width: '100%', aspectRatio: 4 / 5, maxHeight: 520 },
    shade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
    heroText: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: 2 },
    onPhoto: { color: '#FFFFFF' },
    onPhotoDim: { color: 'rgba(255,255,255,0.86)' },
    plainHero: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xs },
    body: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xl },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    actions: { flexDirection: 'row', gap: space.sm },
    panel: { gap: space.xs, padding: space.lg, borderRadius: radius.xl, overflow: 'hidden' },
    thumb: { width: 132, height: 132, borderRadius: radius.lg },
    map: { height: 180, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: t.soft },
    links: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -space.lg },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
    back: { position: 'absolute', left: space.lg, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  });
