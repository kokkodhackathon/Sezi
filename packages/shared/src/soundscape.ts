import { bearingDeg, distanceM, relativeBearing, stereoPan } from "./geo";
import type { LngLat } from "./schemas";

/**
 * Ses manzarası: yakındaki her yer işareti sürekli bir ortam sesi çalar; ses yönüne göre panlanır,
 * uzaklıkla kısılır. "Sebilin su sesini duyunca sağa yönelin" talimatının duyulur karşılığı.
 * Saha kayıtları gelene kadar sesler sentezlenir; dini ses (ezan vb.) kullanılmaz, yalnızca ortam sesi.
 */
export type SoundKind = "water" | "market" | "chime";

/** Eser türü → ortam sesi. */
export function soundKindFor(workType: string | undefined): SoundKind {
  switch (workType) {
    case "cesme":
    case "sebil":
    case "hamam":
    case "sarnic":
      return "water";
    case "han":
    case "carsi":
    case "kervansaray":
      return "market";
    default:
      return "chime";
  }
}

export interface SoundSource {
  id: string;
  name: string;
  kind: SoundKind;
  location: LngLat;
}

export interface SoundVoice extends SoundSource {
  /** 0–1 ses düzeyi (uzaklığa göre). */
  gain: number;
  /** -1 sol … +1 sağ. */
  pan: number;
  distanceM: number;
  /** Kullanıcının yönüne göre açı (-180..180, + sağ). */
  relDeg: number;
}

/** Bu mesafenin ötesindeki yer işaretleri duyulmaz. */
export const SOUND_RANGE_M = 60;
/** Bu mesafeden yakında ses tam düzeyde. */
const FULL_GAIN_M = 8;

/** Uzaklığa göre ses düzeyi: yakında tam, menzil sonunda sıfır (kulağa doğal gelen karesel düşüş). */
export function gainForDistance(d: number): number {
  if (d <= FULL_GAIN_M) return 1;
  if (d >= SOUND_RANGE_M) return 0;
  const x = 1 - (d - FULL_GAIN_M) / (SOUND_RANGE_M - FULL_GAIN_M);
  return x * x;
}

/** Dinleyicinin konumu ve yönüne göre duyulan sesler, en yüksekten en alçağa. En fazla `max` ses. */
export function soundscapeMix(listener: LngLat, heading: number, sources: SoundSource[], max = 3): SoundVoice[] {
  const voices: SoundVoice[] = [];
  for (const s of sources) {
    const d = distanceM(listener, s.location);
    if (d >= SOUND_RANGE_M) continue;
    const b = bearingDeg(listener, s.location);
    voices.push({ ...s, gain: gainForDistance(d), pan: stereoPan(heading, b), distanceM: d, relDeg: relativeBearing(heading, b) });
  }
  return voices.sort((a, b) => b.gain - a.gain).slice(0, max);
}
