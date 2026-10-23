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

describe("duyu ipucu atfı", () => {
  const cueAt = (points: NavPoint[], nodeId: string) => {
    const p = createPlanner(raw);
    p.setNavPoints(points);
    return p.landmarkNodes().find((n) => n.id === nodeId)?.cue;
  };
  const landmark = (id: string, at: LngLat, extra: Partial<NavPoint>) => point(id, at, { roles: ["landmark"], body: undefined, ...extra });

  it("eser düğümüne düşen ipucu yalnız nokta o esere bağlıysa geçer", () => {
    // B Hanı'nın yanındaki çeşme B'ye bağlanır ama eser adıyla anılır: "B Hanı… su sesi" yanlış atıf olur.
    expect(cueAt([landmark("cesme", pt(195, 5), { cue: "water" })], "B")).toBeUndefined();
    expect(cueAt([landmark("ezan", pt(195, 5), { cue: "prayer", workSlug: "eser-b" })], "B")).toBe("prayer");
  });

  it("adsız düğümde ad da ipucu da son bağlanan noktanındır", () => {
    const both = [landmark("firin", pt(100, 100), { cue: "bakery" }), landmark("tabela", pt(100, 100), {})];
    expect(cueAt(both, "C")).toBeUndefined();
    expect(cueAt([...both].reverse(), "C")).toBe("bakery");
  });
});

describe("yer işaretinin yönü", () => {
  // Doğuya düz yol (A → M → B eseri, 200 m'de bir düğüm). Fırın yolun 20 m kuzeyinde ya da güneyinde, M'den 40 m
  // önce; M'ye bağlanır. Teyit (133 m) fırını görür: düğüm tam önde, fırın ise yolun kenarında.
  const street: PilotGraphData = {
    area: "test-street",
    name: { tr: "Test" },
    center: pt(200, 0),
    nodes: [
      { id: "A", lynchType: "node", location: pt(0, 0) },
      { id: "M", lynchType: "node", location: pt(200, 0) },
      { id: "B", lynchType: "landmark", location: pt(400, 0), workSlug: "eser-b", workType: "han", name: { tr: "B Hanı" } },
    ],
    segments: [
      { id: "AM", from: "A", to: "M", lengthM: 200 },
      { id: "MB", from: "M", to: "B", lengthM: 200 },
    ],
  };
  const confirmAbout = (at: LngLat) => {
    const p = createPlanner(street);
    p.setNavPoints([point("firin", at, { roles: ["landmark"], body: undefined, title: { tr: "Fırın" }, cue: "bakery" })]);
    const step = p.planRoute("eser-b", walker, pt(0, 0), { via: false })!.steps.find((s) => s.kind === "confirm" && s.text.includes("Fırın"))!;
    return { text: step.text, location: step.landmark?.location };
  };

  it("yolun iki yanındaki kaynak, bağlandığı düğümden değil kendi konumundan anılır", () => {
    const north = pt(160, 20);
    const south = pt(160, -20);
    expect(confirmAbout(north).text).toContain("Fırın solunuzda.");
    expect(confirmAbout(south).text).toContain("Fırın sağınızda.");
    // Ses ve ekran için verilen konum da kaynağın kendisi.
    expect(confirmAbout(north).location).toEqual(north);
  });
});
