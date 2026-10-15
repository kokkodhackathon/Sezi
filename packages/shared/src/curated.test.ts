import { describe, expect, it } from "vitest";
import {
  CuratedRoute,
  curatedGuidance,
  dueStep,
  matchCurated,
  NavSegment,
  routeGeometry,
  type NavNode,
  type UserProfile,
} from "./index";

const walker: UserProfile = { vision: "full", mobility: "none", hearing: "full", senses: { audio: true, haptic: true, visual: true }, lang: "tr" };
const wheelchair: UserProfile = { ...walker, mobility: "wheelchair" };
const deaf: UserProfile = { ...walker, hearing: "deaf" };
const blind: UserProfile = { ...walker, vision: "blind", senses: { audio: true, haptic: true, visual: false } };

// S → P doğuya 60 m; P'de sola (15 m kuzey, basamaklı), Q'da sağa; R → T doğuya 60 m: zikzak.
const nodes = new Map<string, NavNode>(
  (
    [
      { id: "S", lynchType: "node", location: [28.96, 41.0] },
      { id: "P", lynchType: "node", location: [28.96072, 41.0] },
      { id: "Q", lynchType: "node", location: [28.96072, 41.000135] },
      { id: "R", lynchType: "node", location: [28.9609, 41.000135] },
      { id: "T", lynchType: "landmark", name: { tr: "Han", en: "Inn" }, location: [28.96162, 41.000135] },
    ] satisfies NavNode[]
  ).map((n) => [n.id, n]),
);
const segList = [
  { id: "SP", from: "S", to: "P", lengthM: 60 },
  { id: "PQ", from: "P", to: "Q", lengthM: 15, steps: 3 },
  { id: "QR", from: "Q", to: "R", lengthM: 15 },
  { id: "RT", from: "R", to: "T", lengthM: 60 },
].map((s) => NavSegment.parse(s));
const segs = new Map(segList.map((s) => [s.id, s]));

const def = CuratedRoute.parse({
  id: "zikzak",
  name: { tr: "Zikzak" },
  status: "verified",
  nodeIds: ["S", "P", "Q", "R", "T"],
  segmentIds: ["SP", "PQ", "QR", "RT"],
  maneuvers: [
    {
      nodeId: "P",
      kind: "turn",
      group: "z",
      text: { generic: { tr: "Sola, merdivene; hemen ardından sağa." }, visual: { tr: "Merdiveni görünce sola; hemen ardından sağa." } },
    },
    { nodeId: "Q", kind: "turn", group: "z", text: { generic: { tr: "Şimdi sağa." } } },
    { nodeId: "T", kind: "arrive", text: { generic: { tr: "Vardınız: Han." } } },
  ],
});

describe("altın rota eşleşmesi", () => {
  it("başlangıç ve varış eşleşince onaylı güzergâh aynen kullanılır", () => {
    const m = matchCurated([def], segs, walker, "S", "T");
    expect(m?.route.nodeIds).toEqual(["S", "P", "Q", "R", "T"]);
    expect(m?.route.lengthM).toBe(150);
  });

  it("taslak rota, kapalı segment ya da profil kısıtı motora bırakılır", () => {
    expect(matchCurated([{ ...def, status: "draft" }], segs, walker, "S", "T")).toBeNull();
    expect(matchCurated([def], new Map([...segs, ["QR", { ...segs.get("QR")!, blocked: true }]]), walker, "S", "T")).toBeNull();
    expect(matchCurated([def], segs, wheelchair, "S", "T")).toBeNull();
    expect(matchCurated([def], segs, walker, "S", "R")).toBeNull();
  });
});

describe("altın rota rehberliği", () => {
  const { route } = matchCurated([def], segs, walker, "S", "T")!;
  const geo = routeGeometry(route, nodes, segs);

  it("gruplu manevralar ayrı adım: her biri kendi konumu ve dönüşüyle", () => {
    const steps = curatedGuidance(def, route, nodes, walker, geo);
    expect(steps.map((s) => [s.nodeId, s.turn, s.group])).toEqual([
      ["P", "left", "z"],
      ["Q", "right", "z"],
      ["T", "straight", undefined],
    ]);
    expect(steps[1]!.atM - steps[0]!.atM).toBeCloseTo(15, 0);
    expect(steps[0]!.legM).toBe(Math.round(steps[1]!.atM - steps[0]!.atM));
  });

  it("zikzağın iki dönüşü de yürüyüşte ayrı ayrı tetiklenir", () => {
    const steps = curatedGuidance(def, route, nodes, walker, geo);
    const atM = steps.map((s) => s.atM);
    const total = geo.nodeAtM.at(-1)!;
    for (const mps of [1.3, 10.4]) {
      const announced: number[] = [];
      let idx = -1;
      for (let along = 0; along <= total; along += mps * 0.2) {
        const next = dueStep(atM, idx, along, total, mps);
        if (next > idx) announced.push(next);
        idx = next;
      }
      expect(dueStep(atM, idx, total, total, mps)).toBe(2);
      expect(announced.slice(0, 2), `${mps} m/sn`).toEqual([0, 1]);
    }
  });

  it("ipucu metni profile göre seçilir; varyant yoksa genel metin", () => {
    expect(curatedGuidance(def, route, nodes, deaf, geo)[0]).toMatchObject({ cueType: "visual", text: "Merdiveni görünce sola; hemen ardından sağa." });
    expect(curatedGuidance(def, route, nodes, blind, geo)[0]).toMatchObject({ cueType: "generic", text: "Sola, merdivene; hemen ardından sağa." });
  });

  it("rotada olmayan manevra düğümü hata verir", () => {
    const bad = { ...def, maneuvers: [{ ...def.maneuvers[0]!, nodeId: "X" }, def.maneuvers[2]!] };
    expect(() => curatedGuidance(bad, route, nodes, walker, geo)).toThrow(/rotada yok/);
  });
});
