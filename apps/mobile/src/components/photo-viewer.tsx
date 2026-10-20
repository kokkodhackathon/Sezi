import { loc, type WorkPhoto } from '@sezi/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useT } from '@/lib/i18n';
import { photoUrl } from '@/lib/works';

/**
 * Tam ekran fotoğraf görüntüleyici: yatay kaydırma, alt metin ve telif satırı.
 * Zemin her temada koyudur (fotoğrafın kendisi öne çıksın); metinler beyaz.
 */
export function PhotoViewer({ photos, start, onClose }: { photos: WorkPhoto[]; start: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t: tr, lang } = useT();
  const [index, setIndex] = useState(start ?? 0);
  const current = photos[index];

  return (
    <Modal visible={start !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={start ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p) => p.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Image
              source={{ uri: photoUrl(item, 'full') }}
              placeholder={{ uri: photoUrl(item, 'thumb') }}
              style={{ width, height }}
              contentFit="contain"
              accessible
              accessibilityLabel={loc(item.alt, lang)}
            />
          )}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('work.viewerClose')}
          style={[styles.close, { top: insets.top + space.sm }]}>
          <CloseIcon color="#FFFFFF" />
        </Pressable>
        {current ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + space.lg }]} accessibilityLiveRegion="polite">
            <Text style={[type.body, styles.light]}>{loc(current.alt, lang)}</Text>
            <Text style={[type.meta, styles.dim]}>
              {[photos.length > 1 ? tr('work.viewerPos', { i: index + 1, n: photos.length }) : null, current.credit].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0C0B' },
  close: { position: 'absolute', right: space.lg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.lg, gap: 4, backgroundColor: 'rgba(14,12,11,0.72)' },
  light: { color: '#FFFFFF' },
  dim: { color: 'rgba(255,255,255,0.78)' },
});
