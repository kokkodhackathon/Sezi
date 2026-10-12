import { palette, themes } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { KilimBand } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { useT } from '@/lib/i18n';
import { planRoute } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { useGuidanceSimulation } from '@/lib/simulation';

// Rehberlik ekranı temadan bağımsız her zaman koyu ve yüksek kontrastlıdır (sokakta parlama, pil, odak).
const C = { bg: themes.dark.background, surface: themes.dark.surface, text: '#FFF8EE', muted: themes.dark.textMuted, accent: palette.turquoiseLight, warm: themes.dark.accent };
const SPEEDS = [1, 3, 8];

export default function Guide() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { settings, markVisited } = useSettings();
  const plan = useMemo(() => (profile ? planRoute(slug, profile) : null), [slug, profile]);
  const [speed, setSpeed] = useState(1);
  const sim = useGuidanceSimulation(plan, profile!, speed, { speechRate: settings.speechRate, onArrive: () => markVisited(slug) });

  if (!profile || !plan) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={[type.lead, { color: C.text, padding: space.xl }]}>{tr('route.none')}</Text>
      </SafeAreaView>
    );
  }

  const { stepIndex, running, finished, distance } = sim.state;
  const current = stepIndex >= 0 ? plan.steps[stepIndex] : undefined;
  const upcoming = plan.steps[stepIndex + 1];
  const endName = plan.end.name?.[lang] ?? plan.end.name?.tr ?? '';
  const left = Math.max(0, Math.round(sim.total - distance));
  const headline = finished ? `${tr('guide.arrived')}: ${endName}` : (current?.text ?? tr('route.ready'));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ height: 10 }}>
        <KilimBand color={C.warm} accent={C.accent} height={10} opacity={0.8} />
      </View>

      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.eyebrow, { color: C.accent }]}>{upper(tr('route.eyebrow'), lang)}</Text>
          <Text style={[type.itemTitle, { color: C.text }]} numberOfLines={1}>
            {endName}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('guide.exit')} style={styles.close}>
          <Text style={[type.button, { color: C.text, fontSize: 26, lineHeight: 28 }]}>×</Text>
        </Pressable>
      </View>

      {/* Ekranın büyük bölümü tek dokunma hedefi: dokununca talimat tekrar okunur. */}
      <Pressable
        onPress={sim.repeat}
        accessibilityRole="button"
        accessibilityLabel={headline}
        accessibilityHint={tr('guide.tapToRepeat')}
        accessibilityLiveRegion="assertive"
        style={styles.stage}>
        <View style={styles.arrow}>
          <TurnIcon turn={current?.turn ?? 'straight'} arrived={finished} color={C.bg} size={84} />
        </View>
        <Text style={styles.instruction}>{headline}</Text>
        {upcoming && !finished && running ? (
          <Text style={[type.lead, { color: C.muted, textAlign: 'center' }]}>
            {tr('route.next')}: {upcoming.text}
          </Text>
        ) : null}
        <Text style={[type.button, { color: C.accent }]}>{tr('guide.distanceLeft', { m: left })}</Text>
      </Pressable>

      <View style={styles.progress} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.progressFill, { width: `${Math.min(100, (distance / sim.total) * 100)}%` }]} />
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={running ? sim.pause : sim.play}
          accessibilityRole="button"
          style={({ pressed }) => [styles.mainBtn, pressed && { opacity: 0.85 }]}>
          {running ? <StopIcon color={C.bg} size={26} /> : <PlayIcon color={C.bg} size={26} />}
          <Text style={[type.button, { color: C.bg, fontSize: 20 }]}>
            {running ? tr('route.pause') : finished ? tr('route.restart') : distance > 0 ? tr('route.resume') : tr('route.start')}
          </Text>
        </Pressable>
        <View style={styles.speeds} accessibilityRole="radiogroup" accessibilityLabel={tr('route.speed')}>
          {SPEEDS.map((v) => (
            <Pressable
              key={v}
              onPress={() => setSpeed(v)}
              accessibilityRole="radio"
              accessibilityState={{ checked: v === speed }}
              style={[styles.speed, v === speed && { backgroundColor: C.text }]}>
              <Text style={[type.button, { color: v === speed ? C.bg : C.text }]}>{v}×</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.lg },
  close: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, paddingHorizontal: space.xl },
  arrow: { width: 148, height: 148, borderRadius: 74, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  instruction: { fontFamily: type.display.fontFamily, fontSize: 36, lineHeight: 44, color: C.text, textAlign: 'center' },
  progress: { height: 8, marginHorizontal: space.xl, borderRadius: 4, backgroundColor: C.surface, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: C.warm },
  controls: { padding: space.xl, gap: space.md },
  mainBtn: { flexDirection: 'row', gap: space.md, minHeight: 72, borderRadius: radius.pill, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  speeds: { flexDirection: 'row', gap: space.sm },
  speed: { flex: 1, minHeight: 52, borderRadius: radius.pill, borderWidth: 2, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
});
