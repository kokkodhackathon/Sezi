import { describe, expect, it } from "vitest";
import { followRoute, initialTrack, polylineLength, type FollowInput, type LngLat, type LocationFix } from "./index";

// ~100 m doğu, sonra ~100 m kuzey giden L biçimli rota.
const A: LngLat = [29.06, 40.183];
const B: LngLat = [29.0611761, 40.183];
const C: LngLat = [29.0611761, 40.1839];
const line = [A, B, C];
const total = polylineLength(line);
const fix = (position: LngLat): LocationFix => ({ position, accuracyM: 5, t: 0 });

const base = (over: Partial<FollowInput>): FollowInput => ({
  line,
  totalM: total,
  stepsAtM: [0, 100, total],
  via: { pointIds: ["köşe"], atM: [100] },
  track: initialTrack,
  stepIndex: -1,
  fired: new Set(),
  fix: fix(A),
  mps: 1.2,
  snapToLine: false,
  atEnd: false,
  ...over,
});

describe("followRoute", () => {
  it("başlangıçta ilk talimata geçer, uğrama noktası henüz açılmaz", () => {
    const r = followRoute(base({}));
    expect(r.offRoute).toBe(false);
    if (r.offRoute) return;
    expect(r.stepIndex).toBe(0);
    expect(r.newStep).toBe(true);
    expect(r.reached).toEqual([]);
    expect(r.arrived).toBe(false);
  });

  it("noktanın rotadaki yerine varınca nokta açılır; açılmışsa tekrar açılmaz", () => {
    // Takip penceresi ileriye sınırlı: önce yolun ortasından geçilir.
    const mid = followRoute(base({ fix: fix([29.0607057, 40.183]), stepIndex: 0 }));
    if (mid.offRoute) throw new Error("rotada olmalı");
    expect(mid.reached).toEqual([]);
    const r = followRoute(base({ fix: fix(B), stepIndex: mid.stepIndex, track: mid.track }));
    if (r.offRoute) throw new Error("rotada olmalı");
    expect(r.reached).toEqual(["köşe"]);
    const again = followRoute(base({ fix: fix(B), stepIndex: r.stepIndex, track: r.track, fired: new Set(["köşe"]) }));
    if (again.offRoute) throw new Error("rotada olmalı");
    expect(again.reached).toEqual([]);
  });

  it("sanal yürüyüşçü çizginin sonundaysa sapmaya rağmen varılır", () => {
    const nearEnd: LngLat = [29.06125, 40.18385]; // C'nin ~8 m güneybatısı
    const r = followRoute(base({ fix: fix(nearEnd), stepIndex: 1, track: { ...initialTrack, alongM: 180 }, atEnd: true, snapToLine: true }));
    if (r.offRoute) throw new Error("rotada olmalı");
    expect(r.distance).toBeCloseTo(total, 5);
    expect(r.arrived).toBe(true);
    // Çizgiye oturtulan konum rotanın sonudur.
    expect(r.position[0]).toBeCloseTo(C[0], 6);
    expect(r.position[1]).toBeCloseTo(C[1], 6);
  });

  it("ardışık uzak ölçümler rotadan çıkış sayılır", () => {
    const far: LngLat = [29.0605881, 40.1836]; // rotanın ~65 m kuzeyi
    let input = base({ fix: fix([29.0605881, 40.183]), stepIndex: 0 });
    let r = followRoute(input);
    for (let k = 0; k < 4 && !r.offRoute; k++) {
      input = { ...input, track: r.track, fix: fix(far) };
      r = followRoute(input);
    }
    expect(r.offRoute).toBe(true);
  });
});
