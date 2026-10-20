import { sideText, type SoundVoice } from '@sezi/shared';
import { StyleSheet, Text, View } from 'react-native';

import { outline } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * Ses altyazısı: ses manzarasının yazılı karşılığı ("[su sesi] Sebil · sağınızda · 20 m").
 * Duymayan kullanıcı ve kalabalık modu için zorunlu; jüriye de sesin ne yaptığını gösterir.
 * Ses düzeyi çubukla da gösterilir (yalnızca renkle değil, uzunlukla).
 */
export function SoundCaptions({ sounds, muted }: { sounds: SoundVoice[]; muted: boolean }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  return (
    <View style={[styles.box, { backgroundColor: t.soft }, outline(t)]}>
      <Text style={[type.eyebrow, { color: t.primaryText }]}>{tr('sound.title')}</Text>
      {sounds.length === 0 ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('sound.none')}</Text> : null}
      {sounds.map((v) => {
        const kind = tr(`sound.${v.kind}` as MessageKey);
        const d = Math.max(5, Math.round(v.distanceM / 5) * 5);
        const text = `[${kind}] ${v.name} · ${sideText(v.relDeg, lang)} · ${d} m`;
        return (
          <View key={v.id} style={styles.row} accessible accessibilityLabel={text}>
            <View style={[styles.meter, { backgroundColor: t.border }]}>
              <View style={{ width: `${Math.round(v.gain * 100)}%`, height: '100%', backgroundColor: t.primary.fill, borderRadius: 3 }} />
            </View>
            <Text style={[type.meta, { color: t.text, flex: 1 }]}>{text}</Text>
          </View>
        );
      })}
      {muted && sounds.length > 0 ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('sound.muted')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm, padding: space.lg, borderRadius: radius.xl, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meter: { width: 44, height: 6, borderRadius: 3, overflow: 'hidden' },
});
