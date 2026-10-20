import { coverOf, loc, toneForType, type WorkRow } from '@sezi/shared';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { ChevronIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type Lang } from '@/lib/i18n';
import { photoUrl } from '@/lib/works';

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
  const t = useSweetTheme();
  const cover = coverOf(work);
  const tone = t.tones[toneForType(work.type_slug)];
  const box = wide ? { width: '100%' as const, aspectRatio: 16 / 9 } : { width: size, height: size };
  if (cover) {
    return (
      <Image
        source={{ uri: photoUrl(cover, wide ? 'full' : 'thumb') }}
        placeholder={wide ? { uri: photoUrl(cover, 'thumb') } : undefined}
        style={[box, styles.thumb, { backgroundColor: t.soft }, outline(t)]}
        contentFit="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[box, styles.glyphBox, { backgroundColor: tone.fill }, outline(t)]}>
      <WorkGlyphInline slug={work.type_slug} color={tone.ink} size={wide ? 48 : Math.round(size * 0.56)} />
    </View>
  );
}

/**
 * Yürüyüş kartındaki eser şeridi: dokununca eser sayfası açılır.
 * Kartın başlığı eserin adıyla aynıysa ad tekrarlanmaz; şerit tür ve yerle başlar.
 */
export function WorkPeek({ work, cardTitle, onOpen }: { work: WorkRow; cardTitle: string; onOpen: () => void }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const name = loc(work.name, lang);
  const place = workPlace(work, lang);
  const era = workEra(work, lang);
  const showName = name.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim() !== cardTitle.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  return (
    <SoftPressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${place}${era ? `. ${era}` : ''}`}
      accessibilityHint={tr('nav.workPage')}
      style={[styles.peek, { backgroundColor: t.soft }, outline(t)]}>
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
        <Text style={[type.meta, { color: t.primaryText }]}>{tr('nav.workDetails')}</Text>
      </View>
      <ChevronIcon color={t.textMuted} />
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: radius.md, borderCurve: 'continuous' },
  glyphBox: { borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    minHeight: 80,
  },
});
