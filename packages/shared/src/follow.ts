import { pointAlong } from "./geo";
import type { LngLat } from "./schemas";
import { dueStep, trackFix, type LocationFix, type TrackState } from "./tracking";

/**
 * Bir konum ölçümünü rotaya uygular: ilerleme, sıradaki talimat ve rotanın uğradığı noktalar.
 * Mobil yürüyüş (GPS ya da sanal) ve admin rota testi aynı adımı kullanır; ses, titreşim ve ekran tepkisi çağıranda kalır.
 */
export interface FollowInput {
  line: LngLat[];
  /** Rotanın toplam uzunluğu (m, çizgi üzerinden). */
  totalM: number;
  /** Talimatların rota başından uzaklığı (m). */
  stepsAtM: number[];
  /** Rotanın uğradığı noktalar ve rota üzerindeki yerleri (m). */
  via: { pointIds: string[]; atM: number[] };
  track: TrackState;
  stepIndex: number;
  /** Bu yürüyüşte açılmış noktalar. */
  fired: ReadonlySet<string>;
  fix: LocationFix;
  /** Yürüme hızı (m/sn): talimat ne kadar önce okunsun. */
  mps: number;
  /** Sanal yürüyüş: rotaya yakın konum çizgiye oturtulur (GPS gürültüsü haritada titremesin). */
  snapToLine: boolean;
  /** Sanal yürüyüşçü çizginin sonunda: GPS benzeri sapma varışı geciktirmesin. */
  atEnd: boolean;
}

export type FollowResult =
  | { offRoute: true; track: TrackState }
  | {
      offRoute: false;
      track: TrackState;
      distance: number;
      position: LngLat;
      stepIndex: number;
      /** Bu ölçümde yeni talimata geçildi. */
      newStep: boolean;
      /** Rota üzerindeki yerine varılan (henüz açılmamış) noktalar. */
      reached: string[];
      /** Son talimat (varış) okundu. */
      arrived: boolean;
    };

/** Sanal yürüyüşte konum bu kadar yakınsa (m) çizgiye oturtulur. */
const SNAP_M = 10;
/** Uğrama noktası, rotadaki yerine bu kadar kala (m) açılır. */
const REACH_LEAD_M = 3;

export function followRoute(i: FollowInput): FollowResult {
  const track = trackFix(i.track, i.line, i.fix);
  if (track.offRoute) return { offRoute: true, track };
  const total = i.totalM;
  const distance = i.atEnd ? total : track.alongM;
  const position = i.snapToLine && track.crossM <= SNAP_M ? pointAlong(i.line, distance) : i.fix.position;
  const stepIndex = dueStep(i.stepsAtM, i.stepIndex, distance, total, i.mps);
  const last = i.stepsAtM.length - 1;
  // Rotanın uğradığı noktaya varıldı: yarıçapın dışında kalsa da (düğüm noktadan biraz uzak olabilir) açılır.
  const reached = i.via.pointIds.filter((id, k) => !i.fired.has(id) && i.via.atM[k]! <= distance + REACH_LEAD_M);
  return {
    offRoute: false,
    track: { ...track, alongM: distance },
    distance,
    position,
    stepIndex,
    newStep: stepIndex > i.stepIndex,
    reached,
    arrived: stepIndex === last && last >= 0,
  };
}
