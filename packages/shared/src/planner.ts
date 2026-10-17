import { distanceM } from "./geo";
import { buildGuidance, type GuidanceStep } from "./guidance";
import { arrivalFor, opensOnApproach, startPointsOf, type Ambient, type NavPoint } from "./points";
import { findRoute, routeGeometry, type Route, type RouteGeometry } from "./routing";
import { buildDetour, segmentAhead, withLeadIn } from "./scenarios";
import { NavSegment, type LngLat, type LocalizedText, type NavNode, type UserProfile } from "./schemas";
import { joinRoutes, routeVia } from "./via";

/**
 * Rota planlayıcı: gömülü pilot grafiği + admin noktaları + onaylı bildirimler.
 * Mobil uygulama (yürüyüş) ve admin paneli (rota testi) aynı planlayıcıyı kullanır; ikisi aynı rotayı çizer.
 */

export type PilotNode = NavNode & {
  workSlug?: string;
  workType?: string;
  /** Bu düğüme bağlanan yer işareti noktası (nav_points). */
  pointId?: string;
  /** Ortam sesi (ses manzarası): su, çarşı uğultusu… */
  sound?: Ambient;
};

/** `data/build_nav_graph.py` çıktısı (assets/pilot/<alan>-nav.json). */
export interface PilotGraphData {
  area: string;
  name: LocalizedText;
  center: number[];
  nodes: unknown[];
  segments: unknown[];
}

/** Başlangıç seçeneği: insanların buluştuğu ya da toplu taşımadan indiği yer ("Neredesiniz?"). */
export interface StartPoint {
  id: string;
  nodeId: string;
  name: LocalizedText;
  location: LngLat;
}

export type OverrideType = "stairs" | "ramp_blocked" | "narrow_path" | "surface_damage" | "construction" | "other";

export interface PlannedRoute {
  /** work: esere rota; stroll: hedefsiz gezinti (yakındaki anlatım noktalarını sırayla dolaşır). */
  kind: "work" | "stroll";
  route: Route;
  geometry: RouteGeometry;
  steps: GuidanceStep[];
  start: PilotNode;
  end: PilotNode;
  /** Rotadaki basamaklı segment sayısı (profil açıklaması için). */
  stairSegments: number;
  /** Rota boyunca geçilen yer işaretleri (başlangıç ve varış hariç). */
  passedLandmarks: PilotNode[];
  /** Rotanın uğradığı anlatım/varış noktaları (rotadaki sırayla), uğramanın getirdiği uzama (m) ve her noktanın bağlandığı düğümün rota başından uzaklığı (`atM`, m). */
  via: { pointIds: string[]; extraM: number; atM: number[] };
  /** Hedef eserin varış bilgisi (admin panelinde girildiyse). */
  arrival?: NavPoint;
}

export interface PlanOptions {
  /** Kapalı segmentler (onaylı bildirim ya da simülasyondaki yol kapatma). */
  blocked?: ReadonlySet<string>;
  /** Rotayı tam bu noktadan başlat: noktadan en yakın düğüme bağlantı eklenir (yeniden rota, haritada seçilen yer). */
  leadIn?: boolean;
  /** Yakındaki anlatım noktalarına uğra (varsayılan açık). */
  via?: boolean;
  /** Uğranmayacak noktalar (bu yürüyüşte zaten açılmış olanlar). */
  skip?: ReadonlySet<string>;
}

/** Yer işareti noktası en yakın düğüme en çok bu uzaklıktan bağlanır (m). */
const LANDMARK_SNAP_M = 60;
/** Anlatım/varış noktası rotaya uğramak için en yakın düğüme en çok bu uzaklıktan bağlanır (m). */
const VIA_SNAP_M = 40;
/** Yer işaretine bu kadar yakın segmentlerden yer işareti görünür sayılır (m). */
const VISIBLE_M = 40;
/** Konum en yakın düğüme bundan yakınsa pilot alanın içinde sayılır (m). */
export const PILOT_REACH_M = 150;
/** Gezintide en fazla uğranacak nokta, bir bacağın ve toplamın üst sınırı (m). */
const STROLL_MAX_STOPS = 5;
const STROLL_MAX_LEG_M = 500;
const STROLL_MAX_M = 1200;

function nearestIn(map: Map<string, PilotNode>, p: LngLat): PilotNode {
  let best: PilotNode | undefined;
  let bestD = Infinity;
  for (const n of map.values()) {
    const d = distanceM(p, n.location);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best!;
}

function applyOverride(s: NavSegment, types: Set<OverrideType>): NavSegment {
  let next = s;
  if (types.has("stairs")) next = { ...next, steps: Math.max(next.steps, 1) };
  if (types.has("ramp_blocked") || types.has("construction")) next = { ...next, blocked: true };
  if (types.has("narrow_path")) next = { ...next, widthCm: Math.min(next.widthCm ?? 80, 60) };
  if (types.has("surface_damage")) next = { ...next, surface: "gravel" };
  return next;
}

export type Planner = ReturnType<typeof createPlanner>;

/**
 * Taban grafikten çalışan planlayıcı kurar. Noktalar (`setNavPoints`) ya da onaylı bildirimler (`setOverrides`)
 * değişince grafik yeniden kurulur ve `version` artar; rota çizen ekranlar `subscribe` ile yeniden hesaplar.
 */
export function createPlanner(raw: PilotGraphData) {
  const baseNodes = new Map<string, PilotNode>((raw.nodes as PilotNode[]).map((n) => [n.id, n]));
  const baseSegments = raw.segments.map((s) => NavSegment.parse(s));
  const baseSegMap = new Map(baseSegments.map((s) => [s.id, s]));
  const center = raw.center as LngLat;
  const nodeLocations = new Map([...baseNodes.values()].map((n) => [n.id, n.location]));
  /** Eserler (varış düğümleri): hedef seçenekleri ve turlar. Grafikle birlikte üretilir. */
  const pilotWorks = [...baseNodes.values()].filter((n) => n.workSlug);

  let navPoints: NavPoint[] = [];
  let overrideTypes = new Map<string, Set<OverrideType>>();
  let nodes = baseNodes;
  let effective: NavSegment[] = baseSegments;
  let effMap = baseSegMap;
  let starts: StartPoint[] = [];
  /** Anlatım/varış noktası → bağlandığı düğüm (rotaya uğramak için). */
  let viaNode = new Map<string, string>();
  let version = 0;
  const listeners = new Set<() => void>();

  const midOf = (s: NavSegment): LngLat => (s.geometry && s.geometry.length ? s.geometry[Math.floor(s.geometry.length / 2)]! : baseNodes.get(s.from)!.location);

  function rebuild() {
    // 1. Yer işareti noktaları en yakın düğüme bağlanır: talimatta anılır, ses manzarasına katılır.
    const next = new Map(baseNodes);
    /** Görünürlük kaynakları: konum ve ağırlık (eser 0.5; yer işareti belirginliğe göre 0.25–0.75). */
    const visible: { at: LngLat; weight: number }[] = pilotWorks.map((n) => ({ at: n.location, weight: 0.5 }));
    for (const p of navPoints) {
      if (!p.roles.includes("landmark")) continue;
      const n = nearestIn(baseNodes, p.location);
      if (distanceM(n.location, p.location) > LANDMARK_SNAP_M) continue;
      const cur = next.get(n.id)!;
      // Eser düğümü eser adını korur; yer işareti yalnızca ortam sesini ekler.
      next.set(n.id, { ...cur, lynchType: "landmark", name: cur.workSlug ? cur.name : p.title, pointId: p.id, sound: p.ambient ?? cur.sound });
      visible.push({ at: p.location, weight: 0.25 * (p.salience ?? 2) });
    }
    nodes = next;

    // 2. Segment görünürlüğü ve onaylı bildirimler.
    effective = baseSegments.map((s) => {
      const mid = midOf(s);
      let vis = 0;
      for (const v of visible) if (v.weight > vis && distanceM(mid, v.at) < VISIBLE_M) vis = v.weight;
      const types = overrideTypes.get(s.id);
      const seg = vis > 0 ? { ...s, landmarkVisibility: vis } : s;
      return types ? applyOverride(seg, types) : seg;
    });
    effMap = new Map(effective.map((s) => [s.id, s]));

    // 3. Başlangıçlar ve rotaya uğranacak noktalar.
    starts = startPointsOf(navPoints).map((p) => ({ id: p.id, nodeId: nearestIn(baseNodes, p.location).id, name: p.title, location: p.location }));
    viaNode = new Map();
    for (const p of navPoints) {
      if (!opensOnApproach(p)) continue;
      const n = nearestIn(baseNodes, p.location);
      if (distanceM(n.location, p.location) <= VIA_SNAP_M) viaNode.set(p.id, n.id);
    }

    version++;
    listeners.forEach((l) => l());
  }

  /** Kapalı segmentler işaretlenmiş graf (onaylı bildirimler zaten uygulanmış). */
  function segmentsWith(blocked?: ReadonlySet<string>): NavSegment[] {
    if (!blocked || blocked.size === 0) return effective;
    return effective.map((s) => (blocked.has(s.id) ? { ...s, blocked: true } : s));
  }

  const defaultStart = (): LngLat => starts[0]?.location ?? center;
  const nearestNode = (p: LngLat): PilotNode => nearestIn(nodes, p);

  function landmarkNodeForWork(slug: string): PilotNode | undefined {
    for (const n of nodes.values()) if (n.workSlug === slug) return n;
    return undefined;
  }

  /** Uğranabilecek noktalar, bağlandıkları düğüme göre (aynı düğümdeki noktalar tek uğrama). */
  function viaCandidates(skip: ReadonlySet<string> | undefined, excludeNodes: string[], excludePoint: string | undefined) {
    const out = new Map<string, string[]>();
    for (const [pointId, nodeId] of viaNode) {
      if (skip?.has(pointId) || pointId === excludePoint || excludeNodes.includes(nodeId)) continue;
      out.set(nodeId, [...(out.get(nodeId) ?? []), pointId]);
    }
    return out;
  }

  function finish(
    kind: PlannedRoute["kind"],
    route: Route,
    routeNodes: Map<string, PilotNode>,
    profile: UserProfile,
    from: LngLat,
    leadIn: boolean | undefined,
    via: Omit<PlannedRoute["via"], "atM">,
    arrival: NavPoint | undefined,
  ): PlannedRoute {
    let geometry = routeGeometry(route, routeNodes, baseSegMap);
    let steps = buildGuidance(route, routeNodes, [], profile, geometry, effMap);
    if (leadIn) ({ geometry, steps } = withLeadIn(geometry, steps, from));
    return {
      kind,
      route,
      geometry,
      steps,
      start: routeNodes.get(route.nodeIds[0]!)!,
      end: routeNodes.get(route.nodeIds.at(-1)!)!,
      stairSegments: route.segmentIds.filter((id) => (effMap.get(id)?.steps ?? 0) > 0).length,
      passedLandmarks: [...new Set(route.nodeIds.slice(1, -1))].map((id) => routeNodes.get(id)!).filter((n) => n.lynchType === "landmark"),
      // Uğrama noktasının rota üzerindeki yeri: yürüyüş oraya varınca nokta açılır (yarıçapın dışında kalsa da).
      via: { ...via, atM: via.pointIds.map((id) => geometry.nodeAtM[Math.max(0, route.nodeIds.indexOf(viaNode.get(id)!))]!) },
      arrival,
    };
  }

  return {
    /** Pilot alanın kimliği (bildirimler ve onaylı etkiler bununla eşleşir). */
    area: raw.area,
    areaName: raw.name,
    center,
    pilotWorks,

    /** Sunucudan gelen (ya da önbellekteki) noktaları grafiğe uygular. */
    setNavPoints(list: NavPoint[]) {
      navPoints = list;
      rebuild();
    },
    /** Sunucudan gelen onaylı bildirim etkilerini grafiğe uygular. */
    setOverrides(list: { segment_key: string; type: OverrideType }[]) {
      const by = new Map<string, Set<OverrideType>>();
      for (const o of list) by.set(o.segment_key, (by.get(o.segment_key) ?? new Set()).add(o.type));
      overrideTypes = by;
      rebuild();
    },
    /** Grafik sürümü: nokta ya da bildirim değişince artar. */
    version: () => version,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },

    /** Admin panelinde girilmiş başlangıç noktaları (sıralı; ilki varsayılan). */
    startPoints: () => starts,
    /** Varsayılan başlangıç: listedeki ilk başlangıç noktası; hiç yoksa pilot alanın merkezi. */
    defaultStart,
    /** Kimliği verilen başlangıcın konumu (bilinmeyen kimlikte varsayılan). */
    startLocation: (id: string | undefined): LngLat => starts.find((p) => p.id === id)?.location ?? defaultStart(),

    nearestNode,
    landmarkNodeForWork,
    hasRouteTo: (slug: string) => landmarkNodeForWork(slug) !== undefined,
    /** Konum pilot grafiğin kapsadığı alanda mı (rota yalnızca burada çizilir). */
    inPilotArea: (p: LngLat) => distanceM(p, nearestNode(p).location) <= PILOT_REACH_M,
    /** Talimatta anılan ve ses veren yer işaretleri: eserler ve admin yer işaretleri. */
    landmarkNodes: () => [...nodes.values()].filter((n) => n.lynchType === "landmark"),

    /**
     * Başlangıçtan esere rota. Yakındaki anlatım ve varış noktalarına sınırlı bir uzamayla uğrar
     * (rota en çok %25 ve 300 m uzar; bkz. via.ts). Yol yoksa null.
     */
    planRoute(destSlug: string, profile: UserProfile, from: LngLat = defaultStart(), opts: PlanOptions = {}): PlannedRoute | null {
      const end = landmarkNodeForWork(destSlug);
      if (!end) return null;
      const start = nearestNode(from);
      const segs = segmentsWith(opts.blocked);
      const arrival = arrivalFor(navPoints, destSlug);
      // Uğranabilecek noktalar düğümlerine göre gruplanır (aynı düğüme bağlı iki nokta tek uğrama).
      const nodeToPoints = opts.via === false ? new Map<string, string[]>() : viaCandidates(opts.skip, [start.id, end.id], arrival?.id);
      const v = nodeToPoints.size > 0 ? routeVia(segs, profile, start.id, end.id, [...nodeToPoints.keys()], nodeLocations) : null;
      const route = v ? v.route : findRoute(segs, profile, start.id, end.id);
      if (!route) return null;
      const via = { pointIds: v ? v.via.flatMap((id) => nodeToPoints.get(id)!) : [], extraM: v ? Math.round(v.route.lengthM - v.baseLengthM) : 0 };
      return finish("work", route, nodes, profile, from, opts.leadIn, via, arrival);
    },

    /**
     * Hedefsiz gezinti: bulunulan yerden en yakın (henüz açılmamış) anlatım noktasına, oradan bir sonrakine…
     * En fazla 5 nokta ve toplam 1,2 km. Yakında nokta yoksa null.
     */
    planStroll(profile: UserProfile, from: LngLat, opts: Omit<PlanOptions, "via"> = {}): PlannedRoute | null {
      const start = nearestNode(from);
      const segs = segmentsWith(opts.blocked);
      const remaining = viaCandidates(opts.skip, [], undefined);
      const legs: Route[] = [];
      const visited: string[] = [];
      let cur = start.id;
      let total = 0;
      remaining.delete(cur);
      while (legs.length < STROLL_MAX_STOPS && remaining.size > 0) {
        const here = baseNodes.get(cur)!.location;
        const order = [...remaining.keys()].sort((a, b) => distanceM(here, baseNodes.get(a)!.location) - distanceM(here, baseNodes.get(b)!.location));
        let picked: { node: string; leg: Route } | null = null;
        for (const node of order) {
          if (distanceM(here, baseNodes.get(node)!.location) > STROLL_MAX_LEG_M) break;
          const leg = findRoute(segs, profile, cur, node);
          if (leg && leg.lengthM <= STROLL_MAX_LEG_M && total + leg.lengthM <= STROLL_MAX_M) {
            picked = { node, leg };
            break;
          }
        }
        if (!picked) break;
        legs.push(picked.leg);
        visited.push(...remaining.get(picked.node)!);
        total += picked.leg.lengthM;
        remaining.delete(picked.node);
        cur = picked.node;
        // Bacağın geçtiği diğer noktalar da ziyaret edilmiş sayılır.
        for (const id of picked.leg.nodeIds) {
          if (id !== cur && remaining.has(id)) {
            visited.push(...remaining.get(id)!);
            remaining.delete(id);
          }
        }
      }
      if (legs.length === 0) return null;
      const route = joinRoutes(legs);
      // Gezintinin varışı son anlatım noktasıdır: talimat "Vardınız: <nokta>" desin.
      const last = navPoints.find((p) => p.id === visited.at(-1));
      const named = last ? new Map(nodes).set(cur, { ...nodes.get(cur)!, name: last.title }) : nodes;
      const order = route.nodeIds;
      const pointIds = [...new Set(visited)].sort((a, b) => order.indexOf(viaNode.get(a)!) - order.indexOf(viaNode.get(b)!));
      return finish("stroll", route, named, profile, from, opts.leadIn, { pointIds, extraM: 0 }, undefined);
    },

    /** Yol kapatma senaryosu: kullanıcının önündeki ilk rota segmenti. */
    blockableAhead: (plan: PlannedRoute, alongM: number) => segmentAhead(plan.route, plan.geometry, alongM),
    /** Yanlış dönüş senaryosu: önümüzdeki ilk kavşakta rotadan ayrılan yürüyüş çizgisi. */
    detourFrom: (plan: PlannedRoute, alongM: number, blocked?: ReadonlySet<string>) =>
      buildDetour(plan.route, plan.geometry, segmentsWith(blocked), nodeLocations, alongM),

    /** İki düğüm arası rota uzunluğu ve basamak sayısı (tur planlama için). */
    legBetween(fromId: string, toId: string, profile: UserProfile): { lengthM: number; stairs: number } | null {
      const r = findRoute(effective, profile, fromId, toId);
      if (!r) return null;
      return { lengthM: r.lengthM, stairs: r.segmentIds.filter((id) => (effMap.get(id)?.steps ?? 0) > 0).length };
    },

    /** Bir konuma en yakın yol segmenti (erişilebilirlik bildirimi bu segmente bağlanır). */
    nearestSegmentId(p: LngLat): string {
      let best = baseSegments[0]!.id;
      let bestD = Infinity;
      for (const s of baseSegments) {
        const pts = s.geometry ?? [baseNodes.get(s.from)!.location, baseNodes.get(s.to)!.location];
        for (const q of pts) {
          const d = distanceM(p, q);
          if (d < bestD) {
            bestD = d;
            best = s.id;
          }
        }
      }
      return best;
    },

    /** Rotanın erişilebilirlik özeti: profil karşılaştırmasında gösterilir. */
    routeStats(plan: PlannedRoute) {
      let busyM = 0;
      let cobbleM = 0;
      for (const id of plan.route.segmentIds) {
        const seg = effMap.get(id);
        if (!seg) continue;
        if (seg.noise >= 0.6) busyM += seg.lengthM;
        if (seg.surface === "cobble") cobbleM += seg.lengthM;
      }
      return { lengthM: plan.route.lengthM, stairs: plan.stairSegments, busyM: Math.round(busyM), cobbleM: Math.round(cobbleM) };
    },

    /** Segmentin çizgisi (haritada kapalı yolları göstermek için); bilinmeyen segmentte null. */
    segmentCoords(id: string): LngLat[] | null {
      const seg = baseSegMap.get(id);
      if (!seg) return null;
      return seg.geometry ?? [baseNodes.get(seg.from)!.location, baseNodes.get(seg.to)!.location];
    },
  };
}

// ---------- Biçim ve ölçü ----------

/** Mesafe metni: 1 km altı metre, üstü tek ondalıklı kilometre (TR'de virgülle). */
export function formatDistance(m: number, lang: "tr" | "en"): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 })} km`;
}

/** Profile göre yürüme hızı (m/sn); süre tahmini ve simülasyon için. */
export function walkingSpeed(profile: UserProfile): number {
  if (profile.mobility === "wheelchair") return 0.9;
  if (profile.mobility === "cane" || profile.vision === "blind") return 0.8;
  return 1.2;
}

/** Çizginin sınırları: [batı, güney, doğu, kuzey]. */
export function boundsOf(line: LngLat[]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of line) {
    w = Math.min(w, x);
    s = Math.min(s, y);
    e = Math.max(e, x);
    n = Math.max(n, y);
  }
  return [w, s, e, n];
}
