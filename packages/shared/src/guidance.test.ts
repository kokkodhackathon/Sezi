import { describe, expect, it } from "vitest";
import { buildGuidance, findRoute, NavSegment, routeGeometry, staticGuidanceTexts, type NavNode, type UserProfile } from "./index";

const profile = (lang: "tr" | "en"): UserProfile => ({
  vision: "full",
  mobility: "none",
  hearing: "full",
  senses: { audio: true, haptic: true, visual: true },
  lang,
});

// Adsız düğümlerden zikzak: A → B sola, B → C sağa (merdivenli), C → D sola (arnavut kaldırımı), D → E varış.
const nodes = new Map<string, NavNode>(
  (
    [
      { id: "A", lynchType: "node", location: [29.0600, 40.1840] },
      { id: "B", lynchType: "node", location: [29.0606, 40.1840] },
      { id: "C", lynchType: "node", location: [29.0606, 40.1845] },
      { id: "D", lynchType: "node", location: [29.0612, 40.1845] },
      { id: "E", lynchType: "node", location: [29.0612, 40.1850] },
    ] satisfies NavNode[]
  ).map((n) => [n.id, n]),
);
const segments = [
  { id: "AB", from: "A", to: "B", lengthM: 51 },
  { id: "BC", from: "B", to: "C", lengthM: 56, steps: 6 },
  { id: "CD", from: "C", to: "D", lengthM: 51, surface: "cobble" },
  { id: "DE", from: "D", to: "E", lengthM: 56 },
].map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));

describe("staticGuidanceTexts", () => {
  for (const lang of ["tr", "en"] as const) {
    it(`adsız rotanın bütün cümleleri sabit listede (${lang})`, () => {
      const route = findRoute(segments, profile(lang), "A", "E")!;
      const steps = buildGuidance(route, nodes, [], profile(lang), routeGeometry(route, nodes, segMap), segMap);
      const turns = steps.filter((s) => s.kind !== "confirm");
      // Dönüşler, iki uyarı ve varış gerçekten üretildi; hepsi gömülü seslerden çalınabilir.
      expect(turns.map((s) => s.hazard).filter(Boolean).sort()).toEqual(["cobble", "stairs"]);
      expect(turns.at(-1)!.kind).toBe("arrive");
      const known = new Set(staticGuidanceTexts(lang));
      for (const s of turns) expect(known, s.text).toContain(s.text);
    });
  }
});
