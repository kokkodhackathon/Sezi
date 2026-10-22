import { isAttributed, isCommons, loc, type WorkPhoto } from '@sezi/shared';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Card, ListRow } from '@/components/ui';
import { ExternalIcon } from '@/design/icons';
import { outline, SweetSheet } from '@/design/sweet/components';
import { font, radius, space } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

/**
 * Fotoğraf atfı: Commons'ta kaynak adı eklenir, yüklemelerde yazar ve lisans gösterilir.
 * Envanterin mevcut fotoğrafçı kredisi korunur.
 */
export function formatPhotoCredit(photo: WorkPhoto, lang: 'tr' | 'en'): string | null {
  if (!isAttributed(photo)) return photo.credit;
  const author = photo.author?.trim() || (lang === 'tr' ? 'Yazar belirtilmemiş' : 'Author not stated');
  return [author, photo.license?.trim(), isCommons(photo) ? 'Wikimedia Commons' : null].filter(Boolean).join(' · ');
}

export interface PhotoSourceTagProps {
  photo: WorkPhoto | undefined;
  style?: StyleProp<ViewStyle>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

/**
 * Fotoğrafların köşesinde yer alan kaynak etiketi (≥ 48 dp dokunma alanı).
 * Commons ve yönetici yüklemelerinin yazar, lisans ve kaynak ayrıntılarını açar.
 */
export function PhotoSourceTag({ photo, style, position = 'bottom-right' }: PhotoSourceTagProps) {
  const [open, setOpen] = useState(false);
  const t = useSweetTheme();
  const { t: tr, lang } = useT();

  if (!photo || !isAttributed(photo)) return null;

  const bg = t.outlined ? t.background : `${t.background}D9`;
  const authorText = photo.author?.trim() || tr('commons.authorMissing');
  const modText = loc(photo.modifications, lang);

  return (
    <>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={tr('commons.tagLabel')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={[styles.tag, posStyle[position], { backgroundColor: bg }, outline(t), style]}>
        <Text numberOfLines={1} style={[styles.tagText, { color: t.text }]}>{isCommons(photo) ? tr('commons.tag') : tr('commons.photoBy', { author: authorText })}</Text>
      </Pressable>

      <SweetSheet visible={open} onClose={() => setOpen(false)} title={tr(isCommons(photo) ? 'commons.sheetTitle' : 'photo.sourceTitle')}>
        <View style={styles.sheetContent}>
          <Card padded={false}>
            <ListRow first title={tr('commons.photoBy', { author: authorText })} />
            {photo.license ? (
              <ListRow
                title={tr('commons.license', { license: photo.license })}
                hint={photo.license_url ? tr('commons.openLicense') : undefined}
                trailing={photo.license_url ? <ExternalIcon color={t.primaryText} size={16} /> : null}
                onPress={photo.license_url ? () => void Linking.openURL(photo.license_url!).catch(() => {}) : undefined}
              />
            ) : null}
            {modText ? <ListRow title={tr('commons.modifications', { modifications: modText })} /> : null}
          </Card>
          {photo.source_url ? (
            <Button
              variant="outline"
              label={tr(isCommons(photo) ? 'commons.openSource' : 'photo.openSource')}
              icon={(c) => <ExternalIcon color={c} size={18} />}
              onPress={() => void Linking.openURL(photo.source_url!).catch(() => {})}
            />
          ) : null}
        </View>
      </SweetSheet>
    </>
  );
}

/**
 * Küçük listeleme küçük resimlerinde (< ~120 dp) gösterilen tıklanamayan küçük etiket.
 */
export function PhotoSourceThumbTag({ photo, style }: { photo: WorkPhoto | undefined; style?: StyleProp<ViewStyle> }) {
  const t = useSweetTheme();
  const { t: tr } = useT();

  if (!photo || !isAttributed(photo)) return null;

  const bg = t.outlined ? t.background : `${t.background}D9`;

  return (
    <View pointerEvents="none" accessible={false} style={[styles.thumbTag, { backgroundColor: bg }, outline(t), style]}>
      <Text numberOfLines={1} style={[styles.thumbTagText, { color: t.text }]}>{isCommons(photo) ? tr('commons.thumbTag') : tr('commons.photoBy', { author: photo.author?.trim() || tr('commons.authorMissing') })}</Text>
    </View>
  );
}

const posStyle = {
  'bottom-right': { bottom: space.sm, right: space.sm },
  'bottom-left': { bottom: space.sm, left: space.sm },
  'top-right': { top: space.sm, right: space.sm },
  'top-left': { top: space.sm, left: space.sm },
};

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    minWidth: 48,
    minHeight: 48,
    maxWidth: '60%',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: font.round,
    fontSize: 12,
    lineHeight: 16,
  },
  thumbTag: {
    position: 'absolute',
    bottom: space.xs,
    maxWidth: '90%',
    right: space.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTagText: {
    fontFamily: font.round,
    fontSize: 10,
    lineHeight: 13,
  },
  sheetContent: {
    paddingHorizontal: space.xl,
    gap: space.md,
    paddingBottom: space.lg,
  },
});
