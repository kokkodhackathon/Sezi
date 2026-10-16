import { describe, expect, it } from "vitest";
import { NavSegment, findRoute, joinRoutes, routeVia, type LngLat, type UserProfile } from "./index";

const profile: UserProfile = {
  vision: "full",
  mobility: "none",
  hearing: "full",
  senses: { audio: true, haptic: true, visual: false },
  lang: "tr",
};

// Yerel düzlemde metre → yaklaşık lng/lat (40. enlem).
const pt = (x: number, y: number): LngLat => [29 + x / 85_277, 40 + y / 110_540];

function graph(segs: { id: string; from: string; to: string; lengthM: number }[], locs: Record<string, LngLat>) {
  return {
    segments: segs.map((s) => NavSegment.parse(s)),
    locations: new Map(Object.entries(locs)),
  };
}

/** Rotadaki her segment, ardışık iki düğümü birbirine bağlamalı. */
function expectConnected(route: { nodeIds: string[]; segmentIds: string[] }, segments: NavSegment[]) {
  const byId = new Map(segments.map((s) => [s.id, s]));
  expect(route.segmentIds.length).toBe(route.nodeIds.length - 1);
  route.segmentIds.forEach((id, i) => {
    const s = byId.get(id)!;
    const ends = [route.nodeIds[i], route.nodeIds[i + 1]].sort();
    expect([s.from, s.to].sort()).toEqual(ends);
  });
}

// 100 m'lik düz yol A—M—B; M'den kuzeye yan çıkmazlar.
const street = (spurs: { id: string; lengthM: number; crowM: number }[]) =>
  graph(
    [
      { id: "AM", from: "A", to: "M", lengthM: 50 },
      { id: "MB", from: "M", to: "B", lengthM: 50 },
      ...spurs.map((s) => ({ id: `M${s.id}`, from: "M", to: s.id, lengthM: s.lengthM })),
    ],
    {
      A: pt(0, 0),
      M: pt(50, 0),
      B: pt(100, 0),
      ...Object.fromEntries(spurs.map((s) => [s.id, pt(50, s.crowM)])),
    },
  );

describe("routeVia", () => {
  it("yol üstündeki yakın adaya uğrar, bütçeyi aşmaz", () => {
    const g = street([{ id: "X", lengthM: 10, crowM: 10 }]);
    const v = routeVia(g.segments, profile, "A", "B", ["X"], g.locations)!;
    expect(v.via).toEqual(["X"]);
    expect(v.baseLengthM).toBe(100);
    expect(v.route.nodeIds[0]).toBe("A");
    expect(v.route.nodeIds.at(-1)).toBe("B");
    expect(v.route.lengthM).toBeLessThanOrEqual(v.baseLengthM * 1.25);
    expectConnected(v.route, g.segments);
  });

  it("ek yolu %25'i aşan aday dışarıda kalır", () => {
    // Kuş uçuşu yakın ama yürüyüşle 40 m: gidiş-dönüş 80 m > 25 m.
    const g = street([{ id: "Y", lengthM: 40, crowM: 5 }]);
    const v = routeVia(g.segments, profile, "A", "B", ["Y"], g.locations)!;
    expect(v.via).toEqual([]);
    expect(v.route).toEqual(findRoute(g.segments, profile, "A", "B"));
  });

  it("uzun rotada uzama 300 m ile sınırlıdır", () => {
    const g = graph(
      [
        { id: "AM", from: "A", to: "M", lengthM: 1000 },
        { id: "MB", from: "M", to: "B", lengthM: 1000 },
        { id: "MW", from: "M", to: "W", lengthM: 140 },
        { id: "MZ", from: "M", to: "Z", lengthM: 200 },
      ],
      { A: pt(0, 0), M: pt(1000, 0), B: pt(2000, 0), W: pt(1000, 1), Z: pt(1000, -1) },
    );
    // %25 = 500 m olurdu; Z 400 m ister, tavan 300 m.
    const onlyZ = routeVia(g.segments, profile, "A", "B", ["Z"], g.locations)!;
    expect(onlyZ.via).toEqual([]);
    const both = routeVia(g.segments, profile, "A", "B", ["W", "Z"], g.locations)!;
    expect(both.via).toEqual(["W"]);
    expect(both.route.lengthM - both.baseLengthM).toBe(280);
  });

  it("tek tek sığan ama birlikte aşan iki adaydan ucuzu seçilir", () => {
    const g = street([
      { id: "P", lengthM: 8, crowM: 8 },
      { id: "Q", lengthM: 10, crowM: 10 },
    ]);
    const v = routeVia(g.segments, profile, "A", "B", ["Q", "P"], g.locations)!;
    expect(v.via).toEqual(["P"]);
    expect(v.route.lengthM).toBe(116);
  });

  it("grafiğe bağlı olmayan aday yok sayılır", () => {
    const g = street([]);
    const locations = new Map(g.locations).set("U", pt(50, 3));
    const v = routeVia(g.segments, profile, "A", "B", ["U"], locations)!;
    expect(v.via).toEqual([]);
    expect(v.route.nodeIds).toEqual(["A", "M", "B"]);
  });

  it("başlangıçtan hedefe yol yoksa null", () => {
    const g = graph([{ id: "AM", from: "A", to: "M", lengthM: 50 }], { A: pt(0, 0), M: pt(50, 0), B: pt(100, 0) });
    expect(routeVia(g.segments, profile, "A", "B", ["M"], g.locations)).toBeNull();
  });
});

describe("joinRoutes", () => {
  it("kavşak düğümünü tekrarlamaz, uzunluk ve maliyeti toplar", () => {
    const r = joinRoutes([
      { nodeIds: ["A", "M"], segmentIds: ["AM"], lengthM: 50, cost: 40 },
      { nodeIds: ["M", "X"], segmentIds: ["MX"], lengthM: 10, cost: 10 },
      { nodeIds: ["X", "M", "B"], segmentIds: ["MX", "MB"], lengthM: 60, cost: 55 },
    ]);
    expect(r).toEqual({
      nodeIds: ["A", "M", "X", "M", "B"],
      segmentIds: ["AM", "MX", "MX", "MB"],
      lengthM: 120,
      cost: 105,
    });
  });
});
