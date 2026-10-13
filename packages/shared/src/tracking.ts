import { distanceM } from "./geo";
import type { LngLat } from "./schemas";

/**
 * Rota takibi: konum ölçümünü (gerçek GPS ya da simülasyon) rota çizgisine eşler,
 * ilerlemeyi, rotadan sapmayı ve talimatın zamanını belirler.
 * Simülasyon ve gerçek GPS modu aynı fonksiyonları kullanır; yalnızca konum kaynağı değişir.
 */

/** Konum ölçümü. `heading` pusula yönü (derece); bilinmiyorsa undefined. */
export interface LocationFix {
  position: LngLat;
  heading?: number;
  /** Tahmini konum hatası (metre). */
  accuracyM: number;
  /** Zaman damgası (ms). */
  t: number;
}

export interface LineProjection {
  /** Çizgi başından, izdüşüm noktasına kadar mesafe (m). */
  alongM: number;
  /** Noktanın çizgiye dik uzaklığı (m). */
  crossM: number;
  point: LngLat;
}

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/**
 * Noktanın çizgi üzerindeki izdüşümü. `window` verilirse yalnızca bu aralıktaki parçalara bakılır:
 * rota kendine yaklaştığında (U dönüşü, paralel sokak) ileriye ya da geriye sıçramayı önler.
 */
export function projectOnLine(line: LngLat[], p: LngLat, window?: { fromM: number; toM: number }): LineProjection {
  const kx = mPerDegLng(p[1]);
  let best: LineProjection = { alongM: 0, crossM: Infinity, point: line[0]! };
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const segLen = distanceM(a, b);
    const segStart = acc;
    acc += segLen;
    if (window && (acc < window.fromM || segStart > window.toM)) continue;
    // Yerel düzlem (metre) üzerinde izdüşüm: 1 km'lik pilot alan için hata ihmal edilebilir.
    const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * M_PER_DEG_LAT;
    const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * M_PER_DEG_LAT;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    // Pencere, uzun bir parçanın yalnızca bir kısmını kapsayabilir: izdüşüm o kısma sıkıştırılır.
    const tMin = window && segLen > 0 ? Math.max(0, (window.fromM - segStart) / segLen) : 0;
    const tMax = window && segLen > 0 ? Math.min(1, (window.toM - segStart) / segLen) : 1;
    t = Math.max(tMin, Math.min(tMax, t));
    const cx = ax + dx * t, cy = ay + dy * t;
    const cross = Math.hypot(cx, cy);
    if (cross < best.crossM) {
      best = {
        alongM: segStart + segLen * t,
        crossM: cross,
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      };
    }
  }
  return best;
}

export interface TrackState {
  /** Rota üzerindeki ilerleme (m); geri gitmez (küçük GPS sıçramaları ilerlemeyi bozmaz). */
  alongM: number;
  /** Son ölçümün rotaya dik uzaklığı (m). */
  crossM: number;
  /** Üst üste rotadan uzak ölçüm sayısı. */
  awayCount: number;
  offRoute: boolean;
}

export const initialTrack: TrackState = { alongM: 0, crossM: 0, awayCount: 0, offRoute: false };

/** Rotadan sapma eşiği: konum hatası büyükse eşik de büyür. */
export const offRouteThreshold = (accuracyM: number) => Math.max(20, accuracyM * 1.5);
/** Sapma kararı için gereken ardışık ölçüm (tek bir GPS sıçraması yanlış alarm vermesin). */
export const OFF_ROUTE_FIXES = 3;

export function trackFix(prev: TrackState, line: LngLat[], fix: LocationFix): TrackState {
  // Arama penceresi: son ilerlemenin biraz gerisinden epey ilerisine.
  const proj = projectOnLine(line, fix.position, { fromM: prev.alongM - 25, toM: prev.alongM + 80 });
  const away = proj.crossM > offRouteThreshold(fix.accuracyM);
  const awayCount = away ? prev.awayCount + 1 : 0;
  return {
    alongM: away ? prev.alongM : Math.max(prev.alongM, proj.alongM),
    crossM: proj.crossM,
    awayCount,
    offRoute: awayCount >= OFF_ROUTE_FIXES,
  };
}

/** Talimat, dönüşe bu kadar saniye kala verilir (konuşma süresi + hazırlanma). */
export const ANNOUNCE_LEAD_S = 4;

/**
 * Talimatın verileceği "önden" mesafe: yürüme hızına göre (sabit metre değil),
 * çok yakın ya da çok uzak duyuruyu sınırlar.
 */
export function announceLeadM(speedMps: number): number {
  return Math.min(40, Math.max(6, speedMps * ANNOUNCE_LEAD_S));
}

/**
 * Sıradaki talimat indeksi. Birden çok adım aynı anda geçildiyse (hızlı simülasyon, GPS boşluğu)
 * yalnızca en güncel olan döner; ara talimatlar artık geçersizdir ve okunmaz.
 * Son adım (varış) ancak gerçekten varınca döner.
 */
export function dueStep(stepsAtM: number[], announced: number, alongM: number, totalM: number, speedMps: number): number {
  const lead = announceLeadM(speedMps);
  let idx = announced;
  for (let i = announced + 1; i < stepsAtM.length; i++) {
    const isLast = i === stepsAtM.length - 1;
    const reached = isLast ? alongM >= totalM - 3 : stepsAtM[i]! - lead <= alongM;
    if (!reached) break;
    idx = i;
  }
  return idx;
}
