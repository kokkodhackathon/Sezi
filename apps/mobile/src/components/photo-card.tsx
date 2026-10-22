import { coverOf, loc, toneForType, type SweetTheme, type WorkPhoto, type WorkRow } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useId } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type DimensionValue } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PhotoSourceTag } from '@/components/photo-source';
import { Button } from '@/components/ui';
import { WorkThumb, workEra, workExcerpt, workPlace } from '@/components/work-preview';
import { a11yLabel, outline, SoftPressable, SweetSheet } from '@/design/sweet/components';
import { duration } from '@/design/sweet/motion';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { StarIcon } from '@/design/icons';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { photoUrl } from '@/lib/works';

/** Fotoğrafın koyu örtüsünde okunacak açık tema rengi. */
export function photoOverlayInk(t: SweetTheme): string {
  return t.text === t.shadow ? t.surface : t.text;
}

export interface PhotoScrimProps { height?: DimensionValue }

/** Native bulanıklık yerine sabit SVG örtüsü; yüksek kontrastta düz metin zemini kullanılır. */
export function PhotoScrim({ height = '60%' }: PhotoScrimProps) {
  const t = useSweetTheme();
  const id = useId();
  if (t.outlined) return null;
  return (
    <View pointerEvents="none" accessible={false} style={[s.scrim, { height }]}>
      <Svg width="100%" height="100%" accessible={false}>
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.shadow} stopOpacity={0} />
          <Stop offset="0.45" stopColor={t.shadow} stopOpacity={0.7} />
          <Stop offset="1" stopColor={t.shadow} stopOpacity={0.97} />
        </LinearGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

interface PhotoCardBaseProps {
  width: number;
  aspectRatio?: number;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}
export type PhotoCardProps = PhotoCardBaseProps & (
  | { work: WorkRow; title?: never; meta?: never; typeSlug?: never; photo?: never; detail?: never }
  | { work?: never; title: string; meta: string; typeSlug: string; photo?: WorkPhoto; detail?: string }
);

/** Web ile aynı fotoğraf vitrini: 4:5 kapak, altta ad ve tür/il; gölge yok. */
export function PhotoCard(props: PhotoCardProps) {
  const t = useSweetTheme();
  const { fontScale } = useWindowDimensions();
  const { t: tr, lang } = useT();
  const { work, width, aspectRatio = 4 / 5, onPress, onLongPress } = props;
  const title = props.work ? loc(props.work.name, lang) : props.title;
  const slug = props.work ? props.work.type_slug : props.typeSlug;
  const photo = work ? coverOf(work) : props.photo;
  const meta = props.work ? loc(props.work.city_name, lang) : props.meta;
  const kind = work ? loc(work.type_name, lang) : undefined;
  const tone = t.tones[toneForType(slug)];
  const ink = photo && !t.outlined ? photoOverlayInk(t) : t.text;
  const minHeight = fontScale > 1 ? (type.cardTitle.lineHeight * 2 + type.meta.lineHeight * 2 + type.bubble.lineHeight * 2) * fontScale + space.xxl * 2 : 48;
  const preview = onLongPress ? () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress();
  } : undefined;
  return (
    <View style={{ width }}>
      <SoftPressable
        onPress={onPress}
        onLongPress={preview}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? (work ? a11yLabel(work, lang, tr) : `${title}. ${meta}. ${props.detail ?? ''}`)}
        accessibilityHint={props.accessibilityHint ?? (preview ? tr('photoCard.previewHint') : undefined)}
        accessibilityActions={preview ? [{ name: 'preview', label: tr('photoCard.preview') }] : undefined}
        onAccessibilityAction={preview ? (event) => { if (event.nativeEvent.actionName === 'preview') preview(); } : undefined}
        style={[s.card, { aspectRatio, minHeight, backgroundColor: tone.fill }, outline(t)]}>
        {/* Önizleme de kutuyu doldurur (expo-image varsayılanı scale-down, küçük resim kartın ortasında kalıyordu). Dar kartta küçük sürüm yeter. */}
        {photo ? <Image source={{ uri: photoUrl(photo, width < 240 ? 'thumb' : 'full') }} placeholder={width < 240 ? undefined : { uri: photoUrl(photo, 'thumb') }} placeholderContentFit="cover" style={StyleSheet.absoluteFill} contentFit="cover" transition={duration.fade} accessible={false} /> : (
          <View style={s.glyph}><WorkGlyphInline slug={slug} color={tone.ink} size={56} /></View>
        )}
        {photo ? <PhotoScrim height="75%" /> : null}
        {work?.unesco ? (
          <View style={[s.star, { backgroundColor: t.accent.fill }]} accessible={false}>
            <StarIcon color={t.accent.ink} size={15} />
          </View>
        ) : null}
        <View style={[s.caption, photo && t.outlined && { backgroundColor: t.background }]}>
          <Text style={[type.cardTitle, { color: ink }]} numberOfLines={2}>{title}</Text>
          {kind ? <View style={[s.kind, { backgroundColor: tone.fill }, outline(t)]}><WorkGlyphInline slug={slug} color={tone.ink} size={14} /><Text style={[type.bubble, { color: tone.ink }]} numberOfLines={1}>{kind}</Text></View> : null}
          <Text style={[type.meta, { color: ink }]} numberOfLines={2}>{meta}</Text>
          {!work && props.detail ? <Text style={[type.bubble, { color: ink }]}>{props.detail}</Text> : null}
        </View>
      </SoftPressable>
      <PhotoSourceTag photo={photo} position="top-right" />
    </View>
  );
}

/** Uzun basma ve ekran okuyucu özel eylemi aynı gerçek eser önizlemesini açar. */
export function WorkPreviewSheet({ work, onClose, onOpen }: { work: WorkRow | null; onClose: () => void; onOpen: (slug: string) => void }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const excerpt = work ? workExcerpt(work, lang, 420) : '';
  const era = work ? workEra(work, lang) : '';
  return (
    <SweetSheet visible={!!work} onClose={onClose} title={work ? loc(work.name, lang) : tr('photoCard.preview')}>
      {work ? <ScrollView contentContainerStyle={s.preview}>
        <View><WorkThumb work={work} size={0} wide /><PhotoSourceTag photo={coverOf(work)} position="top-right" /></View>
        <Text style={[type.meta, { color: t.textMuted }]}>{workPlace(work, lang)}</Text>
        {era ? <Text style={[type.meta, { color: t.textMuted }]}>{era}</Text> : null}
        {excerpt ? <Text style={[type.body, { color: t.text }]}>{excerpt}</Text> : null}
        <Button label={tr('search.openWork')} onPress={() => { onClose(); onOpen(work.slug); }} />
      </ScrollView> : null}
    </SweetSheet>
  );
}

const s = StyleSheet.create({
  card: { minHeight: 48, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  glyph: { position: 'absolute', top: '14%', left: 0, right: 0, alignItems: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  caption: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: space.md, gap: space.xs },
  kind: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm },
  preview: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md },
  star: { position: 'absolute', top: space.sm, left: space.sm, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
