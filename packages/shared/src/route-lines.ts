import { distanceM } from "./geo";
import type { Route, RouteGeometry } from "./routing";
import type { LngLat } from "./schemas";

/**
 * Haritadaki rota çizgisinin parçaları (mobil ve web aynı kuralı kullanır):
 * - Her parça bir bacağa aittir (başlangıç -> 1. durak bacak 0, 1 -> 2 bacak 1 …); seçili bacak vurgulanır.
 * - `progress` rotadaki ilerlemedir (0 başlangıç, 1 varış); çizgi rengi başlangıç renginden varış rengine geçer.
 * - Aynı yol rotada birden çok kez yürünüyorsa (git-dön) parçalar yürüme yönünün sağına kaydırılır:
 *   gidiş ve dönüş üst üste binmez, iki ince paralel şerit olur.
 * Yön okları çizgi boyunca parçalarla aynı kaydırmayla çizilir.
 */
export interface RoutePiece {
  route: Route;
  geometry: RouteGeometry;
  /** Bacak sınırları (parçanın başından metre; ör. uğrama noktalarının `via.atM`'i): her sınırda bacak numarası artar. */
  breaksM?: readonly number[];
}

export interface LinePart {
  coords: LngLat[];
  /** 0'dan başlayan bacak numarası. */
  leg: number;
  /** Parçanın ortasının rotadaki yeri (0-1). */
  progress: number;
  /**
   * Şerit: 0 yolu bir kez yürünen parça (kaydırılmaz); 1 rotada birden çok kez yürünen yolun ilk aynı yönlü
   * geçişi, 2 ikinci aynı yönlü geçişi… (her şerit yürüme yönünün sağına bir adım daha kayar).
   */
  lane: number;
}

/** Şeridin çizgi genişliğine göre yana kayması (px, yürüme yönünün sağı pozitif). */
export const laneOffsetPx = (lane: number, widthPx: number): number => (lane === 0 ? 0 : widthPx * (0.6 + (lane - 1) * 1.2));

/** Yön okları arasındaki uzaklık (px). */
export const ROUTE_ARROW_SPACING_PX = 70;

/** Akan çizgi animasyonunun kesik dizileri (Mapbox "ant path" örneği): her adımda bir sonrakine geçilir. */
export const ROUTE_FLOW_DASHES: readonly (readonly number[])[] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];
/** Animasyon adımı (ms). */
export const ROUTE_FLOW_STEP_MS = 60;

export interface RouteLines {
  /** Segment segment parçalar: renk geçişi bunlarla (her parça kendi `progress`'iyle boyanır). */
  parts: LinePart[];
  /** Aynı bacak ve şeritteki ardışık parçalar birleşik: yön okları ve akan çizgi bunlar üstünde (kısa parçaya ok sığmaz). */
  runs: LinePart[];
}

export function routeLineParts(pieces: readonly RoutePiece[]): RouteLines {
  // 1. Bütün segment geçişleri sırayla: yön ve bacak.
  interface Pass {
    coords: LngLat[];
    leg: number;
    key: string;
    dir: string;
    lengthM: number;
  }
  const passes: Pass[] = [];
  let legBase = 0;
  for (const { route, geometry, breaksM = [] } of pieces) {
    const lead = geometry.legs[0]?.[0];
    // Rota tam konumdan başlıyorsa (leadIn) ilk düğüme kadar olan bağlantı da çizilir.
    if (lead && geometry.line[0] && distanceM(geometry.line[0], lead) >= 1) {
      passes.push({ coords: [geometry.line[0], lead], leg: legBase, key: "", dir: "", lengthM: distanceM(geometry.line[0], lead) });
    }
    route.segmentIds.forEach((id, k) => {
      const coords = geometry.legs[k];
      if (!coords || coords.length < 2) return;
      const at = geometry.nodeAtM[k] ?? 0;
      const leg = legBase + breaksM.filter((b) => b <= at + 0.01).length;
      passes.push({ coords, leg, key: id, dir: route.nodeIds[k]!, lengthM: (geometry.nodeAtM[k + 1] ?? at) - at });
    });
    legBase += breaksM.length + 1;
  }

  // 2. Birden çok kez yürünen segmentler ve aynı yöndeki kaçıncı geçiş olduğu.
  const uses = new Map<string, number>();
  for (const p of passes) if (p.key) uses.set(p.key, (uses.get(p.key) ?? 0) + 1);
  const seenDir = new Map<string, number>();
  const total = passes.reduce((s, p) => s + p.lengthM, 0) || 1;
  let acc = 0;
  const parts: LinePart[] = [];
  for (const p of passes) {
    let lane = 0;
    if (p.key && (uses.get(p.key) ?? 0) > 1) {
      const dk = `${p.key}>${p.dir}`;
      lane = (seenDir.get(dk) ?? 0) + 1;
      seenDir.set(dk, lane);
    }
    const progress = (acc + p.lengthM / 2) / total;
    acc += p.lengthM;
    parts.push({ coords: p.coords, leg: p.leg, progress, lane });
  }
  const runs: LinePart[] = [];
  for (const p of parts) {
    const prev = runs.at(-1);
    if (prev && prev.leg === p.leg && prev.lane === p.lane) prev.coords.push(...p.coords.slice(1));
    else runs.push({ ...p, coords: [...p.coords] });
  }
  return { parts, runs };
}

/**
 * Numaralı durak çizginin üstünde gösterilir; noktanın kendi yeri çizgiden uzaksa ikisi arasına ince kesikli
 * bağlantı çizilir (rozet çizginin bittiği yerde, bağlantı binaya). Yakınsa (≤ `minM`) bağlantı yok.
 */
export function stopConnector(onLine: LngLat, place: LngLat, minM = 8): LngLat[] | null {
  return distanceM(onLine, place) > minM ? [onLine, place] : null;
}
