import { distanceM } from "./geo";
import type { LngLat, NavNode, NavSegment, UserProfile } from "./schemas";

/**
 * Segmentin bu profil için maliyeti (metre eşdeğeri). `null` = geçilemez.
 * Ağırlıklar Lynch yaklaşımını yansıtır: görsel kullanıcı için landmark görünürlüğü
 * rotayı ucuzlatır, görme engelli için gürültü ses ipuçlarını bastırdığı için pahalılaştırır.
 */
export function segmentCost(s: NavSegment, p: UserProfile): number | null {
  if (s.blocked) return null;

  if (p.mobility === "wheelchair") {
    if (s.steps > 0 || s.kerb || s.slopePct > 8) return null;
    if (s.widthCm !== undefined && s.widthCm < 90) return null;
  }

  let cost = s.lengthM;

  if (p.mobility === "wheelchair") {
    cost *= 1 + s.slopePct / 10;
    if (s.surface === "cobble" || s.surface === "gravel") cost *= 1.8;
  } else if (p.mobility === "cane") {
    cost += s.steps * 15;
    cost *= 1 + s.slopePct / 20;
    if (s.surface === "cobble") cost *= 1.4;
  } else {
    cost += s.steps * 2;
  }

  if (p.vision === "blind") {
    cost *= 1 + s.noise;
    if (s.kerb) cost *= 1.3;
  } else if (p.vision === "low") {
    cost *= 1 + s.noise * 0.5;
  }

  if (p.vision !== "blind" && p.senses.visual) {
    cost *= 1 - 0.3 * s.landmarkVisibility;
  }

  return cost;
}

export interface Route {
  nodeIds: string[];
  segmentIds: string[];
  lengthM: number;
  cost: number;
}

interface Edge {
  to: string;
  segment: NavSegment;
}

function buildAdjacency(segments: NavSegment[]): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  const add = (from: string, to: string, segment: NavSegment) => {
    let list = adj.get(from);
    if (!list) adj.set(from, (list = []));
    list.push({ to, segment });
  };
  for (const s of segments) {
    add(s.from, s.to, s);
    add(s.to, s.from, s);
  }
  return adj;
}

/** Küçük ikili min-heap; pilot grafikler yüzlerce node'luk, bu yeterli. */
class MinHeap<T> {
  private items: { key: number; value: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(key: number, value: T) {
    const a = this.items;
    a.push({ key, value });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent]!.key <= a[i]!.key) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      i = parent;
    }
  }
  pop(): { key: number; value: T } | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.key < a[m]!.key) m = l;
        if (r < a.length && a[r]!.key < a[m]!.key) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/** Profil ağırlıklı Dijkstra. Yol yoksa `null`. */
export function findRoute(
  segments: NavSegment[],
  profile: UserProfile,
  fromId: string,
  toId: string,
): Route | null {
  const adj = buildAdjacency(segments);
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, { node: string; segment: NavSegment }>();
  const heap = new MinHeap<string>();
  heap.push(0, fromId);

  while (heap.size > 0) {
    const { key, value: node } = heap.pop()!;
    if (node === toId) break;
    if (key > (dist.get(node) ?? Infinity)) continue;
    for (const { to, segment } of adj.get(node) ?? []) {
      const c = segmentCost(segment, profile);
      if (c === null) continue;
      const nd = key + c;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node, segment });
        heap.push(nd, to);
      }
    }
  }

  if (!dist.has(toId)) return null;

  const nodeIds = [toId];
  const segmentIds: string[] = [];
  let lengthM = 0;
  let cur = toId;
  while (cur !== fromId) {
    const p = prev.get(cur)!;
    segmentIds.unshift(p.segment.id);
    lengthM += p.segment.lengthM;
    nodeIds.unshift(p.node);
    cur = p.node;
  }
  return { nodeIds, segmentIds, lengthM, cost: dist.get(toId)! };
}

export interface RouteGeometry {
  /** Rota boyunca tek parça çizgi (harita ve simülasyon). */
  line: LngLat[];
  /** route.nodeIds[i] düğümünün rota başından uzaklığı (metre, çizgi üzerinden). */
  nodeAtM: number[];
  /** route.segmentIds[i] segmentinin yürüme yönündeki geometrisi. */
  legs: LngLat[][];
}

/** Rotanın yönlendirilmiş geometrisi; segment geometrisi yoksa düğümler arası düz çizgi. */
export function routeGeometry(route: Route, nodes: Map<string, NavNode>, segments: Map<string, NavSegment>): RouteGeometry {
  const loc = (id: string) => {
    const n = nodes.get(id);
    if (!n) throw new Error(`node bulunamadı: ${id}`);
    return n.location;
  };
  const legs = route.segmentIds.map((sid, i) => {
    const seg = segments.get(sid);
    const from = route.nodeIds[i]!;
    const to = route.nodeIds[i + 1]!;
    if (!seg?.geometry || seg.geometry.length < 2) return [loc(from), loc(to)];
    return seg.from === from ? seg.geometry : [...seg.geometry].reverse();
  });

  const line: LngLat[] = [loc(route.nodeIds[0]!)];
  const nodeAtM = [0];
  let total = 0;
  for (const leg of legs) {
    for (let k = 1; k < leg.length; k++) {
      total += distanceM(leg[k - 1]!, leg[k]!);
      line.push(leg[k]!);
    }
    nodeAtM.push(total);
  }
  return { line, nodeAtM, legs };
}

/** Geriye dönük: yalnızca düğüm koordinatlarından polyline. */
export function routePolyline(route: Route, nodes: Map<string, NavNode>) {
  return routeGeometry(route, nodes, new Map()).line;
}
