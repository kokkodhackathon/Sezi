/**
 * Lab: native modül risk testi (harita, mekânsal ses, pusula, haptik, TTS).
 * Demo ekranı değildir; özellikler gerçek ekranlara taşındıkça sadeleşecek.
 */
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { bearingDeg, stereoPan, themes, type LngLat } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { AudioContext, type OscillatorNode, type StereoPannerNode } from 'react-native-audio-api';

const SULEYMANIYE: LngLat = [28.9639, 41.0162];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function Lab() {
  const t = themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
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

  // Pusula modu: ses, kullanıcıdan Süleymaniye'ye olan yöne panlanır.
  const target = bearingDeg(position ?? [28.9600, 41.0140], SULEYMANIYE);
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

  const btn = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: t.primary, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={[styles.btnText, { color: t.onPrimary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.body}>
      <View style={styles.map}>
        <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE}>
          <Camera initialViewState={{ center: SULEYMANIYE, zoom: 16 }} />
          <Marker lngLat={SULEYMANIYE}>
            <View style={[styles.pin, { backgroundColor: t.accent }]} accessibilityLabel="Süleymaniye Camii" />
          </Marker>
        </Map>
      </View>

      <Text style={[styles.h, { color: t.text }]}>Pusula</Text>
      <Text style={{ color: t.textMuted }}>
        Yön: {heading?.toFixed(0) ?? '—'}° · Hedef: {target.toFixed(0)}° · Pan: {compassPan.toFixed(2)}
      </Text>

      <Text style={[styles.h, { color: t.text }]}>Mekânsal ses (kulaklıkla)</Text>
      <View style={styles.row}>
        {btn('Sol', () => startTone(-1))}
        {btn('Sağ', () => startTone(1))}
        {btn('Pusulaya göre', () => startTone())}
        {btn('Durdur', stopTone)}
      </View>

      <Text style={[styles.h, { color: t.text }]}>Haptik</Text>
      <View style={styles.row}>
        {btn('Sol (1)', () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))}
        {btn('Sağ (2)', async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
        })}
        {btn('Varış', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))}
      </View>

      <Text style={[styles.h, { color: t.text }]}>Sesli yönlendirme</Text>
      <View style={styles.row}>
        {btn('TR', () => Speech.speak('Sebilin su sesini duyunca meydanın sağına yönelin.', { language: 'tr-TR' }))}
        {btn('EN', () => Speech.speak('When you hear the fountain, bear right across the square.', { language: 'en-US' }))}
      </View>

      <Text style={[styles.h, { color: t.text }]}>Log</Text>
      {log.map((l, i) => (
        <Text key={i} style={{ color: t.textMuted }}>
          {l}
        </Text>
      ))}
      <Text style={{ color: t.textMuted }}>Son sabit pan: {pan.toFixed(2)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 8, paddingBottom: 48 },
  map: { height: 260, borderRadius: 12, overflow: 'hidden' },
  pin: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  h: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { minHeight: 48, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
});
