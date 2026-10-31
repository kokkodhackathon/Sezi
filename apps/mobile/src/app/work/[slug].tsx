import { coverOf, hasLocation, inventorySource, isAttributed, loc, splitReadAlong, toneForType, type SweetTheme, type WorkRow } from '@sezi/shared';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader, useFloatingHeaderScroll } from '@/components/floating-header';
import { SeziLoader } from '@/components/sezi-loader';
import { PhotoScrim, photoOverlayInk } from '@/components/photo-card';
import { SeziMap, WorkPin } from '@/components/map';
import { PhotoViewer } from '@/components/photo-viewer';
import { formatPhotoCredit, PhotoSourceThumbTag } from '@/components/photo-source';
import { ReadAlongText } from '@/components/read-along-text';
import { ReadMore } from '@/components/read-more';
import { Badge, Button, Card, Chip, EmptyState, ListRow, Note } from '@/components/ui';
import { WorkFacts } from '@/components/work-facts';
import { WorkVisit } from '@/components/work-visit';
import { ExternalIcon, PinIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { FadeInItem, outline, SoftPressable, sweetShadow } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { hasRouteTo, planRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { useAccount } from '@/lib/account';
import { checkInHere } from '@/lib/checkin';
import { usePassport } from '@/lib/passport';
import { usePhotoUrls, useWorkCommunityPhotos } from '@/lib/photos';
import { AUDIO_BASE } from '@/lib/supabase';
import { createClipPlayer } from '@/lib/voice/clip-player';
import { useReadAlong } from '@/lib/voice/read-along';
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
  const header = useFloatingHeaderScroll();

  if (isLoading) {
    return (
      <View style={s.center}>
        <FloatingHeader title={tr('work.loading')} scrollY={header.scrollY} coverHeight={header.coverHeight} />
        <SeziLoader label={tr('work.loading')} />
      </View>
    );
  }
  if (error || !work) {
    return (
      <View style={s.center}>
        <FloatingHeader title={tr('work.error')} scrollY={header.scrollY} coverHeight={header.coverHeight} />
        <EmptyState title={error ? tr('work.error') : tr('work.notFound')} />
      </View>
    );
  }
  return <Detail work={work} t={t} s={s} />;
}

/** Eşli okunabilen bölümler. */
type ReadKey = 'summary' | 'history' | 'architecture';
/** Bölümler arası hızlı geçiş hedefleri (sayfadaki sırayla). */
type SectionKey = ReadKey | 'facts' | 'visit' | 'photos' | 'community' | 'location' | 'sources';

/**
 * Eser sayfası: fotoğraf ve ad, iki eylem (dinle, yol tarifi), bölümlere hızlı geçiş, sonra kısa özet, bilgi kartı,
 * gitmeden önce, uzun metinler (her biri ayrı dinlenir; okunan cümle vurgulanır), konum ve kaynaklar.
 */
function Detail({ work, t, s }: { work: WorkRow; t: SweetTheme; s: ReturnType<typeof makeStyles> }) {
  /** Genel anlatım (ad, yer, tarihçe; varsa insan kaydı). Bölümler ayrıca eşli okunur. */
  const [speaking, setSpeaking] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const header = useFloatingHeaderScroll();
  const insets = useSafeAreaInsets();
  // Kapak tam genişlik; 4:5 oran en fazla 520 dp yükseklikle (aspectRatio + maxHeight genişliği daraltıyordu).
  const heroHeight = Math.min(useWindowDimensions().width * 5 / 4, 520);
  const reduced = useReducedMotion();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { settings } = useSettings();
  const { has, record } = usePassport();
  const { user } = useAccount();
  const community = useWorkCommunityPhotos(work.slug);
  const communityPaths = useMemo(
    () => (community.data ?? []).map((photo) => photo.thumb_path),
    [community.data],
  );
  const communityUrls = usePhotoUrls(communityPaths);
  const [checking, setChecking] = useState(false);
  const [checkinNote, setCheckinNote] = useState<string | null>(null);
  const checkHere = async () => {
    setChecking(true);
    setCheckinNote(null);
    try {
      const result = await checkInHere(work);
      if (result.ok) {
        record(work.slug, 'checkin', null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(tr('checkin.done'));
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setCheckinNote(
          result.reason === 'far'
            ? tr('checkin.far', { m: Math.round(result.distanceM ?? 0) })
            : result.reason === 'permission'
              ? tr('checkin.permission')
              : result.reason === 'imprecise_place' || result.reason === 'no_location'
                ? tr('checkin.imprecise')
                : tr('checkin.weak'),
        );
      }
    } finally {
      setChecking(false);
    }
  };
  const reader = useReadAlong({ lang, rate: settings.speechRate });
  const name = loc(work.name, lang);
  const kind = loc(work.type_name, lang);
  const city = loc(work.city_name, lang);
  const summary = loc(work.summary, lang);
  const history = loc(work.history, lang);
  const architecture = loc(work.architecture, lang);
  const period = loc(work.period, lang);
  const address = loc(work.address, lang);
  const cover = coverOf(work);
  const tone = t.tones[toneForType(work.type_slug)];
  const inv = inventorySource(work);
  const ref = inv?.page ? (inv.volume ? tr('inv.refShort', { v: inv.volume, page: inv.page }) : tr('inv.refPage', { page: inv.page })) : null;
  const otherSources = work.sources.filter((x) => x.kind !== 'inventory');
  const route = profile && hasRouteTo(work.slug) ? planRoute(work.slug, profile) : null;
  const canHear = profile?.hearing !== 'deaf';
  const place = [work.district, city].filter(Boolean).join(', ');
  const coverCredit = cover && isAttributed(cover) ? formatPhotoCredit(cover, lang) : null;
  const readable = useMemo(
    () => ({ summary: splitReadAlong(summary), history: splitReadAlong(history), architecture: splitReadAlong(architecture) }),
    [summary, history, architecture],
  );

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
  const stopMain = () => {
    workClip.stop();
    silence();
    setSpeaking(false);
  };
  const toggleSpeech = () => {
    if (speaking) return stopMain();
    reader.stop();
    setSpeaking(true);
    const end = () => setSpeaking(false);
    const tts = () => say(narration, { lang, rate: settings.speechRate, interrupt: true, waitMs: NARRATION_WAIT_MS, onDone: end });
    if (!audioPath) return tts();
    silence();
    // İnsan kaydı hızlandırılmaz.
    workClip.play(AUDIO_BASE + audioPath, { onEnd: end, onError: tts });
  };
  // Okunan paragraf ekranda tutulur; kullanıcı kendisi kaydırınca (ya da başka bölüme geçince) takip bırakılır.
  const follow = useRef(true);
  const toggleRead = (key: ReadKey) => {
    if (reader.active === key) return reader.stop();
    workClip.stop();
    setSpeaking(false);
    follow.current = true;
    reader.start(key, readable[key].flat());
  };
  const citation = inv ? `${name}. ${inv.title}${ref ? `, ${ref}` : ''}. Vakıf Katılım${inv.year ? `, ${inv.year}` : ''}.${inv.url ? ` ${inv.url}` : ''}` : null;

  // Bölüm konumları gövdeye göre ölçülür; "Kısalt", hızlı geçiş ve eşli okuma sayfayı buna göre kaydırır.
  const scrollRef = useRef<ScrollView>(null);
  const bodyRef = useRef<View>(null);
  const bodyY = useRef(0);
  // Ölçüm ve başlık düğümleri yalnız olaylarda okunur; render sırasında okunmasın diye ref değil sabit Map.
  const [sectionY] = useState(() => new Map<SectionKey, number>());
  const [headers] = useState(() => new Map<SectionKey, Text>());
  const scrollToBodyY = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + y - insets.top - 72), animated: !reduced });
  const backTo = (key: SectionKey) => scrollToBodyY(sectionY.get(key) ?? 0);
  const goTo = (key: SectionKey) => {
    follow.current = false;
    backTo(key);
    // Ekran okuyucu odağı bölüm başlığına taşınır (kaydırma tek başına odağı değiştirmez).
    const node = headers.get(key);
    if (node) setTimeout(() => AccessibilityInfo.sendAccessibilityEvent(node, 'focus'), reduced ? 0 : 350);
  };
  const revealParagraph = (node: View) => {
    if (follow.current && bodyRef.current) node.measureLayout(bodyRef.current, (_x, y) => scrollToBodyY(y - space.lg));
  };
  const place_ = (key: SectionKey) => (y: number) => {
    sectionY.set(key, y);
  };
  const headerRef = (key: SectionKey) => (node: Text | null) => {
    if (node) headers.set(key, node);
    else headers.delete(key);
  };

  const sections: { key: SectionKey; label: string }[] = [
    summary ? { key: 'summary' as const, label: tr('work.summary') } : null,
    { key: 'facts' as const, label: tr('work.facts') },
    { key: 'visit' as const, label: tr('work.visit') },
    work.photos.length > 1 ? { key: 'photos' as const, label: tr('work.photos') } : null,
    community.data?.length ? { key: 'community' as const, label: tr('work.community') } : null,
    { key: 'history' as const, label: tr('work.history') },
    architecture ? { key: 'architecture' as const, label: tr('work.architecture') } : null,
    { key: 'location' as const, label: tr('design.location') },
    { key: 'sources' as const, label: tr('work.sources') },
  ].filter((x) => x !== null);

  /** Eşli okunan metin; okunmuyorken uzun metin kısa hâliyle (ReadMore). */
  const readBody = (key: ReadKey, text: string, short = false) =>
    reader.active === key ? (
      <ReadAlongText paragraphs={readable[key]} current={reader.index} t={t} onParagraph={revealParagraph} />
    ) : short ? (
      <Text style={[type.body, { color: t.text }]}>{text}</Text>
    ) : (
      <ReadMore text={text} onCollapse={() => backTo(key)} />
    );
  const listen = (key: ReadKey) =>
    canHear ? (
      <Button
        compact
        variant="outline"
        style={{ alignSelf: 'flex-start' }}
        label={reader.active === key ? tr('work.stop') : tr('work.listenSection')}
        hint={reader.active === key ? undefined : tr('work.listenSectionHint')}
        onPress={() => toggleRead(key)}
        icon={(c) => (reader.active === key ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
      />
    ) : null;

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom + (reader.active ? 96 : 0) }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          follow.current = false;
        }}
        onScroll={header.onScroll}>
        {/* Kapak: fotoğraf varsa tam genişlik, ad fotoğrafın üstünde; yoksa tür simgeli yumuşak alan. */}
        {cover ? (
          <View style={{ position: 'relative' }} onLayout={(e) => header.coverHeight.set(e.nativeEvent.layout.height)}>
            <Pressable onPress={() => setViewer(0)} accessibilityRole="imagebutton" accessibilityLabel={`${loc(cover.alt, lang)}. ${tr('work.openPhotos')}`}>
              <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} placeholderContentFit="cover" style={[s.heroImg, { height: heroHeight }]} contentFit="cover" transition={150} accessible={false} />
              <PhotoScrim height="60%" />
              <View style={[s.heroText, t.outlined && { backgroundColor: t.background, padding: space.md }]} pointerEvents="none">
                <Text style={[type.meta, s.onPhotoDim]}>{kind}</Text>
                <Text style={[type.editorial, s.onPhoto]} accessibilityRole="header">{name}</Text>
                <Text style={[type.meta, s.onPhotoDim]}>{place}</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <View onLayout={(e) => header.coverHeight.set(e.nativeEvent.layout.height)} style={[s.plainHero, { paddingTop: insets.top + 64, backgroundColor: tone.fill }, t.outlined && { borderBottomWidth: 2, borderBottomColor: t.border }]}>
            <WorkGlyphInline slug={work.type_slug} color={tone.ink} size={96} />
            <Text style={[type.meta, { color: tone.ink }]}>{kind}</Text>
            <Text style={[type.editorial, { color: tone.ink }]} accessibilityRole="header">{name}</Text>
            <Text style={[type.meta, { color: tone.ink }]}>{place}</Text>
          </View>
        )}
        {coverCredit ? (
          <Text style={[type.meta, s.coverCredit, { color: t.text }]}>{coverCredit}</Text>
        ) : null}
        <View ref={bodyRef} style={s.body} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
          {work.unesco || has(work.slug) ? (
            <FadeInItem index={0} style={s.badges}>
              {work.unesco ? <Badge label={tr('work.unesco')} tone="accent" /> : null}
              {has(work.slug) ? <Badge label={tr('work.visited')} tone="primary" /> : null}
            </FadeInItem>
          ) : null}
          {checkinNote ? <Note text={checkinNote} /> : null}
          {user && !community.data?.length ? (
            <Button variant="outline" label={tr('photos.add')} onPress={() => router.push({ pathname: '/photos/new', params: { work: work.slug } })} />
          ) : null}

          <FadeInItem index={1} style={s.actionGroup}>
            {hasRouteTo(work.slug) ? (
              <Button label={tr('work.directions')} icon={(c) => <TurnIcon turn="slight_right" color={c} />} onPress={() => router.push({ pathname: '/navigate', params: { dest: work.slug } })} />
            ) : canHear ? (
              <Button label={speaking ? tr('work.stop') : tr('work.listen')} onPress={toggleSpeech} icon={(c) => speaking ? <StopIcon color={c} /> : <PlayIcon color={c} />} />
            ) : !has(work.slug) ? (
              <Button variant="primary" label={tr('checkin.here')} disabled={checking} icon={(c) => <PinIcon color={c} />} onPress={() => void checkHere()} />
            ) : null}
            <View style={s.secondaryActions}>
              {hasRouteTo(work.slug) && canHear ? (
                <Button style={{ flex: 1 }} variant="secondary" label={speaking ? tr('work.stop') : tr('work.listen')} onPress={toggleSpeech} icon={(c) => speaking ? <StopIcon color={c} /> : <PlayIcon color={c} />} />
              ) : null}
              {!has(work.slug) && (hasRouteTo(work.slug) || canHear) ? (
                <Button style={{ flex: 1 }} variant="secondary" label={tr('checkin.here')} disabled={checking} icon={(c) => <PinIcon color={c} />} onPress={() => void checkHere()} />
              ) : null}
            </View>
          </FadeInItem>

          {/* Bölümlere hızlı geçiş: dokununca bölüme kayar, ekran okuyucu odağı bölüm başlığına geçer. */}
          <FadeInItem index={2} style={s.sectionJumps}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={tr('work.sections')} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }} style={{ marginHorizontal: -space.xl }}>
              {sections.map((x) => (
                <View key={x.key} accessibilityHint={tr('work.sectionGo', { section: x.label })}>
                  <Chip label={x.label} selected={false} onPress={() => goTo(x.key)} />
                </View>
              ))}
            </ScrollView>
          </FadeInItem>

          {summary ? (
            <FadeInItem index={3}>
              <Section title={tr('work.summary')} t={t} onLayout={place_('summary')} headerRef={headerRef('summary')}>
                <Card style={{ gap: space.md }}>
                  {readBody('summary', summary, true)}
                  <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.summarySource')}</Text>
                </Card>
                {listen('summary')}
              </Section>
            </FadeInItem>
          ) : null}

          <FadeInItem index={4}>
            <Section title={tr('work.facts')} t={t} onLayout={place_('facts')} headerRef={headerRef('facts')}>
              <WorkFacts work={work} t={t} />
            </Section>
          </FadeInItem>

          <FadeInItem index={5}>
            <Section title={tr('work.visit')} t={t} onLayout={place_('visit')} headerRef={headerRef('visit')}>
              <WorkVisit work={work} route={route} profile={profile} t={t} />
            </Section>
          </FadeInItem>

          {work.photos.length > 1 ? (
            <Section title={tr('work.photos')} t={t} onLayout={place_('photos')} headerRef={headerRef('photos')}>
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

          {community.data?.length ? (
            <Section
              title={tr('work.community')}
              t={t}
              onLayout={place_('community')}
              headerRef={headerRef('community')}
              action={
                user ? (
                  <Button
                    variant="outline"
                    label={tr('photos.add')}
                    onPress={() => router.push({ pathname: '/photos/new', params: { work: work.slug } })}
                  />
                ) : undefined
              }>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}
                style={{ marginHorizontal: -space.xl }}>
                {community.data.map((photo) => (
                  <View key={photo.id} style={{ width: 132, gap: space.xs }}>
                    <Image
                      source={{ uri: communityUrls.data?.[photo.thumb_path] }}
                      style={[s.thumb, outline(t)]}
                      contentFit="cover"
                      accessible
                      accessibilityLabel={photo.alt_text}
                    />
                    <Text style={[type.meta, { color: t.textMuted }]}>
                      {tr('photos.credit', { name: photo.credit_name ?? '' })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          <Section title={tr('work.history')} t={t} onLayout={place_('history')} headerRef={headerRef('history')}>
            {history ? (
              <>
                {listen('history')}
                {readBody('history', history)}
              </>
            ) : (
              <Text style={[type.body, { color: t.textMuted }]}>{ref ? tr('work.historyRef', { ref }) : tr('work.historyInBook')}</Text>
            )}
          </Section>

          {architecture ? (
            <Section title={tr('work.architecture')} t={t} onLayout={place_('architecture')} headerRef={headerRef('architecture')}>
              {listen('architecture')}
              {readBody('architecture', architecture)}
            </Section>
          ) : null}

          {/* Kitaptan alınan metnin atfı, metin bölümlerinin ardından bir kez gösterilir. */}
          {(history || architecture) && inv ? (
            // Kitap başlığı cildi zaten içerir ("… — Cilt 1"); burada yalnız sayfa eklenir.
            <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.textSource', { book: [inv.title, inv.page ? tr('inv.refPage', { page: inv.page }) : null].filter(Boolean).join(', ') })}</Text>
          ) : null}
 

          <Section title={tr('design.location')} t={t} onLayout={place_('location')} headerRef={headerRef('location')}>
            {address ? <Text style={[type.body, { color: t.text }]}>{address}</Text> : null}
            {hasLocation(work) ? (
              <SeziMap
                style={[s.map, outline(t)]}
                interactive={false}
                initial={[[work.lng, work.lat]]}
                initialZoom={work.location_precision === 'exact' ? 16.5 : 15}
                accessibilityLabel={address ?? loc(work.name, 'tr')}>
                <WorkPin location={[work.lng, work.lat]} approximate={work.location_precision !== 'exact'} typeSlug={work.type_slug} />
              </SeziMap>
            ) : (
              <Text style={[type.body, { color: t.textMuted }]}>{tr('inv.unlocated')}</Text>
            )}
            {hasLocation(work) && work.location_precision !== 'exact' ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.mapApprox')}</Text> : null}
          </Section>

          {work.exhibitions.length ? (
            <Section title={tr('work.exhibitions')} t={t}>
              <Card padded={false}>
                {work.exhibitions.map((e, i) => (
                  <ListRow key={e.slug} first={i === 0} title={loc(e.title, lang)} subtitle={loc(e.venue, lang)} onPress={() => router.push('/exhibitions')} />
                ))}
              </Card>
            </Section>
          ) : null}

          <Section title={tr('work.sources')} t={t} onLayout={place_('sources')} headerRef={headerRef('sources')}>
            {inv ? (
              <View style={{ gap: space.xs }}>
                <Text style={[type.itemTitle, { color: t.text }]}>{inv.title}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>{[ref, 'Vakıf Katılım', inv.year ? String(inv.year) : null].filter(Boolean).join(' · ')}</Text>
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
          </Section>
        </View>
      </Animated.ScrollView>
      <FloatingHeader title={name} scrollY={header.scrollY} coverHeight={header.coverHeight} lightOnCover={!!cover} />

      {/* Eşli okuma sürerken durdurma her zaman erişilebilir (okunan metin uzun, liste düğmesi ekrandan çıkar). */}
      {reader.active ? (
        <View style={[s.readingBar, { bottom: insets.bottom + space.lg, backgroundColor: t.surface }, sweetShadow(t)]} accessibilityLiveRegion="polite">
          <Text style={[type.itemTitle, { color: t.text, flex: 1 }]} numberOfLines={2}>
            {tr('work.readingSection', { section: sections.find((x) => x.key === reader.active)?.label ?? '' })}
          </Text>
          <Button compact label={tr('work.stop')} onPress={reader.stop} icon={(c) => <StopIcon color={c} />} />
        </View>
      ) : null}

      {work.photos.length ? <PhotoViewer key={viewer ?? -1} photos={work.photos} start={viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

function Section({
  title,
  t,
  children,
  onLayout,
  headerRef,
  action,
}: {
  title: string;
  t: SweetTheme;
  children: ReactNode;
  onLayout?: (y: number) => void;
  headerRef?: (node: Text | null) => void;
  action?: ReactNode;
}) {
  return (
    <View style={{ gap: space.md }} onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}>
      <Text ref={headerRef} style={[type.heading, { color: t.text }]} accessibilityRole="header">
        {title}
      </Text>
      {action}
      {children}
    </View>
  );
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    heroImg: { width: '100%' },
    heroText: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: 2 },
    onPhoto: { color: t.outlined ? t.text : photoOverlayInk(t) },
    onPhotoDim: { color: t.outlined ? t.text : photoOverlayInk(t) },
    plainHero: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.sm, minHeight: 320, justifyContent: 'center' },
    coverCredit: { paddingHorizontal: space.xl, paddingTop: space.sm },
    body: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xxl },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    actionGroup: { gap: space.sm },
    secondaryActions: { flexDirection: 'row', gap: space.sm },
    sectionJumps: { marginTop: space.xs },
    readingBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.xl, borderCurve: 'continuous' },
    thumb: { width: 132, height: 132, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: t.soft },
    map: { height: 180, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: t.soft },
    links: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -space.lg },
  });
