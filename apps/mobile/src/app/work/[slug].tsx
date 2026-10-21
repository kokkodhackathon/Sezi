import { coverOf, hasLocation, inventorySource, isCommons, loc, toneForType, type SweetTheme, type WorkRow } from '@sezi/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeziMap, WorkPin } from '@/components/map';
import { PhotoViewer } from '@/components/photo-viewer';
import { formatCommonsCredit, PhotoSourceTag, PhotoSourceThumbTag } from '@/components/photo-source';
import { ReadMore } from '@/components/read-more';
import { Badge, Button, Card, EmptyState, ListRow } from '@/components/ui';
import { ChevronIcon, ExternalIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { outline, SoftPressable, sweetShadow } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { hasRouteTo, planRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { AUDIO_BASE } from '@/lib/supabase';
import { createClipPlayer } from '@/lib/voice/clip-player';
import { NARRATION_WAIT_MS, say, silence } from '@/lib/voice/speech';
import { photoUrl, useWork } from '@/lib/works';

/** Eser ses kaydı oynatıcısı (admin panelinden yüklenen kayıt). */
const workClip = createClipPlayer();

export default function WorkDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const { data: work, isLoading, error } = useWork(slug);

  if (isLoading) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('work.loading')} />
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
function Detail({ work, t, s }: { work: WorkRow; t: SweetTheme; s: ReturnType<typeof makeStyles> }) {
  /** Çalan anlatım: genel (ad, yer, tarihçe) ya da mimari bölümü; mimari ayrı dinlenir (Ulu Cami'de ~12 bin karakter). */
  const [speaking, setSpeaking] = useState<'main' | 'architecture' | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  // Kapak geçilince durum çubuğunun altına zemin rengi şerit gelir (içerik saatin altına girmesin).
  const [scrolled, setScrolled] = useState(false);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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
  const tone = t.tones[toneForType(work.type_slug)];
  const inv = inventorySource(work);
  const ref = inv?.page ? (inv.volume ? tr('inv.refShort', { v: inv.volume, page: inv.page }) : tr('inv.refPage', { page: inv.page })) : null;
  const otherSources = work.sources.filter((x) => x.kind !== 'inventory');
  const access = profile && hasRouteTo(work.slug) ? planRoute(work.slug, profile) : null;
  const canHear = profile?.hearing !== 'deaf';
  const place = [work.district, city].filter(Boolean).join(', ');
  const commonsCredits = [
    ...new Set(
      work.photos
        .filter(isCommons)
        .map((p) => formatCommonsCredit(p, lang)),
    ),
  ];
  const inventoryCredit = work.photos.find((p) => !isCommons(p) && p.credit)?.credit;

  useEffect(
    () => () => {
      workClip.stop();
      silence();
    },
    [],
  );

  const narration = [name, kind, place, period, history || (ref ? tr('work.historyRef', { ref }) : tr('work.historyInBook'))].filter(Boolean).join('. ');
  // İngilizcede TR kayda düşülmez: metin cihaz sesiyle okunur.
  const audioPath = lang === 'en' ? work.audio_en : work.audio_tr;
  const stopSpeech = () => {
    workClip.stop();
    silence();
    setSpeaking(null);
  };
  // Kesilen okumanın geç gelen onDone'ı yeni başlayanı kapatmasın.
  const done = (key: 'main' | 'architecture') => () => setSpeaking((k) => (k === key ? null : k));
  const toggleSpeech = () => {
    if (speaking === 'main') return stopSpeech();
    setSpeaking('main');
    const tts = () => say(narration, { lang, rate: settings.speechRate, interrupt: true, waitMs: NARRATION_WAIT_MS, onDone: done('main') });
    if (!audioPath) return tts();
    silence();
    // İnsan kaydı hızlandırılmaz.
    workClip.play(AUDIO_BASE + audioPath, { onEnd: done('main'), onError: tts });
  };
  const toggleArchitecture = () => {
    if (speaking === 'architecture') return stopSpeech();
    workClip.stop();
    setSpeaking('architecture');
    say(`${tr('work.architecture')}. ${architecture}`, { lang, rate: settings.speechRate, interrupt: true, waitMs: NARRATION_WAIT_MS, onDone: done('architecture') });
  };
  const citation = inv ? `${name}. ${inv.title}${ref ? `, ${ref}` : ''}. Vakıf Katılım${inv.year ? `, ${inv.year}` : ''}.${inv.url ? ` ${inv.url}` : ''}` : null;
  // "Kısalt" sayfayı bölüm başlığına döndürür (geri düğmesinin altında kalmasın).
  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  const backTo = (key: string) =>
    scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + (sectionY.current[key] ?? 0) - insets.top - 72), animated: !reduced });

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={cover && !scrolled ? 'light' : 'auto'} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom }}
        scrollEventThrottle={64}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > (cover ? 360 : 40))}>
        {/* Kapak: fotoğraf varsa tam genişlik, ad fotoğrafın üstünde; yoksa tür simgeli yumuşak alan. */}
        {cover ? (
          <View style={{ position: 'relative' }}>
            <Pressable onPress={() => setViewer(0)} accessibilityRole="imagebutton" accessibilityLabel={`${loc(cover.alt, lang)}. ${tr('work.openPhotos')}`}>
              <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} style={s.heroImg} contentFit="cover" transition={150} accessible={false} />
              <View style={s.shade} pointerEvents="none">
                {/* Yumuşak karartma: çok sayıda ince şerit, yazının okunurluğu için (yerel degrade modülü gerektirmez). */}
                {SHADE.map((o, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: `rgba(14,12,11,${o})` }} />
                ))}
              </View>
              <View style={[s.heroText, isCommons(cover) && { paddingRight: 140 }]} pointerEvents="none">
                <Text style={[type.meta, s.onPhotoDim]}>{kind}</Text>
                <Text style={[type.editorial, s.onPhoto]} accessibilityRole="header">
                  {name}
                </Text>
                <Text style={[type.meta, s.onPhotoDim]}>{place}</Text>
              </View>
            </Pressable>
            <PhotoSourceTag photo={cover} />
          </View>
        ) : (
          <View style={[s.plainHero, { paddingTop: insets.top + 64, backgroundColor: t.soft }, t.outlined && { borderBottomWidth: 2, borderBottomColor: t.border }]}>
            <View style={[s.glyphTile, { backgroundColor: tone.fill }, outline(t)]}>
              <WorkGlyphInline slug={work.type_slug} color={tone.ink} size={32} />
            </View>
            <Text style={[type.meta, { color: t.textMuted }]}>{kind}</Text>
            <Text style={[type.editorial, { color: t.text }]} accessibilityRole="header">
              {name}
            </Text>
            <Text style={[type.meta, { color: t.textMuted }]}>{place}</Text>
          </View>
        )}

        <View style={s.body} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
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
                label={speaking === 'main' ? tr('work.stop') : tr('work.listen')}
                onPress={toggleSpeech}
                icon={(c) => (speaking === 'main' ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
              />
            ) : null}
            {hasRouteTo(work.slug) ? (
              <Button
                style={{ flex: 1 }}
                variant={canHear ? 'outline' : 'primary'}
                label={tr('work.directions')}
                icon={(c) => <TurnIcon turn="slight_right" color={c} />}
                onPress={() => router.push({ pathname: '/navigate', params: { dest: work.slug } })}
              />
            ) : null}
          </View>

          {/* Duymayan ve az duyan kullanıcı: sesli anlatımın her cümlesi bu sayfada yazılı olarak zaten var
              (ad, tür, yer, tarihçe), ayrı bir anlatım metni kutusu gerekmez. */}
          {work.photos.length > 1 ? (
            <Section title={tr('work.photos')} t={t}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }} style={{ marginHorizontal: -space.xl }}>
                {work.photos.map((p, i) => (
                  <SoftPressable key={p.id} onPress={() => setViewer(i)} accessibilityRole="imagebutton" accessibilityLabel={loc(p.alt, lang)}>
                    <Image source={{ uri: photoUrl(p, 'thumb') }} style={[s.thumb, outline(t)]} contentFit="cover" accessible={false} />
                    <PhotoSourceThumbTag photo={p} />
                  </SoftPressable>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          <Section title={tr('work.history')} t={t} onLayout={(y) => (sectionY.current.history = y)}>
            {period ? <Text style={[type.itemTitle, { color: t.text }]}>{period}</Text> : null}
            {history ? (
              <ReadMore text={history} onCollapse={() => backTo('history')} />
            ) : (
              <Text style={[type.body, { color: t.textMuted }]}>{ref ? tr('work.historyRef', { ref }) : tr('work.historyInBook')}</Text>
            )}
          </Section>

          {architecture ? (
            <Section title={tr('work.architecture')} t={t} onLayout={(y) => (sectionY.current.architecture = y)}>
              {canHear ? (
                <Button
                  compact
                  variant="outline"
                  label={speaking === 'architecture' ? tr('work.stop') : tr('work.listenArchitecture')}
                  onPress={toggleArchitecture}
                  icon={(c) => (speaking === 'architecture' ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
                />
              ) : null}
              <ReadMore text={architecture} onCollapse={() => backTo('architecture')} />
            </Section>
          ) : null}

          {/* Kitaptan alınan metnin atfı: metinlerin hemen altında (kaynaklar bölümü sayfanın sonunda). */}
          {(history || architecture) && inv ? (
            <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.textSource', { book: [inv.title, ref].filter(Boolean).join(', ') })}</Text>
          ) : null}

          <Section title={tr('design.location')} t={t}>
            {address ? <Text style={[type.body, { color: t.text }]}>{address}</Text> : null}
            {hasLocation(work) ? (
              <SeziMap
                style={[s.map, outline(t)]}
                interactive={false}
                initial={[[work.lng, work.lat]]}
                initialZoom={work.location_precision === 'exact' ? 16.5 : 15}
                accessibilityLabel={address ?? loc(work.name, 'tr')}>
                <WorkPin location={[work.lng, work.lat]} approximate={work.location_precision !== 'exact'} />
              </SeziMap>
            ) : (
              <Text style={[type.body, { color: t.textMuted }]}>{tr('inv.unlocated')}</Text>
            )}
            {hasLocation(work) && work.location_precision !== 'exact' ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.mapApprox')}</Text> : null}
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
                trailing={src.url ? <ExternalIcon color={t.primaryText} /> : null}
              />
            ))}
            {!inv && otherSources.length === 0 ? <Text style={[type.body, { color: t.textMuted }]}>{tr('work.noSources')}</Text> : null}
            {commonsCredits.map((cLine) => (
              <Text key={cLine} style={[type.meta, { color: t.textMuted }]}>
                {cLine}
              </Text>
            ))}
            {inventoryCredit ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.photoCredit', { credit: inventoryCredit })}</Text> : null}
          </Section>
        </View>
      </ScrollView>

      {scrolled ? <View style={[s.topBar, { height: insets.top, backgroundColor: t.background }]} /> : null}
      {/* Yüzen geri düğmesi: üst çubuk yerine (fotoğraf tam ekrana kadar uzanır). */}
      <SoftPressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={tr('work.back')}
        style={[s.back, sweetShadow(t), { top: insets.top + space.sm, backgroundColor: t.surface }]}>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <ChevronIcon color={t.text} />
        </View>
      </SoftPressable>

      {work.photos.length ? <PhotoViewer key={viewer ?? -1} photos={work.photos} start={viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

// Karartma şeritlerinin opaklığı: yumuşak (kareli) bir artış, bant görünmesin.
const SHADE = Array.from({ length: 24 }, (_, i) => Number((0.7 * ((i + 1) / 24) ** 1.6).toFixed(3)));

function Section({ title, t, children, onLayout }: { title: string; t: SweetTheme; children: ReactNode; onLayout?: (y: number) => void }) {
  return (
    <View style={{ gap: space.md }} onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}>
      <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    heroImg: { width: '100%', aspectRatio: 4 / 5, maxHeight: 520 },
    shade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
    heroText: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: 2 },
    onPhoto: { color: '#FFFFFF' },
    onPhotoDim: { color: 'rgba(255,255,255,0.86)' },
    plainHero: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xs },
    glyphTile: { width: 56, height: 56, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
    body: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xl },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    actions: { flexDirection: 'row', gap: space.sm },
    thumb: { width: 132, height: 132, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: t.soft },
    map: { height: 180, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: t.soft },
    links: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -space.lg },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
    back: { position: 'absolute', left: space.lg, width: 48, height: 48, borderRadius: 24, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  });
