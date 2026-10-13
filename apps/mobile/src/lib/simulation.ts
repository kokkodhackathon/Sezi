import { bearingDeg, pointAlong, stereoPan, type GuidanceStep, type LngLat, type Turn, type UserProfile } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AudioContext } from 'react-native-audio-api';

import type { PlannedRoute } from './nav';
import { walkingSpeed } from './nav';

const TICK_MS = 200;
/** Talimat, düğüme bu kadar metre kala verilir (yürüyüşçünün hazırlanması için). */
const ANNOUNCE_AHEAD_M = 12;

export interface SimState {
  running: boolean;
  finished: boolean;
  /** Rota başından yürünen mesafe (m). */
  distance: number;
  position: LngLat;
  heading: number;
  /** Son duyurulan adım (yoksa -1). */
  stepIndex: number;
  /** Her yeni talimatta artar: görsel uyarı (işitme engelli) bunu izler. */
  cueCount: number;
}

async function hapticForTurn(turn: Turn, arrived: boolean) {
  if (arrived) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const pulse = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (turn === 'left' || turn === 'slight_left') return pulse(); // sol: tek
  if (turn === 'right' || turn === 'slight_right') {
    await pulse(); // sağ: çift
    await new Promise((r) => setTimeout(r, 160));
    return pulse();
  }
  if (turn === 'back') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/**
 * Landmark ses ipucu: kulaklıkta landmark'ın yönüne panlanmış kısa iki nota.
 * Saha ses kayıtları gelene kadar geçici sentez tonu kullanılır.
 */
function playLandmarkCue(pan: number) {
  try {
    const ctx = new AudioContext();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(ctx.destination);
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.18 + 0.16);
      osc.connect(gain);
      gain.connect(panner);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.17);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Ses motoru açılamazsa rehberlik TTS ve titreşimle sürer.
  }
}

export function useGuidanceSimulation(
  plan: PlannedRoute | null,
  profile: UserProfile,
  speedFactor: number,
  opts: { speechRate?: number; onArrive?: () => void } = {},
) {
  const optsRef = useRef(opts);
  const total = plan ? plan.geometry.nodeAtM.at(-1)! : 0;
  const start = plan?.geometry.line[0] ?? ([0, 0] as LngLat);
  const [state, setState] = useState<SimState>({ running: false, finished: false, distance: 0, position: start, heading: 0, stepIndex: -1, cueCount: 0 });
  const ref = useRef(state);
  useLayoutEffect(() => { optsRef.current = opts; }, [opts]);
  useLayoutEffect(() => { ref.current = state; }, [state]);

  const announce = useCallback(
    (step: GuidanceStep, index: number, pos: LngLat, heading: number) => {
      if (!plan) return;
      const arrived = index === plan.steps.length - 1;
      // Duymayan kullanıcı: hiçbir bilgi yalnızca sesle verilmez; görsel uyarı (cueCount) ve titreşim kullanılır.
      const canHear = profile.hearing !== 'deaf';
      if (!canHear) {
        if (profile.senses.haptic) void hapticForTurn(step.turn, arrived);
        return;
      }
      if (profile.senses.audio && step.landmark) playLandmarkCue(stereoPan(heading, bearingDeg(pos, step.landmark.location)));
      if (profile.senses.haptic) void hapticForTurn(step.turn, arrived);
      if (profile.senses.audio) {
        Speech.stop();
        Speech.speak(step.text, { language: profile.lang === 'tr' ? 'tr-TR' : 'en-US', rate: optsRef.current.speechRate ?? 0.95 });
      }
    },
    [plan, profile],
  );

  useEffect(() => {
    if (!state.running || !plan) return;
    const speed = walkingSpeed(profile) * speedFactor;
    const id = setInterval(() => {
      const prev = ref.current;
      const distance = Math.min(total, prev.distance + (speed * TICK_MS) / 1000);
      const position = pointAlong(plan.geometry.line, distance);
      const ahead = pointAlong(plan.geometry.line, Math.min(total, distance + 3));
      const heading = distance < total ? bearingDeg(position, ahead) : prev.heading;

      let stepIndex = prev.stepIndex;
      while (stepIndex + 1 < plan.steps.length && plan.steps[stepIndex + 1]!.atM - ANNOUNCE_AHEAD_M <= distance) {
        stepIndex++;
        const isLast = stepIndex === plan.steps.length - 1;
        // Varış duyurusu ancak gerçekten varınca yapılır.
        if (isLast && distance < total) {
          stepIndex--;
          break;
        }
        announce(plan.steps[stepIndex]!, stepIndex, position, heading);
      }
      const finished = distance >= total && stepIndex === plan.steps.length - 1;
      if (finished && !prev.finished) optsRef.current.onArrive?.();
      const cueCount = prev.cueCount + (stepIndex - prev.stepIndex);
      setState({ running: !finished, finished, distance, position, heading, stepIndex, cueCount });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.running, plan, profile, speedFactor, total, announce]);

  useEffect(() => () => void Speech.stop(), []);

  const play = () => setState((s) => (s.finished ? { ...s, running: true, finished: false, distance: 0, position: start, stepIndex: -1, cueCount: 0 } : { ...s, running: true }));
  const pause = () => {
    Speech.stop();
    setState((s) => ({ ...s, running: false }));
  };
  const reset = () => {
    Speech.stop();
    setState({ running: false, finished: false, distance: 0, position: start, heading: 0, stepIndex: -1, cueCount: 0 });
  };
  const repeat = () => {
    const s = ref.current;
    if (plan && s.stepIndex >= 0) announce(plan.steps[s.stepIndex]!, s.stepIndex, s.position, s.heading);
    if (s.stepIndex >= 0) setState((x) => ({ ...x, cueCount: x.cueCount + 1 }));
  };

  return { state, total, play, pause, reset, repeat };
}
