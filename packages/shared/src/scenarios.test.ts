import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDetour,
  buildGuidance,
  findRoute,
  initialTrack,
  NavSegment,
  OFF_ROUTE_FIXES,
  projectOnLine,
  routeGeometry,
  segmentAhead,
  trackFix,
  withLeadIn,
  type LngLat,
  type NavNode,
  type UserProfile,
} from "./index";

// Gerçek pilot grafiği: senaryolar sahadaki sokak ağında doğrulanır.
const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../apps/mobile/assets/pilot/bursa-hanlar-nav.json"), "utf8")) as {
  nodes: NavNode[];
  segments: unknown[];
};
const nodes = new Map(raw.nodes.map((n) => [n.id, n]));
const locations = new Map(raw.nodes.map((n) => [n.id, n.location]));
const segments = raw.segments.map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));
const landmark = (prefix: string) => raw.nodes.find((n) => n.lynchType === "landmark" && n.name?.tr.startsWith(prefix))!;

const walker: UserProfile = { vision: "full", mobility: "none", hearing: "full", senses: { audio: true, haptic: true, visual: true }, lang: "tr" };
const from = landmark("Ulucami");
const to = landmark("Fidan Hanı");
const route = findRoute(segments, walker, from.id, to.id)!;
const geo = routeGeometry(route, nodes, segMap);

describe("zengin Lynch dili", () => {
  const steps = buildGuidance(route, nodes, [], walker, geo, segMap);

  it("adımlar rota boyunca sıralı, varış sonda", () => {
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.atM).toBeGreaterThanOrEqual(steps[i - 1]!.atM);
    expect(steps.at(-1)!.kind).toBe("arrive");
  });

  it("uzun düzlükte teyit adımı var, aralar 90 m'yi aşmıyor", () => {
    let prev = 0;
    for (const s of steps) {
      expect(s.atM - prev).toBeLessThanOrEqual(90 + 1);
      prev = s.atM;
    }
  });

  it("merdivenli segmentten önce uyarı verilir; tekerlekli sandalye rotasında merdiven yok", () => {
    // Grafikten bağımsız: merdivenli bir parçayı ikinci adımda kullanan bir yürüyüş rotası bulunur.
    let checked = false;
    for (const stairs of segments.filter((x) => x.steps > 0)) {
      for (const [entry, exit] of [[stairs.from, stairs.to], [stairs.to, stairs.from]] as const) {
        const before = segments.find((x) => x.steps === 0 && (x.to === entry || x.from === entry) && x.id !== stairs.id);
        if (!before) continue;
        const start = before.to === entry ? before.from : before.to;
        const r = findRoute(segments, walker, start, exit);
        if (!r || r.segmentIds.indexOf(stairs.id) < 1) continue;
        const st = buildGuidance(r, nodes, [], walker, routeGeometry(r, nodes, segMap), segMap);
        expect(st.some((s) => s.hazard === "stairs" && /merdiven/.test(s.text))).toBe(true);
        const chair = { ...walker, mobility: "wheelchair" as const };
        const rc = findRoute(segments, chair, start, exit);
        if (rc) expect(rc.segmentIds.some((id) => segMap.get(id)!.steps > 0)).toBe(false);
        checked = true;
        break;
      }
      if (checked) break;
    }
    expect(checked).toBe(true);
  });

  it("başlangıç landmark'ı yer işareti olarak anılmaz", () => {
    expect(steps.some((s) => s.kind === "turn" && s.text.startsWith("Ulucami yakınında"))).toBe(false);
  });
});

describe("yeniden rota senaryoları", () => {
  it("yol kapatma: kapalı segmentten kaçınan yeni rota bulunur", () => {
    const ahead = segmentAhead(route, geo, 20)!;
    expect(ahead).not.toBeNull();
    const blocked = segments.map((s) => (s.id === ahead.segmentId ? { ...s, blocked: true } : s));
    const r = findRoute(blocked, walker, route.nodeIds[ahead.nodeIndex]!, to.id);
    expect(r).not.toBeNull();
    expect(r!.segmentIds).not.toContain(ahead.segmentId);
  });

  it("yanlış dönüş: sapma çizgisi rotadan ayrılır ve takip sapmayı fark eder", () => {
    const detour = buildDetour(route, geo, segments, locations, 0)!;
    expect(detour).not.toBeNull();
    const end = detour.line.at(-1)!;
    expect(projectOnLine(geo.line, end).crossM).toBeGreaterThan(20);

    let track = initialTrack;
    for (let i = 0; i < OFF_ROUTE_FIXES; i++) track = trackFix(track, geo.line, { position: end, accuracyM: 5, t: i });
    expect(track.offRoute).toBe(true);
  });

  it("bulunulan noktadan yeni rotaya bağlantı adım mesafelerini kaydırır", () => {
    const steps = buildGuidance(route, nodes, [], walker, geo, segMap);
    const p: LngLat = [geo.line[0]![0] + 0.0002, geo.line[0]![1]];
    const shifted = withLeadIn(geo, steps, p);
    const d = shifted.geometry.nodeAtM[0]!;
    expect(d).toBeGreaterThan(10);
    expect(shifted.geometry.line[0]).toEqual(p);
    expect(shifted.steps[0]!.atM).toBeCloseTo(steps[0]!.atM + d, 5);
  });
});
