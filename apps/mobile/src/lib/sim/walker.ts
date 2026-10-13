import { bearingDeg, pointAlong, polylineLength, type LngLat, type LocationFix } from '@sezi/shared';

/**
 * Sanal yürüyüşçü: bir çizgi boyunca yürür ve gerçek GPS'e benzeyen konum ölçümleri üretir
 * (birkaç metrelik sapma, pusula titremesi). Rehberlik bu ölçümleri gerçek GPS ile aynı yoldan işler.
 * Çizgi değiştirilebilir: yanlış dönüş senaryosunda yürüyüşçü rotadan ayrılan bir sokağa sapar.
 */
export interface Walker {
  line: LngLat[];
  lengthM: number;
  /** Çizgi üzerinde yürünen mesafe (m). */
  distance: number;
  /** Deterministik gürültü üreteci durumu: her demo aynı biçimde oynar. */
  seed: number;
}

/** GPS benzeri sapmanın standart sapması (m) ve bildirilen doğruluk. */
const JITTER_M = 2.5;
const ACCURACY_M = 5;

export function createWalker(line: LngLat[]): Walker {
  return { line, lengthM: polylineLength(line), distance: 0, seed: 7 };
}

export function walkerOnLine(w: Walker, line: LngLat[]): Walker {
  return { ...w, line, lengthM: polylineLength(line), distance: 0 };
}

function random(seed: number): [number, number] {
  // mulberry32
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, t];
}

function gaussian(seed: number): [number, number] {
  const [u1, s1] = random(seed);
  const [u2, s2] = random(s1);
  return [Math.sqrt(-2 * Math.log(Math.max(u1, 1e-9))) * Math.cos(2 * Math.PI * u2), s2];
}

/** Yürüyüşçüyü `meters` kadar ilerletir ve o anki konum ölçümünü döner. */
export function stepWalker(w: Walker, meters: number, t: number): { walker: Walker; fix: LocationFix; truth: LngLat; done: boolean } {
  const distance = Math.min(w.lengthM, w.distance + meters);
  const truth = pointAlong(w.line, distance);
  const ahead = pointAlong(w.line, Math.min(w.lengthM, distance + 3));
  let seed = w.seed;
  let gx: number, gy: number, gh: number;
  [gx, seed] = gaussian(seed);
  [gy, seed] = gaussian(seed);
  [gh, seed] = gaussian(seed);
  const kx = 111_320 * Math.cos((truth[1] * Math.PI) / 180);
  const position: LngLat = [truth[0] + (gx * JITTER_M) / kx, truth[1] + (gy * JITTER_M) / 110_540];
  const heading = distance < w.lengthM ? (bearingDeg(truth, ahead) + gh * 6 + 360) % 360 : undefined;
  return {
    walker: { ...w, distance, seed },
    fix: { position, heading, accuracyM: ACCURACY_M, t },
    truth,
    done: distance >= w.lengthM,
  };
}
