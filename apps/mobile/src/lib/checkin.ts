import { checkIn, type CheckInResult } from '@sezi/shared';
import * as Location from 'expo-location';

type CheckInWork = Parameters<typeof checkIn>[0];
export async function checkInHere(
  work: CheckInWork,
): Promise<CheckInResult | { ok: false; reason: 'permission'; distanceM: null }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return { ok: false, reason: 'permission', distanceM: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 15_000);
      }),
    ]);
    if (!fix) return { ok: false, reason: 'weak_fix', distanceM: null };
    return checkIn(work, {
      position: [fix.coords.longitude, fix.coords.latitude],
      accuracyM: fix.coords.accuracy ?? Infinity,
    });
  } catch {
    return { ok: false, reason: 'weak_fix', distanceM: null };
  } finally {
    clearTimeout(timer);
  }
}
