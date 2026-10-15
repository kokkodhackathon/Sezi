import { z } from "zod";
import { cuePreference, turnAt, type GuidanceStep } from "./guidance";
import { segmentCost, type Route, type RouteGeometry } from "./routing";
import { ContentStatus, LocalizedText, type NavNode, type NavSegment, type UserProfile } from "./schemas";

/**
 * Altın rota: ekibin elle yazdığı, onaylı Lynch tarifi (data/lynch/routes/*.json).
 * Güzergâh grafikte düğüm düğüm sabittir; her manevra atomiktir (kendi konumu, dönüşü, haptiği).
 * Birlikte anlatılması gereken manevralar `group` ile bağlanır; birleşen yalnızca sunumdur.
 */

export const CuratedManeuver = z.object({
  /** Manevranın yapıldığı rota düğümü. */
  nodeId: z.string(),
  /** Dönüş her zaman geometriden hesaplanır: ok, haptik ve metin aynı dönüşü söyler. */
  kind: z.enum(["turn", "confirm", "arrive"]),
  group: z.string().optional(),
  /** Bu manevradan sonra yürünen yol (Lynch "path"). */
  path: z.string().optional(),
  /** Bölgeye giriş/çıkış ya da bölgenin kenarı boyunca yürüme (Lynch "district" / "edge"). */
  district: z.object({ id: z.string(), name: LocalizedText, action: z.enum(["enter", "exit", "edge"]) }).optional(),
  /** Anılan yer işaretinin düğümü (ses ipucu yönü ve ekran için). */
  landmarkId: z.string().optional(),
  hazard: z.enum(["stairs", "cobble", "traffic"]).optional(),
  /** İpucu türüne göre metin; `generic` zorunlu, profil tercihi sırayla seçilir. */
  text: z.object({
    generic: LocalizedText,
    visual: LocalizedText.optional(),
    sound: LocalizedText.optional(),
    tactile: LocalizedText.optional(),
  }),
  fieldChecked: z.boolean().default(false),
});
export type CuratedManeuver = z.infer<typeof CuratedManeuver>;

export const CuratedRoute = z.object({
  id: z.string(),
  name: LocalizedText,
  status: ContentStatus,
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().optional(),
  /** Başlangıçtan varışa tüm düğümler. */
  nodeIds: z.array(z.string()).min(2),
  /** `nodeIds` ardışık çiftlerinin segmentleri (pipeline çözer ve doğrular). */
  segmentIds: z.array(z.string()).min(1),
  maneuvers: z.array(CuratedManeuver).min(1),
});
export type CuratedRoute = z.infer<typeof CuratedRoute>;

/**
 * Başlangıç ve varışı eşleşen onaylı altın rota; rotanın her segmenti bu profil için geçilebilir olmalı.
 * Kapalı segment ya da profil kısıtı (ör. tekerlekli sandalyede merdiven) varsa `null`: motor devralır.
 */
export function matchCurated(
  routes: readonly CuratedRoute[],
  segments: ReadonlyMap<string, NavSegment>,
  profile: UserProfile,
  fromId: string,
  toId: string,
): { def: CuratedRoute; route: Route } | null {
  for (const def of routes) {
    if (def.status !== "verified" || def.nodeIds[0] !== fromId || def.nodeIds.at(-1) !== toId) continue;
    let lengthM = 0;
    let cost = 0;
    let ok = true;
    for (const id of def.segmentIds) {
      const s = segments.get(id);
      const c = s ? segmentCost(s, profile) : null;
      if (!s || c === null) {
        ok = false;
        break;
      }
      lengthM += s.lengthM;
      cost += c;
    }
    if (ok) return { def, route: { nodeIds: def.nodeIds, segmentIds: def.segmentIds, lengthM, cost } };
  }
  return null;
}

/** Altın rotanın manevralarını rehberlik adımlarına çevirir (profile göre ipucu metni). */
export function curatedGuidance(
  def: CuratedRoute,
  route: Route,
  nodes: Map<string, NavNode>,
  profile: UserProfile,
  geometry: RouteGeometry,
): GuidanceStep[] {
  const lang = profile.lang;
  const order = cuePreference(profile);
  let from = 0;
  const indices = def.maneuvers.map((m) => {
    const k = route.nodeIds.indexOf(m.nodeId, from);
    if (k < 1) throw new Error(`Altın rota ${def.id}: ${m.nodeId} rotada yok ya da sıra dışı`);
    from = k + 1;
    return k;
  });
  const last = def.maneuvers.at(-1)!;
  if (last.kind !== "arrive" || indices.at(-1) !== route.nodeIds.length - 1) throw new Error(`Altın rota ${def.id}: son manevra varış olmalı`);

  return def.maneuvers.map((m, i) => {
    const k = indices[i]!;
    const atM = geometry.nodeAtM[k]!;
    const cueType = order.find((c) => (c === "generic" ? true : !!m.text[c])) ?? "generic";
    const t = cueType === "generic" ? m.text.generic : m.text[cueType]!;
    const lm = m.landmarkId ? nodes.get(m.landmarkId) : undefined;
    const lmName = lm?.name?.[lang] ?? lm?.name?.tr;
    const next = indices[i + 1];
    return {
      nodeId: m.nodeId,
      text: t[lang] ?? t.tr,
      cueType,
      turn: turnAt(route, k, nodes, geometry),
      authored: true,
      atM,
      landmark: lm && lmName ? { name: lmName, location: lm.location } : undefined,
      kind: m.kind,
      hazard: m.hazard,
      group: m.group,
      path: m.path,
      legM: next !== undefined ? Math.round(geometry.nodeAtM[next]! - atM) : undefined,
      fieldChecked: m.fieldChecked,
    };
  });
}

/** İki rotanın yol örtüşmesi: `a` uzunluğunun `b` ile ortak segmentlerdeki payı (0–1). Fark raporu için. */
export function routeOverlap(a: Route, b: Route, segments: ReadonlyMap<string, NavSegment>): number {
  if (a.lengthM <= 0) return 0;
  const inB = new Set(b.segmentIds);
  let shared = 0;
  for (const id of a.segmentIds) if (inB.has(id)) shared += segments.get(id)?.lengthM ?? 0;
  return shared / a.lengthM;
}
