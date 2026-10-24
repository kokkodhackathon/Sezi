import { describe, expect, it } from "vitest";

import { laneOffsetPx, routeLineParts, stopConnector, type LngLat, type Route, type RouteGeometry } from "./index";

const pt = (x: number, y = 0): LngLat => [29 + x / 85_277, 40 + y / 110_540];

// A -100 m- B -100 m- C; rota A -> B -> C (1. durak) -> B (geri) -> D (2. durak, B'nin kuzeyinde).
const A = pt(0);
const B = pt(100);
const C = pt(200);
const D = pt(100, 100);
const route: Route = { nodeIds: ["A", "B", "C", "B", "D"], segmentIds: ["AB", "BC", "BC", "BD"], lengthM: 400, cost: 400 };
const geometry: RouteGeometry = {
  line: [A, B, C, B, D],
  nodeAtM: [0, 100, 200, 300, 400],
  legs: [
    [A, B],
    [B, C],
    [C, B],
    [B, D],
  ],
};

describe("routeLineParts", () => {
  const { parts, runs } = routeLineParts([{ route, geometry, breaksM: [200] }]);

  it("git-dön yolu iki şeride ayrılır, bir kez yürünen yol kaymaz", () => {
    expect(parts.map((p) => p.lane)).toEqual([0, 1, 1, 0]);
    // Gidiş ve dönüş zıt yönde: ikisi de kendi sağına kayınca yan yana iki şerit olur.
    expect(laneOffsetPx(1, 6)).toBeGreaterThan(0);
    expect(laneOffsetPx(0, 6)).toBe(0);
  });

  it("uğrama noktasından sonra bacak numarası artar, ilerleme baştan sona artar", () => {
    expect(parts.map((p) => p.leg)).toEqual([0, 0, 1, 1]);
    const progress = parts.map((p) => p.progress);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(progress[0]).toBeGreaterThan(0);
    expect(progress.at(-1)).toBeLessThan(1);
  });

  it("oklar için aynı bacak ve şeritteki ardışık parçalar birleşir", () => {
    expect(runs.map((r) => [r.leg, r.lane, r.coords.length])).toEqual([
      [0, 0, 2],
      [0, 1, 2],
      [1, 1, 2],
      [1, 0, 2],
    ]);
    const straight = routeLineParts([{ route: { ...route, nodeIds: ["A", "B", "C"], segmentIds: ["AB", "BC"] }, geometry: { ...geometry, legs: geometry.legs.slice(0, 2) } }]);
    expect(straight.runs).toHaveLength(1);
    expect(straight.runs[0]!.coords).toEqual([A, B, C]);
  });

  it("turda bacaklar arası geri dönüş de şeride ayrılır, bacak numarası parçadan parçaya sürer", () => {
    const go = { route: { ...route, nodeIds: ["A", "B"], segmentIds: ["AB"] }, geometry: { line: [A, B], nodeAtM: [0, 100], legs: [[A, B]] } };
    const back = { route: { ...route, nodeIds: ["B", "A"], segmentIds: ["AB"] }, geometry: { line: [B, A], nodeAtM: [0, 100], legs: [[B, A]] } };
    const tour = routeLineParts([go, back]).parts;
    expect(tour.map((p) => [p.leg, p.lane])).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it("tam konumdan başlayan rotada ilk düğüme bağlantı da çizilir", () => {
    const from = pt(0, -30);
    const lead = routeLineParts([{ route, geometry: { ...geometry, line: [from, ...geometry.line] } }]).parts;
    expect(lead[0]!.coords).toEqual([from, A]);
    expect(lead[0]!.lane).toBe(0);
  });
});

describe("stopConnector", () => {
  it("nokta çizgiden uzaksa bağlantı çizilir, yakınsa çizilmez", () => {
    expect(stopConnector(A, pt(0, 30))).toEqual([A, pt(0, 30)]);
    expect(stopConnector(A, pt(0, 5))).toBeNull();
  });
});
