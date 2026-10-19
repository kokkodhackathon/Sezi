import type { NavPoint } from '@sezi/shared';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Eyebrow, softShadow } from '@/components/ui';
import { WorkPeek } from '@/components/work-preview';
import { PlayIcon, StopIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useWork } from '@/lib/works';

/**
 * Nokta bilgisi: yarıçapa girilince ekranın altından açılır. Sesin yazılı karşılığıdır;
 * ekran okuyucu hemen duyurur. Animasyon yok (reduce motion sorunu doğmaz).
 * Nokta bir esere bağlıysa (admin → Noktalar) eserin fotoğrafı ve kısa bilgisi de görünür; dokununca eser
 * sayfası açılır. Yürüyüş arkada sürer, geri dönülünce kart yerinde durur.
 */
export function PointPopup({
  point,
  order,
  playing,
  canPlay,
  queued,
  onPlay,
  onStop,
  onClose,
}: {
  point: NavPoint;
  /** Rotadaki sıra numarası (haritadaki numarayla aynı). */
  order?: number;
  playing: boolean;
  canPlay: boolean;
  queued: number;
  onPlay: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const t = useSeziTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, lang } = useT();
  const title = point.title[lang] ?? point.title.tr;
  const body = point.body ? (point.body[lang] ?? point.body.tr) : '';
  // İnternet yoksa ve eser önbellekte değilse şerit görünmez; nokta metni yine okunur.
  const { data: work } = useWork(point.workSlug ?? '');
  const eyebrow = order ? tr('nav.pointOrder', { n: order }) : tr('nav.point');
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
      <View style={[styles.sheet, softShadow(t), { backgroundColor: t.surface }]} accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityViewIsModal>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        <Eyebrow text={eyebrow} color={t.accent} />
        <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
          {title}
        </Text>
        {work ? <WorkPeek work={work} cardTitle={title} onOpen={() => router.push({ pathname: '/work/[slug]', params: { slug: work.slug } })} /> : null}
        <ScrollView style={{ maxHeight: work ? 180 : 240 }}>
          <Text style={[type.body, { color: t.text }]}>{body}</Text>
        </ScrollView>
        {queued > 0 ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('nav.pointQueued', { n: queued })}</Text> : null}
        <View style={styles.row}>
          {canPlay ? (
            <Button
              style={{ flex: 1 }}
              label={playing ? tr('nav.stopAudio') : tr('nav.listen')}
              onPress={playing ? onStop : onPlay}
              icon={(c) => (playing ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
            />
          ) : null}
          <Button style={{ flex: 1 }} variant="outline" label={queued > 0 ? tr('nav.nextPoint') : tr('nav.continue')} onPress={onClose} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md },
  sheet: { gap: space.sm, padding: space.xl, paddingTop: space.md, borderRadius: radius.xl + 4 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
