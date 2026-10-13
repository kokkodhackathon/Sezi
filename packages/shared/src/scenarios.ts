import { bearingDeg, distanceM, pointAlong, relativeBearing } from "./geo";
import type { GuidanceStep } from "./guidance";
import type { Route, RouteGeometry } from "./routing";
import type { LngLat, NavSegment } from "./schemas";

/**
 * Rehberlik senaryoları için saf yardımcılar: yeniden rota, yol kapatma, yanlış dönüş.
 * Simülasyonun "jüri paneli" bunları kullanır; gerçek GPS modunda da yeniden rota aynı yoldan geçer.
 */

/** Çizginin [fromM, toM] aralığındaki parçası. */
export function sliceLine(line: LngLat[], fromM: number, toM: number): LngLat[] {
  const out: LngLat[] = [pointAlong(line, fromM)];
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    acc += distanceM(line[i - 1]!, line[i]!);
    if (acc > fromM && acc < toM) out.push(line[i]!);
    if (acc >= toM) break;
  }
  out.push(pointAlong(line, toM));
  return out;
}

/**
 * Yeni rotanın başına kullanıcının bulunduğu noktadan başlangıç düğümüne giden kısa bağlantıyı ekler.
 * Adım mesafeleri buna göre kayar; takip ve simülasyon aynı çizgiyi kullanır.
 */
export function withLeadIn(geometry: RouteGeometry, steps: GuidanceStep[], from: LngLat): { geometry: RouteGeometry; steps: GuidanceStep[] } {
  const d = distanceM(from, geometry.line[0]!);
  if (d < 1) return { geometry, steps };
  return {
    geometry: { line: [from, ...geometry.line], nodeAtM: geometry.nodeAtM.map((x) => x + d), legs: geometry.legs },
    steps: steps.map((s) => ({ ...s, atM: s.atM + d })),
  };
}

/** Kullanıcının önünde, en az `minAheadM` ileride başlayan ilk rota segmenti (yol kapatma senaryosu). */
export function segmentAhead(route: Route, geometry: RouteGeometry, alongM: number, minAheadM = 15): { segmentId: string; nodeIndex: number } | null {
  for (let k = 0; k < route.segmentIds.length; k++) {
    if (geometry.nodeAtM[k]! >= alongM + minAheadM) return { segmentId: route.segmentIds[k]!, nodeIndex: k };
  }
  return null;
}

function oriented(seg: NavSegment, fromNode: string, ends: Map<string, LngLat>): LngLat[] {
  const g = seg.geometry && seg.geometry.length >= 2 ? seg.geometry : [ends.get(seg.from)!, ends.get(seg.to)!];
  return seg.from === fromNode ? g : [...g].reverse();
}

/**
 * Yanlış dönüş senaryosu: kullanıcı önündeki ilk kavşakta dönmesi gerekirken düz devam eder.
 * Dönüş, mevcut konumdan başlayıp rotadan ayrılan ve en az `minM` uzunluğunda bir çizgi döner.
 * `nodeLocations`: segment geometrisi olmayan uçlar için düğüm konumları.
 */
export function buildDetour(
  route: Route,
  geometry: RouteGeometry,
  segments: NavSegment[],
  nodeLocations: Map<string, LngLat>,
  alongM: number,
  minM = 60,
): { line: LngLat[]; junctionId: string } | null {
  const bySeg = new Map(segments.map((s) => [s.id, s]));
  const incident = new Map<string, NavSegment[]>();
  for (const s of segments) {
    if (s.blocked) continue;
    for (const n of [s.from, s.to]) incident.set(n, [...(incident.get(n) ?? []), s]);
  }
  const onRoute = new Set(route.segmentIds);

  for (let k = 1; k < route.nodeIds.length - 1; k++) {
    if (geometry.nodeAtM[k]! < alongM + 10) continue;
    const junction = route.nodeIds[k]!;
    const options = (incident.get(junction) ?? []).filter((s) => !onRoute.has(s.id));
    if (options.length === 0) continue;

    // Gelinen yön: rotanın kavşaktan önceki son birkaç metresi.
    const at = geometry.nodeAtM[k]!;
    const heading = bearingDeg(pointAlong(geometry.line, Math.max(0, at - 10)), pointAlong(geometry.line, at));
    const straightness = (s: NavSegment, from: string, h: number) => {
      const g = oriented(s, from, nodeLocations);
      return Math.abs(relativeBearing(h, bearingDeg(g[0]!, g[Math.min(g.length - 1, 2)]!)));
    };

    // Kavşaktan en düz devam eden sokağa sap, uzunluk yetene kadar düz gitmeye devam et.
    const line = sliceLine(geometry.line, alongM, at);
    let node = junction;
    let h = heading;
    let length = 0;
    const used = new Set<string>();
    let candidates = options;
    while (candidates.length > 0 && length < minM) {
      const next = [...candidates].sort((a, b) => straightness(a, node, h) - straightness(b, node, h))[0]!;
      const g = oriented(next, node, nodeLocations);
      for (const p of g.slice(1)) line.push(p);
      length += next.lengthM;
      used.add(next.id);
      h = bearingDeg(g[Math.max(0, g.length - 3)]!, g[g.length - 1]!);
      node = next.from === node ? next.to : next.from;
      candidates = (incident.get(node) ?? []).filter((s) => !used.has(s.id) && !onRoute.has(s.id) && bySeg.has(s.id));
    }
    if (length >= minM / 2) return { line, junctionId: junction };
  }
  return null;
}
