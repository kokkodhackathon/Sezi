import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGuidance, CuratedRoute, curatedGuidance, findRoute, matchCurated, NavSegment, routeGeometry, turnAt, type NavNode, type UserProfile } from "./index";

// data/build_nav_graph.py çıktısı (OSM + doğrulanmış eserler).
const raw = JSON.parse(
  readFileSync(resolve(__dirname, "../../../apps/mobile/assets/pilot/bursa-hanlar-nav.json"), "utf8"),
) as { nodes: NavNode[]; segments: unknown[]; curatedRoutes?: unknown[] };

const nodes = new Map(raw.nodes.map((n) => [n.id, n]));
const segments = raw.segments.map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));

const walker: UserProfile = { vision: "full", mobility: "none", hearing: "full", senses: { audio: true, haptic: true, visual: true }, lang: "tr" };
const wheelchair: UserProfile = { ...walker, mobility: "wheelchair" };

describe("Bursa Ulu Cami ve Hanlar pilot grafiği", () => {
  it("bölgenin eserleri landmark olarak bağlı", () => {
    expect(raw.nodes.filter((n) => n.lynchType === "landmark").length).toBeGreaterThanOrEqual(5);
  });

  it("her landmark çifti arasında yürüyüş rotası var", () => {
    const lms = raw.nodes.filter((n) => n.lynchType === "landmark");
    for (const a of lms) {
      for (const b of lms) {
        if (a.id !== b.id) expect(findRoute(segments, walker, a.id, b.id), `${a.name?.tr} → ${b.name?.tr}`).not.toBeNull();
      }
    }
  });

  it("tekerlekli sandalye rotası hiçbir basamaklı segmentten geçmez", () => {
    const lms = raw.nodes.filter((n) => n.lynchType === "landmark");
    for (const a of lms) {
      for (const b of lms) {
        const r = a.id !== b.id ? findRoute(segments, wheelchair, a.id, b.id) : null;
        for (const sid of r?.segmentIds ?? []) expect(segMap.get(sid)!.steps).toBe(0);
      }
    }
  });

  it("rota geometrisi ve yönlendirme adımları tutarlı", () => {
    const lms = raw.nodes.filter((n) => n.lynchType === "landmark");
    const from = lms.find((n) => n.name?.tr.startsWith("Ulu Cami")) ?? lms[0]!;
    const to = lms.find((n) => n.name?.tr.startsWith("Koza Han")) ?? lms.at(-1)!;
    const route = findRoute(segments, walker, from.id, to.id)!;
    const geo = routeGeometry(route, nodes, segMap);
    expect(geo.nodeAtM).toHaveLength(route.nodeIds.length);
    expect(geo.nodeAtM.at(-1)!).toBeCloseTo(route.lengthM, -1);

    const steps = buildGuidance(route, nodes, [], walker, geo);
    expect(steps.at(-1)!.nodeId).toBe(to.id);
    expect(steps.at(-1)!.text).toMatch(/^Vardınız/);
    // Adımlar rota boyunca ileri doğru sıralı.
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.atM).toBeGreaterThanOrEqual(steps[i - 1]!.atM);
  });

  it("gömülü altın rotalar grafikte kesintisiz ve rehberliğe dönüşüyor", () => {
    const curated = (raw.curatedRoutes ?? []).map((r) => CuratedRoute.parse(r));
    expect(curated.length).toBeGreaterThan(0);
    for (const def of curated) {
      const m = matchCurated(curated, segMap, walker, def.nodeIds[0]!, def.nodeIds.at(-1)!);
      expect(m?.def.id, def.id).toBe(def.id);
      const steps = curatedGuidance(def, m!.route, nodes, walker, routeGeometry(m!.route, nodes, segMap));
      expect(steps).toHaveLength(def.maneuvers.length);
      for (let i = 1; i < steps.length; i++) expect(steps[i]!.atM).toBeGreaterThan(steps[i - 1]!.atM);
    }
  });

  it("altın rotada ok, haptik ve metin aynı dönüşü söyler", () => {
    const side = (t: string) => t.toLocaleLowerCase("tr").match(/\b(sağa|sola|geri|düz)\b/)?.[1];
    for (const r of raw.curatedRoutes ?? []) {
      const def = CuratedRoute.parse(r);
      const m = matchCurated([def], segMap, walker, def.nodeIds[0]!, def.nodeIds.at(-1)!)!;
      const geo = routeGeometry(m.route, nodes, segMap);
      // Sessiz dönüş yok: geometride dönülen her ara düğümde bir manevra olmalı.
      const spoken = new Set(def.maneuvers.map((x) => x.nodeId));
      for (let k = 1; k < m.route.nodeIds.length - 1; k++) {
        const turn = turnAt(m.route, k, nodes, geo);
        if (turn !== "straight") expect(spoken.has(m.route.nodeIds[k]!), `${def.id}: ${m.route.nodeIds[k]} düğümünde ${turn} duyurulmuyor`).toBe(true);
      }
      for (const s of curatedGuidance(def, m.route, nodes, walker, geo)) {
        if (s.kind === "confirm") expect(s.turn, s.text).toBe("straight");
        if (s.kind !== "turn") continue;
        // Haptik ve ok `turn`'den gelir; metnin ilk yönü onunla aynı yanda olmalı.
        const want = s.turn.endsWith("left") ? "sola" : s.turn.endsWith("right") ? "sağa" : s.turn === "back" ? "geri" : "düz";
        expect(side(s.text), `${s.nodeId}: ${s.text} (${s.turn})`).toBe(want);
      }
    }
  });
});
