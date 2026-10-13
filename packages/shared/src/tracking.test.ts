import { describe, expect, it } from "vitest";
import { announceLeadM, dueStep, initialTrack, OFF_ROUTE_FIXES, projectOnLine, trackFix, type LocationFix } from "./tracking";
import type { LngLat } from "./schemas";

// Bursa Ulu Cami çevresinde ~100 m doğu, sonra ~100 m kuzey giden L biçimli rota.
const A: LngLat = [29.0600, 40.1830];
const B: LngLat = [29.0611761, 40.1830];
const C: LngLat = [29.0611761, 40.1839];
const line = [A, B, C];
const fix = (position: LngLat, accuracyM = 5): LocationFix => ({ position, accuracyM, t: 0 });

describe("projectOnLine", () => {
  it("çizgi üzerindeki noktayı doğru mesafeye eşler", () => {
    const p = projectOnLine(line, [29.0605881, 40.1830]);
    expect(p.alongM).toBeCloseTo(50, 0);
    expect(p.crossM).toBeLessThan(0.5);
  });

  it("çizgiden uzak noktanın dik uzaklığını verir", () => {
    const p = projectOnLine(line, [29.0605881, 40.18318]); // ~20 m kuzey
    expect(p.crossM).toBeGreaterThan(18);
    expect(p.crossM).toBeLessThan(22);
  });

  it("pencere dışındaki parçalara sıçramaz", () => {
    // Köşeye yakın nokta; pencere yalnızca ilk 40 m'yi kapsıyor.
    const p = projectOnLine(line, [29.0611, 40.1831], { fromM: 0, toM: 40 });
    expect(p.alongM).toBeLessThanOrEqual(40);
  });
});

describe("trackFix", () => {
  it("ilerleme geri gitmez", () => {
    let s = trackFix(initialTrack, line, fix([29.0605881, 40.1830]));
    s = trackFix(s, line, fix([29.0604, 40.1830]));
    expect(s.alongM).toBeCloseTo(50, 0);
  });

  it("tek sıçrama sapma sayılmaz; ardışık uzak ölçümler sayılır", () => {
    let s = trackFix(initialTrack, line, fix([29.0605881, 40.1830]));
    const far: LngLat = [29.0605881, 40.1835]; // ~55 m kuzey
    s = trackFix(s, line, fix(far));
    expect(s.offRoute).toBe(false);
    for (let i = 1; i < OFF_ROUTE_FIXES; i++) s = trackFix(s, line, fix(far));
    expect(s.offRoute).toBe(true);
    s = trackFix(s, line, fix([29.0606, 40.1830]));
    expect(s.offRoute).toBe(false);
  });

  it("konum hatası büyükse eşik büyür", () => {
    const near: LngLat = [29.0605881, 40.18322]; // ~25 m
    let s = initialTrack;
    for (let i = 0; i < OFF_ROUTE_FIXES; i++) s = trackFix(s, line, fix(near, 30));
    expect(s.offRoute).toBe(false);
  });
});

describe("dueStep", () => {
  const atM = [0, 100, 200];

  it("duyuru mesafesi hıza göre ölçeklenir ve sınırlıdır", () => {
    expect(announceLeadM(1.2)).toBe(6); // 4,8 m alt sınıra (6 m) yükselir
    expect(announceLeadM(3)).toBe(12);
    expect(announceLeadM(100)).toBe(40);
  });

  it("dönüşe yaklaşınca adım verilir", () => {
    expect(dueStep(atM, 0, 80, 200, 1.2)).toBe(0);
    expect(dueStep(atM, 0, 95, 200, 1.2)).toBe(1);
  });

  it("aynı anda geçilen adımlardan yalnızca en günceli döner, varış gerçek varışta", () => {
    expect(dueStep(atM, 0, 190, 200, 10)).toBe(1);
    expect(dueStep(atM, 0, 200, 200, 10)).toBe(2);
  });
});
