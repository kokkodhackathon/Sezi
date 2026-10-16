import { describe, expect, it } from "vitest";
import { dueStoryPoints, storyVoice, type LngLat, type LocationFix, type StoryPoint } from "./index";

const pt = (x: number, y: number): LngLat => [29 + x / 85_277, 40 + y / 110_540];

const point = (id: string, at: LngLat, extra: Partial<StoryPoint> = {}): StoryPoint => ({
  id,
  citySlug: "bursa",
  title: { tr: `Nokta ${id}` },
  body: { tr: `Metin ${id}` },
  location: at,
  radiusM: 25,
  audio: {},
  ...extra,
});

const fix = (at: LngLat, accuracyM = 8): LocationFix => ({ position: at, accuracyM, t: 0 });

describe("dueStoryPoints", () => {
  const a = point("a", pt(0, 0));
  const b = point("b", pt(15, 0));

  it("yarıçap içindekini tetikler, dışındakini tetiklemez", () => {
    expect(dueStoryPoints([a], fix(pt(20, 0)), new Set()).map((p) => p.id)).toEqual(["a"]);
    expect(dueStoryPoints([a], fix(pt(30, 0)), new Set())).toEqual([]);
  });

  it("bu yürüyüşte açılmış nokta tekrar tetiklenmez", () => {
    expect(dueStoryPoints([a], fix(pt(0, 0)), new Set(["a"]))).toEqual([]);
  });

  it("konum hatası büyükse tetikleme yapılmaz", () => {
    expect(dueStoryPoints([a], fix(pt(0, 0), 60), new Set())).toEqual([]);
  });

  it("birden çok nokta yakından uzağa sıralanır", () => {
    expect(dueStoryPoints([a, b], fix(pt(12, 0)), new Set()).map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("storyVoice", () => {
  const at = pt(0, 0);

  it("İngilizce kayıt varsa onu çalar", () => {
    const p = point("p", at, { audio: { tr: "tr.mp3", en: "en.mp3" }, body: { tr: "Metin", en: "Text" } });
    expect(storyVoice(p, "en")).toEqual({ kind: "file", path: "en.mp3", lang: "en" });
  });

  it("İngilizce kayıt yoksa İngilizce metni seslendirir", () => {
    const p = point("p", at, { audio: { tr: "tr.mp3" }, body: { tr: "Metin", en: "Text" } });
    expect(storyVoice(p, "en")).toEqual({ kind: "tts", text: "Text", lang: "en" });
  });

  it("İngilizce metin de yoksa Türkçe kayda düşer", () => {
    const p = point("p", at, { audio: { tr: "tr.mp3" } });
    expect(storyVoice(p, "en")).toEqual({ kind: "file", path: "tr.mp3", lang: "tr" });
  });

  it("kayıt yoksa Türkçe metni seslendirir", () => {
    expect(storyVoice(point("p", at), "tr")).toEqual({ kind: "tts", text: "Metin p", lang: "tr" });
  });
});
