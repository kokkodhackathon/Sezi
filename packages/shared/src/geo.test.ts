import { describe, expect, it } from "vitest";
import { distanceM, distanceToLineM } from "./geo";
import type { LngLat } from "./schemas";

// Bursa enleminde 100 m'lik düz doğu-batı segmenti; noktalar metre ofsetiyle kurulur.
const LAT = 40.184;
const M_LNG = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
const M_LAT = 1 / 110_574;
const at = (east: number, north: number): LngLat => [29.06 + east * M_LNG, LAT + north * M_LAT];
const line = [at(0, 0), at(100, 0)];

describe("distanceToLineM", () => {
  it("uzun segmentin ortasındaki noktayı yol üstünde sayar (uçlara 50 m olsa da)", () => {
    expect(distanceM(at(50, 0), line[0]!)).toBeGreaterThan(40);
    expect(distanceToLineM(at(50, 0), line)).toBeLessThan(0.5);
  });

  it("segmentin ortasından 41 m yandaki nokta 40 m eşiğinin dışında kalır", () => {
    const d = distanceToLineM(at(50, 41), line);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeCloseTo(41, 0);
  });

  it("segment dışına düşen noktada en yakın uca ölçer", () => {
    expect(distanceToLineM(at(130, 0), line)).toBeCloseTo(30, 0);
  });

  it("çok parçalı çizgide en yakın segmenti bulur", () => {
    const bent = [at(0, 0), at(100, 0), at(100, 100)];
    expect(distanceToLineM(at(110, 50), bent)).toBeCloseTo(10, 0);
  });
});
