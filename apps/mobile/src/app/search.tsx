import { hasLocation, inventorySource, loc, normalize, toneForType, type SweetTheme, type WorkRow } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { SeziMap, WorkClusters } from '@/components/map';
import { Badge, Button, Chip, EmptyState, Eyebrow, Segmented } from '@/components/ui';
import { WorkThumb, workEra, workExcerpt, workPlace } from '@/components/work-preview';
import { ChevronIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { hasRouteTo } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { useWorks } from '@/lib/works';

export default function Search() {
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: works } = useWorks();
  const [q, setQ] = useState('');
  // Açık kart: sonuca dokununca bilgiler bu ekranda açılır, eser sayfasına geçmeden.
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  // Haritada seçili eser (slug); altında sonuç kartı açılır.
  const [pin, setPin] = useState<string | null>(null);
  const { settings } = useSettings();

  const results = useMemo(() => {
    const n = normalize(q).trim();
    if (!n) return [];
    return (works ?? []).filter((w) =>
      normalize([w.name.tr, w.name.en, w.type_name.tr, w.type_name.en, w.complex_name?.tr, w.district, w.city_name.tr].filter(Boolean).join(' ')).includes(n),
    );
  }, [q, works]);

  const suggestions = useMemo(() => [...new Set((works ?? []).map((w) => loc(w.type_name, lang)))].slice(0, 6), [works, lang]);
  const cityWorks = useMemo(() => (works ?? []).filter((w) => w.city_slug === settings.city), [works, settings.city]);
  // İlçeye dokununca arama kutusu doldurulur; arama zaten ilçe alanında eşleşiyor.
  const districts = useMemo(
    () => [...new Set(cityWorks.flatMap((w) => (w.district ? [w.district] : [])))].sort((a, b) => a.localeCompare(b, lang)),
    [cityWorks, lang],
  );
  const mapWorks = (q.trim() ? results : cityWorks).filter(hasLocation);
  const pinned = mapWorks.find((w) => w.slug === pin);

  return (
    <View style={s.screen}>
      <View style={s.searchBar}>
        <TextInput
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setOpen(null);
            setPin(null);
          }}
          autoFocus
          placeholder={tr('search.placeholder')}
          placeholderTextColor={t.textMuted}
          accessibilityLabel={tr('search.title')}
          returnKeyType="search"
          style={[type.lead, s.input, outline(t)]}
        />
        <View style={{ marginTop: space.md }}>
          <Segmented
            label={tr('design.view')}
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: tr('design.list') },
              { value: 'map', label: tr('design.map') },
            ]}
          />
        </View>
      </View>
      {view === 'map' ? (
        <FlatList
          data={pinned ? [pinned] : []}
          keyExtractor={(w) => w.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.list}
          ListHeaderComponent={
            mapWorks.length ? (
              <View style={{ gap: space.sm }}>
                <SeziMap
                  key={q}
                  style={s.map}
                  initial={mapWorks.map((w) => [w.lng, w.lat])}
                  initialZoom={15}
                  accessibilityLabel={tr('design.mapHelp', { n: mapWorks.length })}>
                  <WorkClusters works={mapWorks.map((w) => ({ slug: w.slug, location: [w.lng, w.lat], color: t.tones[toneForType(w.type_slug)].ink }))} selected={pin} onPress={setPin} />
                </SeziMap>
                <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">
                  {tr('design.mapHelp', { n: mapWorks.length })}
                </Text>
              </View>
            ) : (
              <EmptyState title={tr('search.empty')} />
            )
          }
          renderItem={({ item }) => <ResultCard work={item} open onToggle={() => setPin(null)} t={t} />}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(w) => w.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.list}
          ListHeaderComponent={
            q.trim() ? (
              <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">
                {tr('search.results', { n: results.length })}
              </Text>
            ) : (
              <View style={{ gap: space.md }}>
                <Eyebrow text={tr('search.recent')} />
                <View style={s.chips}>
                  {suggestions.map((x) => (
                    <Chip key={x} label={x} selected={false} onPress={() => setQ(x)} />
                  ))}
                </View>
                {districts.length ? (
                  <>
                    <Eyebrow text={tr('inv.district')} />
                    <View style={s.chips}>
                      {districts.map((x) => (
                        <Chip key={x} label={x} selected={false} onPress={() => setQ(x)} />
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            )
          }
          ListEmptyComponent={q.trim() ? <EmptyState title={tr('search.empty')} /> : null}
          extraData={open}
          renderItem={({ item }) => <ResultCard work={item} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} t={t} />}
        />
      )}
    </View>
  );
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    searchBar: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md },
    input: { minHeight: 54, paddingHorizontal: space.lg, borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: t.soft, color: t.text },
    map: { height: 420, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: t.soft, ...outline(t) },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
    card: { borderRadius: radius.lg, borderCurve: 'continuous', padding: space.md, gap: space.md },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 72 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
    actions: { flexDirection: 'row', gap: space.sm },
  });

/**
 * Arama sonucu kartı. Kapalıyken: fotoğraf, ad, tür ve yer, dönem, metnin ilk satırları.
 * Açılınca: büyük fotoğraf, uzun özet, adres, kitap kaynağı ve eylemler (eser sayfası, yol tarifi).
 * Açılma animasyonsuz (reduce motion sorunu doğmaz); ekran okuyucuya açık/kapalı durumu bildirilir.
 */
function ResultCard({ work, open, onToggle, t }: { work: WorkRow; open: boolean; onToggle: () => void; t: SweetTheme }) {
  const s = makeStyles(t);
  const { t: tr, lang } = useT();
  const { visited } = useSettings();
  const name = loc(work.name, lang);
  const place = workPlace(work, lang);
  const era = workEra(work, lang);
  const excerpt = workExcerpt(work, lang, open ? 420 : 140);
  const address = loc(work.address, lang);
  const inv = inventorySource(work);
  const ref = inv?.page ? (inv.volume ? tr('inv.refShort', { v: inv.volume, page: inv.page }) : tr('inv.refPage', { page: inv.page })) : null;
  const route = hasRouteTo(work.slug);
  const openPage = () => router.push({ pathname: '/work/[slug]', params: { slug: work.slug } });

  return (
    <View style={[s.card, { backgroundColor: t.surface }, outline(t)]}>
      <SoftPressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${name}. ${place}${era ? `. ${era}` : ''}`}
        accessibilityHint={open ? tr('search.collapse') : tr('search.expand')}
        style={s.head}>
        {open && work.photos.length > 0 ? null : <WorkThumb work={work} size={open ? 56 : 84} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={open ? undefined : 2}>
            {name}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{place}</Text>
          {era ? <Text style={[type.meta, { color: t.textMuted }]}>{era}</Text> : null}
          {!open && excerpt ? (
            <Text style={[type.body, { color: t.text }]} numberOfLines={2}>
              {excerpt}
            </Text>
          ) : null}
          <View style={s.badges}>
            {route ? <Badge label={tr('search.routeReady')} tone="primary" /> : null}
            {visited.includes(work.slug) ? <Badge label={tr('work.visited')} /> : null}
            {work.photos.length > 0 ? <Badge label={tr('search.photos', { n: work.photos.length })} /> : null}
          </View>
        </View>
        <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
          <ChevronIcon color={t.textMuted} />
        </View>
      </SoftPressable>

      {open ? (
        <>
          {work.photos.length > 0 ? <WorkThumb work={work} size={0} wide /> : null}
          {excerpt ? <Text style={[type.body, { color: t.text }]}>{excerpt}</Text> : null}
          {address ? (
            <View style={{ gap: 2 }}>
              <Eyebrow text={tr('design.location')} />
              <Text style={[type.body, { color: t.text }]}>{address}</Text>
            </View>
          ) : null}
          {!excerpt && ref ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.historyRef', { ref })}</Text> : null}
          <View style={s.actions}>
            <Button style={{ flex: 1 }} label={tr('search.openWork')} onPress={openPage} />
            {route ? (
              <Button
                style={{ flex: 1 }}
                variant="outline"
                label={tr('work.directions')}
                onPress={() => router.push({ pathname: '/navigate', params: { dest: work.slug } })}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}
