import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGuidance, findRoute, NavSegment, routeGeometry, type NavNode, type UserProfile } from "./index";

// data/build_nav_graph.py çıktısı (OSM + doğrulanmış eserler).
const raw = JSON.parse(
  readFileSync(resolve(__dirname, "../../../apps/mobile/assets/pilot/suleymaniye-nav.json"), "utf8"),
) as { nodes: NavNode[]; segments: unknown[] };

const nodes = new Map(raw.nodes.map((n) => [n.id, n]));
const segments = raw.segments.map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));
const landmark = (name: string) => raw.nodes.find((n) => n.name?.tr === name)!;

const walker: UserProfile = { vision: "full", mobility: "none", senses: { audio: true, haptic: true, visual: true }, lang: "tr" };
const wheelchair: UserProfile = { ...walker, mobility: "wheelchair" };

describe("Süleymaniye pilot grafiği", () => {
  it("tüm külliye eserleri landmark olarak bağlı", () => {
    expect(raw.nodes.filter((n) => n.lynchType === "landmark").length).toBeGreaterThanOrEqual(15);
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
    const from = landmark("Süleymaniye Camii");
    const to = landmark("Mimar Sinan Türbesi") ?? landmark("Süleymaniye Tabhanesi");
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
});
