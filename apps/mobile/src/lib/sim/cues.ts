import type { Turn } from '@sezi/shared';
import * as Haptics from 'expo-haptics';

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
