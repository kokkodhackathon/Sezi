import type { Turn } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { AudioContext } from 'react-native-audio-api';

/** Dönüş titreşimi: sol tek, sağ çift, geri dönüş uyarı, varış başarı deseni. */
export async function hapticForTurn(turn: Turn, arrived: boolean) {
  if (arrived) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const pulse = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (turn === 'left' || turn === 'slight_left') return pulse();
  if (turn === 'right' || turn === 'slight_right') {
    await pulse();
    await new Promise((r) => setTimeout(r, 160));
    return pulse();
  }
  if (turn === 'back') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Dikkat titreşimi: rota değişti, yol kapalı, rotadan çıkıldı. */
export function hapticAlert() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Landmark ses ipucu: kulaklıkta landmark'ın yönüne panlanmış kısa iki nota.
 * Saha ses kayıtları gelene kadar geçici sentez tonu kullanılır.
 */
export function playLandmarkCue(pan: number) {
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
    // Ses motoru açılamazsa rehberlik konuşma ve titreşimle sürer.
  }
}
