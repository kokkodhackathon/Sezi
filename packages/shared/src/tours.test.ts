import { describe, expect, it } from "vitest";

import { createPlanner, planTour, profileFor, type LngLat, type PilotGraphData, type Tour } from "./index";

const pt = (x: number, y: number): LngLat => [29 + x / 85_277, 40 + y / 110_540];

// Başlangıç A; B hanına düz yol (100 m), C hanına yalnız merdivenli yol (steps: 8).
const raw: PilotGraphData = {
  area: "test-tour",
  name: { tr: "Test Tur" },
  center: pt(0, 0),
  nodes: [
    { id: "A", lynchType: "node", location: pt(0, 0) },
    { id: "B", lynchType: "landmark", location: pt(100, 0), workSlug: "han-duz", workType: "han", name: { tr: "Düz Han" } },
    { id: "C", lynchType: "landmark", location: pt(200, 0), workSlug: "han-merdivenli", workType: "han", name: { tr: "Merdivenli Han" } },
  ],
  segments: [
    { id: "AB", from: "A", to: "B", lengthM: 100, steps: 0 },
    { id: "BC", from: "B", to: "C", lengthM: 100, steps: 8 },
  ],
};

const tour = (slug: string, stops: string[], fixedOrder = false): Tour => ({
  slug,
  citySlug: "test",
  title: { tr: slug },
  body: null,
  stops,
  fixedOrder,
  sortOrder: 0,
});

describe("planTour", () => {
  it("merdivenli tek yolla ulaşılan durak tekerlekli sandalye profilinde atlanır, yürüyende atlanmaz", () => {
    const planner = createPlanner(raw);
    const hanlar = tour("hanlar", ["han-duz", "han-merdivenli"]);
    const walkerTour = planTour(planner, hanlar, profileFor("walker", "tr"), pt(0, 0));
    expect(walkerTour?.stops.map((s) => s.slug)).toEqual(["han-duz", "han-merdivenli"]);
    expect(walkerTour?.stairs).toBe(1);

    const wheelchairTour = planTour(planner, hanlar, profileFor("wheelchair", "tr"), pt(0, 0));
    expect(wheelchairTour?.stops.map((s) => s.slug)).toEqual(["han-duz"]);
    expect(wheelchairTour?.stairs).toBe(0);
  });

  it("sabit sırada kayıtlı sıra korunur, otomatikte en yakın durak önce gelir", () => {
    const planner = createPlanner(raw);
    const walker = profileFor("walker", "tr");
    const stops = ["han-merdivenli", "han-duz"];
    expect(planTour(planner, tour("t", stops, true), walker, pt(0, 0))?.stops.map((s) => s.slug)).toEqual(stops);
    expect(planTour(planner, tour("t", stops), walker, pt(0, 0))?.stops.map((s) => s.slug)).toEqual(["han-duz", "han-merdivenli"]);
  });

  it("sabit sırada ulaşılamayan durak atlanır, sonraki durak son ulaşılan yerden hesaplanır", () => {
    const planner = createPlanner(raw);
    const plan = planTour(planner, tour("t", ["han-merdivenli", "han-duz"], true), profileFor("wheelchair", "tr"), pt(0, 0));
    expect(plan?.stops.map((s) => s.slug)).toEqual(["han-duz"]);
    expect(plan?.lengthM).toBe(100);
  });

  it("grafikte olmayan eser atlanır; hiçbiri yoksa tur planlanmaz", () => {
    const planner = createPlanner(raw);
    const walker = profileFor("walker", "tr");
    expect(planTour(planner, tour("t", ["yok", "han-duz"]), walker, pt(0, 0))?.stops.map((s) => s.slug)).toEqual(["han-duz"]);
    expect(planTour(planner, tour("t", ["yok", "yok-2"]), walker, pt(0, 0))).toBeNull();
  });

  it("otomatik sıra en yakın komşudan kısaysa onu seçer (git-gel yapmaz)", () => {
    // Düz yol: -60 (C) ... -10 (A) ... 0 (S) ... +20 (B). En yakın komşu: A, B, C = 10 + 30 + 80 = 120 m.
    // En kısa: B, A, C = 20 + 30 + 50 = 100 m.
    const line: PilotGraphData = {
      area: "test-line",
      name: { tr: "Düz" },
      center: pt(0, 0),
      nodes: [
        { id: "C", lynchType: "landmark", location: pt(-60, 0), workSlug: "c", workType: "han", name: { tr: "C" } },
        { id: "A", lynchType: "landmark", location: pt(-10, 0), workSlug: "a", workType: "han", name: { tr: "A" } },
        { id: "S", lynchType: "node", location: pt(0, 0) },
        { id: "B", lynchType: "landmark", location: pt(20, 0), workSlug: "b", workType: "han", name: { tr: "B" } },
      ],
      segments: [
        { id: "CA", from: "C", to: "A", lengthM: 50, steps: 0 },
        { id: "AS", from: "A", to: "S", lengthM: 10, steps: 0 },
        { id: "SB", from: "S", to: "B", lengthM: 20, steps: 0 },
      ],
    };
    const plan = planTour(createPlanner(line), tour("t", ["a", "b", "c"]), profileFor("walker", "tr"), pt(0, 0));
    expect(plan?.stops.map((s) => s.slug)).toEqual(["b", "a", "c"]);
    expect(plan?.lengthM).toBe(100);
  });
});
