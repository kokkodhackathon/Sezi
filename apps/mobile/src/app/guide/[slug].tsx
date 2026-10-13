import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CueFlash } from '@/components/cue-flash';
import { Button, EmptyState, Segmented } from '@/components/ui';
import { CloseIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { radius, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { useNavSession } from '@/lib/sim/session';

export default function Guide() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { settings, markVisited } = useSettings();
  const [showSpeed, setShowSpeed] = useState(false);
  // Rota ekranıyla aynı oturum: tam ekrana geçince ilerleme sürer.
  const sim = useNavSession(slug, profile, { speechRate: settings.speechRate, onArrive: markVisited });
  const { plan } = sim;
  const { speed } = sim.state;
  const s = useMemo(() => styles(t), [t]);
  if (!profile || !plan) return <SafeAreaView style={s.screen}><EmptyState title={tr('route.none')} action={<Button label={tr('guide.exit')} onPress={() => router.back()} />} /></SafeAreaView>;
  const { stepIndex, running, finished, distance } = sim.state;
  const current = stepIndex >= 0 ? plan.steps[stepIndex] : undefined;
  const upcoming = plan.steps[stepIndex + 1];
  const endName = plan.end.name?.[lang] ?? plan.end.name?.tr ?? '';
  const left = Math.max(0, Math.round(sim.total - distance));
  const headline = finished ? `${tr('guide.arrived')}: ${endName}` : current?.text ?? tr('route.ready');
  const progress = sim.total > 0 ? Math.min(100, Math.round(distance / sim.total * 100)) : 0;
  const playLabel = running ? tr('route.pause') : finished ? tr('route.restart') : distance > 0 ? tr('route.resume') : tr('route.start');
  return <SafeAreaView style={s.screen}>
    <View style={s.top}>
      <View style={{ flex: 1, gap: 4 }}><Text style={[type.meta, { color: t.primary }]}>{tr('design.simulation')}</Text><Text style={[type.itemTitle, { color: t.text }]}>{endName}</Text></View>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('guide.exit')} style={s.close}><CloseIcon color={t.text} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={s.stage}>
      <View style={s.arrow}><TurnIcon turn={current?.turn ?? 'straight'} arrived={finished} color={t.primary} size={88} /></View>
      <Text style={[type.display, s.instruction, { color: t.text }]} accessibilityRole="header" accessibilityLiveRegion="assertive">{headline}</Text>
      <Text style={[type.lead, { color: t.primary }]}>{tr('guide.distanceLeft', { m: left })}</Text>
      {upcoming && running && !finished ? <Text style={[type.body, { color: t.textMuted }]}>{tr('route.next')}: {upcoming.text}</Text> : null}
      <Text style={[type.meta, { color: t.textMuted }]}>{tr('design.simulationBody')}</Text>
    </ScrollView>
    <View style={s.footer}>
      <View style={s.track} accessibilityRole="progressbar" accessibilityLabel={tr('route.progress', { done: Math.round(distance), total: Math.round(sim.total) })} accessibilityValue={{ min: 0, max: 100, now: progress }}><View style={[s.fill, { width: `${progress}%` }]} /></View>
      <Button label={playLabel} onPress={running ? sim.pause : sim.play} icon={(c) => running ? <StopIcon color={c} /> : <PlayIcon color={c} />} />
      <Button variant="outline" label={tr('design.repeat')} onPress={sim.repeat} disabled={stepIndex < 0} />
      <Pressable onPress={() => setShowSpeed(!showSpeed)} accessibilityRole="button" accessibilityLabel={tr('design.speed')} accessibilityState={{ expanded: showSpeed }} style={s.speedLink}><Text style={[type.meta, { color: t.primary }]}>{tr('design.speed')} · {speed}×</Text></Pressable>
      {showSpeed ? <Segmented label={tr('design.speed')} value={speed} onChange={sim.setSpeed} options={[1, 3, 8].map((value) => ({ value, label: `${value}×` }))} /> : null}
    </View>
    <CueFlash count={sim.state.cueCount} color={t.primary} enabled={profile.hearing !== 'full'} />
  </SafeAreaView>;
}

const styles = (t: ReturnType<typeof useSeziTheme>) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stage: { flexGrow: 1, justifyContent: 'center', gap: 24, padding: 24 },
  arrow: { alignSelf: 'flex-start', padding: 12, backgroundColor: t.surface, borderRadius: radius.lg },
  instruction: { fontSize: 32, lineHeight: 40 },
  footer: { gap: 8, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: t.border },
  track: { height: 4, backgroundColor: t.border, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  fill: { height: 4, backgroundColor: t.primary },
  speedLink: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
