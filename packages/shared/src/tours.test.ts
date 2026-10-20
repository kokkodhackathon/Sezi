import { describe, expect, it } from "vitest";

import { createPlanner, planTour, profileFor, type LngLat, type PilotGraphData } from "./index";

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

describe("planTour", () => {
  it("merdivenli tek yolla ulaşılan durak tekerlekli sandalye profilinde atlanır, yürüyende atlanmaz", () => {
    const planner = createPlanner(raw);
    const walkerTour = planTour(planner, "hanlar", profileFor("walker", "tr"), pt(0, 0));
    expect(walkerTour?.stops.map((s) => s.slug)).toEqual(["han-duz", "han-merdivenli"]);
    expect(walkerTour?.stairs).toBe(1);

    const wheelchairTour = planTour(planner, "hanlar", profileFor("wheelchair", "tr"), pt(0, 0));
    expect(wheelchairTour?.stops.map((s) => s.slug)).toEqual(["han-duz"]);
    expect(wheelchairTour?.stairs).toBe(0);
  });
});
