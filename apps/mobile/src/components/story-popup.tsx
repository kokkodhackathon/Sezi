import type { StoryPoint } from '@sezi/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Eyebrow } from '@/components/ui';
import { PlayIcon, StopIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';

/**
 * Anlatım noktası bilgisi: yarıçapa girilince ekranın altında açılır.
 * Sesin yazılı karşılığıdır; ekran okuyucu hemen duyurur. Animasyon yok (reduce motion sorunu doğmaz).
 */
export function StoryPopup({
  point,
  playing,
  canPlay,
  queued,
  onPlay,
  onStop,
  onClose,
}: {
  point: StoryPoint;
  playing: boolean;
  canPlay: boolean;
  queued: number;
  onPlay: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const t = useSeziTheme();
  const { t: tr, lang } = useT();
  const title = point.title[lang] ?? point.title.tr;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Card style={styles.card}>
        <View accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityViewIsModal style={{ gap: space.sm }}>
          <Eyebrow text={tr('story.reached')} color={t.accent} />
          <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView style={{ maxHeight: 220 }}>
            <Text style={[type.body, { color: t.text }]}>{point.body[lang] ?? point.body.tr}</Text>
          </ScrollView>
          {queued > 0 ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('story.next', { n: queued })}</Text> : null}
          <View style={styles.row}>
            {canPlay ? (
              <Button
                style={{ flex: 1 }}
                label={playing ? tr('story.stop') : tr('story.listen')}
                onPress={playing ? onStop : onPlay}
                icon={(c) => (playing ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
              />
            ) : null}
            <Button style={{ flex: 1 }} variant="outline" label={tr('story.close')} onPress={onClose} />
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg },
  card: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
});
