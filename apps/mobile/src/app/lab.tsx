/**
 * Lab: native modül risk testi (harita, mekânsal ses, pusula, haptik, TTS).
 * Demo ekranı değildir; özellikler gerçek ekranlara taşındıkça sadeleşecek.
 */
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { type } from '@/design/type';
import { EndPin, SeziMap } from '@/components/map';
import { bearingDeg, stereoPan, type LngLat } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AudioContext, type OscillatorNode, type StereoPannerNode } from 'react-native-audio-api';

const ULU_CAMI: LngLat = [29.0618995, 40.1838059];

export default function Lab() {
  const t = useSeziTheme();
  const { t: tr } = useT();
  const [heading, setHeading] = useState<number | null>(null);
  const [position, setPosition] = useState<LngLat | null>(null);
  const [pan, setPan] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; panner: StereoPannerNode } | null>(null);

  const note = (msg: string) => setLog((l) => [msg, ...l].slice(0, 6));

  useEffect(() => {
    let headingSub: Location.LocationSubscription | undefined;
    let posSub: Location.LocationSubscription | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return note('Konum izni verilmedi');
      headingSub = await Location.watchHeadingAsync((h) => setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
      posSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 2 }, (p) =>
        setPosition([p.coords.longitude, p.coords.latitude]),
      );
    })().catch((e) => note(`Konum hatası: ${String(e)}`));
    return () => {
      headingSub?.remove();
      posSub?.remove();
      audio.current?.ctx.close();
    };
  }, []);

  // Pusula modu: ses, kullanıcıdan Bursa Ulu Cami'ye olan yöne panlanır.
  const target = bearingDeg(position ?? [29.0620479, 40.1834979], ULU_CAMI);
  const compassPan = heading === null ? 0 : stereoPan(heading, target);
  useEffect(() => {
    if (audio.current) audio.current.panner.pan.value = compassPan;
  }, [compassPan]);

  const startTone = (fixedPan?: number) => {
    stopTone();
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const panner = ctx.createStereoPanner();
    osc.frequency.value = 440;
    panner.pan.value = fixedPan ?? compassPan;
    osc.connect(panner);
    panner.connect(ctx.destination);
    osc.start();
    audio.current = { ctx, osc, panner };
    setPan(fixedPan ?? compassPan);
    note(`Ton başladı, pan=${(fixedPan ?? compassPan).toFixed(2)}`);
  };
  const stopTone = () => {
    if (!audio.current) return;
    audio.current.osc.stop();
    audio.current.ctx.close();
    audio.current = null;
  };


  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.body}>
      <SeziMap style={styles.map} initial={[ULU_CAMI]} initialZoom={16} accessibilityLabel={tr('lab.heading')}>
        <EndPin id="lab" location={ULU_CAMI} kind="end" />
      </SeziMap>

      <Text style={[styles.h, { color: t.text }]}>{tr("lab.heading")}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>
        Yön: {heading?.toFixed(0) ?? '—'}° · Hedef: {target.toFixed(0)}° · Pan: {compassPan.toFixed(2)}
      </Text>

      <Text style={[styles.h, { color: t.text }]}>{tr("lab.audio")}</Text>
      <View style={styles.row}>
        <Button compact label={tr("lab.left")} onPress={() => startTone(-1)} />
        <Button compact label={tr("lab.right")} onPress={() => startTone(1)} />
        <Button compact label={tr("lab.compass")} onPress={() => startTone()} />
        <Button compact variant="outline" label={tr("work.stop")} onPress={stopTone} />
      </View>

      <Text style={[styles.h, { color: t.text }]}>{tr("onb.senses.haptic")}</Text>
      <View style={styles.row}>
        <Button compact label={tr("lab.hapticLeft")} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)} />
        <Button compact label={tr("lab.hapticRight")} onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
        }} />
        <Button compact label={tr("lab.arrival")} onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)} />
      </View>

      <Text style={[styles.h, { color: t.text }]}>{tr("onb.senses.audio")}</Text>
      <View style={styles.row}>
        <Button compact label="Türkçe" onPress={() => Speech.speak("Sebilin su sesini duyunca meydanın sağına yönelin.", { language: "tr-TR" })} />
        <Button compact label="English" onPress={() => Speech.speak("When you hear the fountain, bear right across the square.", { language: "en-US" })} />
      </View>

      <Text style={[styles.h, { color: t.text }]}>{tr("lab.log")}</Text>
      {log.map((l, i) => (
        <Text key={i} style={[type.meta, { color: t.textMuted }]}>
          {l}
        </Text>
      ))}
      <Text style={[type.meta, { color: t.textMuted }]}>Son sabit pan: {pan.toFixed(2)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, gap: 8, paddingBottom: 48 },
  map: { height: 260, borderRadius: 12, overflow: 'hidden' },
  h: { ...type.heading, marginTop: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
