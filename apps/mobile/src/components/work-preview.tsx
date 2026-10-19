import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type Lang } from '@/lib/i18n';
import { coverOf, loc, photoUrl, type WorkRow } from '@/lib/works';

/**
 * Eserin kısa önizlemesi (arama sonucu, yürüyüşte nokta kartı). Tam bilgi eser sayfasında;
 * burada yalnız fotoğraf, tür, yer, dönem ve metnin ilk cümleleri.
 */

/** Tür · ilçe, il. */
export function workPlace(w: WorkRow, lang: Lang): string {
  const where = [w.district, loc(w.city_name, lang)].filter(Boolean).join(', ');
  return [loc(w.type_name, lang), where].filter(Boolean).join(' · ');
}

/** Dönem ve yapım yılı: "Osmanlı · 1490". */
export function workEra(w: WorkRow, lang: Lang): string {
  return [loc(w.period, lang), w.built_year ? String(w.built_year) : ''].filter(Boolean).join(' · ');
}

/** Özet ya da tarihçenin başı; cümle ortasında kesilmez, en çok `max` karakter. */
export function workExcerpt(w: WorkRow, lang: Lang, max = 180): string {
  const text = (loc(w.summary, lang) || loc(w.history, lang)).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > max / 2 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Kapak fotoğrafı (küçük boy) ya da fotoğraf yoksa tür glifi. Dekoratif: ad yanındaki metinden gelir. */
export function WorkThumb({ work, size, wide }: { work: WorkRow; size: number; wide?: boolean }) {
  const t = useSeziTheme();
  const cover = coverOf(work);
  const box = wide ? { width: '100%' as const, aspectRatio: 16 / 9 } : { width: size, height: size };
  if (cover) {
    return (
      <Image
        source={{ uri: photoUrl(cover, wide ? 'full' : 'thumb') }}
        placeholder={wide ? { uri: photoUrl(cover, 'thumb') } : undefined}
        style={[box, { borderRadius: radius.md, backgroundColor: t.soft }]}
        contentFit="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    );
  }
  // Fotoğraf yoksa tür karosu kutunun tamamını doldurur (iç içe çerçeve yok); geniş görünümde ortada glif.
  if (!wide) return <WorkGlyph slug={work.type_slug} size={size} />;
  return (
    <View style={[box, styles.glyphBox, { backgroundColor: t.soft }]}>
      <WorkGlyph slug={work.type_slug} size={56} />
    </View>
  );
}

/**
 * Yürüyüş kartındaki eser şeridi: dokununca eser sayfası açılır.
 * Kartın başlığı eserin adıyla aynıysa ad tekrarlanmaz; şerit tür ve yerle başlar.
 */
export function WorkPeek({ work, cardTitle, onOpen }: { work: WorkRow; cardTitle: string; onOpen: () => void }) {
  const t = useSeziTheme();
  const { t: tr, lang } = useT();
  const name = loc(work.name, lang);
  const place = workPlace(work, lang);
  const era = workEra(work, lang);
  const showName = normalizeName(name) !== normalizeName(cardTitle);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${place}${era ? `. ${era}` : ''}`}
      accessibilityHint={tr('nav.workPage')}
      style={({ pressed }) => [styles.peek, { backgroundColor: pressed ? t.border : t.soft }]}>
      <WorkThumb work={work} size={64} />
      <View style={{ flex: 1, gap: 2 }}>
        {showName ? (
          <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
            {name}
          </Text>
        ) : null}
        <Text style={showName ? [type.meta, { color: t.textMuted }] : [type.itemTitle, { color: t.text }]} numberOfLines={showName ? 1 : 2}>
          {place}
        </Text>
        {era ? (
          <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
            {era}
          </Text>
        ) : null}
        <Text style={[type.meta, { color: t.primary }]}>{tr('nav.workDetails')}</Text>
      </View>
      <ChevronIcon color={t.textMuted} />
    </Pressable>
  );
}

const normalizeName = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

const styles = StyleSheet.create({
  glyphBox: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  peek: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingRight: space.md, borderRadius: radius.lg, minHeight: 80 },
});
