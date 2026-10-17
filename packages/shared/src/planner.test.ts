import { describe, expect, it } from "vitest";
import { createPlanner, type LngLat, type NavPoint, type PilotGraphData, type UserProfile } from "./index";

const walker: UserProfile = {
  vision: "full",
  mobility: "none",
  hearing: "full",
  senses: { audio: true, haptic: true, visual: false },
  lang: "tr",
};

// Yerel düzlemde metre → yaklaşık lng/lat (40. enlem).
const pt = (x: number, y: number): LngLat => [29 + x / 85_277, 40 + y / 110_540];

// A —100 m— M —100 m— B (eser); M'den kuzeye 100 m C (eser değil).
const raw: PilotGraphData = {
  area: "test",
  name: { tr: "Test" },
  center: pt(100, 0),
  nodes: [
    { id: "A", lynchType: "node", location: pt(0, 0) },
    { id: "M", lynchType: "node", location: pt(100, 0) },
    { id: "B", lynchType: "landmark", location: pt(200, 0), workSlug: "eser-b", workType: "han", name: { tr: "B Hanı" } },
    { id: "C", lynchType: "node", location: pt(100, 100) },
  ],
  segments: [
    { id: "AM", from: "A", to: "M", lengthM: 100 },
    { id: "MB", from: "M", to: "B", lengthM: 100 },
    { id: "MC", from: "M", to: "C", lengthM: 100 },
  ],
};

const point = (id: string, at: LngLat, extra: Partial<NavPoint> = {}): NavPoint => ({
  id,
  citySlug: "bursa",
  roles: ["story"],
  title: { tr: `Nokta ${id}` },
  body: { tr: `Metin ${id}` },
  location: at,
  radiusM: 25,
  sortOrder: 0,
  audio: {},
  ...extra,
});

describe("createPlanner", () => {
  it("rota yol üstündeki anlatım noktasına uğrar ve noktanın rotadaki yerini verir", () => {
    const p = createPlanner(raw);
    p.setNavPoints([point("s", pt(100, 10))]);
    const plan = p.planRoute("eser-b", walker, pt(0, 0))!;
    expect(plan.route.nodeIds).toEqual(["A", "M", "B"]);
    expect(plan.via.pointIds).toEqual(["s"]);
    expect(plan.via.extraM).toBe(0);
    expect(plan.via.atM[0]).toBeCloseTo(100, 0);
    expect(plan.end.workSlug).toBe("eser-b");
  });

  it("açılmış nokta yeniden uğrama listesine girmez", () => {
    const p = createPlanner(raw);
    p.setNavPoints([point("s", pt(100, 10))]);
    const plan = p.planRoute("eser-b", walker, pt(0, 0), { skip: new Set(["s"]) })!;
    expect(plan.via.pointIds).toEqual([]);
  });

  it("onaylı inşaat bildirimi yolu kapatır; tek yol kapanınca rota yoktur", () => {
    const p = createPlanner(raw);
    expect(p.planRoute("eser-b", walker, pt(0, 0))).not.toBeNull();
    p.setOverrides([{ segment_key: "MB", type: "construction" }]);
    expect(p.planRoute("eser-b", walker, pt(0, 0))).toBeNull();
  });

  it("gezinti yakındaki noktaları sırayla dolaşır ve son noktada biter", () => {
    const p = createPlanner(raw);
    p.setNavPoints([point("near", pt(100, 5)), point("far", pt(100, 95))]);
    const plan = p.planStroll(walker, pt(0, 0))!;
    expect(plan.kind).toBe("stroll");
    expect(plan.via.pointIds).toEqual(["near", "far"]);
    expect(plan.route.nodeIds.at(-1)).toBe("C");
  });

  it("başlangıç noktaları sırayla gelir; ilki varsayılan başlangıçtır", () => {
    const p = createPlanner(raw);
    expect(p.defaultStart()).toEqual(raw.center);
    p.setNavPoints([
      point("ikinci", pt(200, 0), { roles: ["start"], sortOrder: 2, body: undefined }),
      point("birinci", pt(0, 0), { roles: ["start"], sortOrder: 1, body: undefined }),
    ]);
    expect(p.startPoints().map((s) => s.id)).toEqual(["birinci", "ikinci"]);
    expect(p.defaultStart()).toEqual(pt(0, 0));
  });

  it("nokta değişince sürüm artar ve dinleyiciler haber alır", () => {
    const p = createPlanner(raw);
    let calls = 0;
    const off = p.subscribe(() => calls++);
    const before = p.version();
    p.setNavPoints([]);
    off();
    p.setNavPoints([]);
    expect(p.version()).toBe(before + 2);
    expect(calls).toBe(1);
  });
});
