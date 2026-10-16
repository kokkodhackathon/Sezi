import { describe, expect, it } from "vitest";
import { duePoints, pointVoice, startPointsOf, type LngLat, type LocationFix, type NavPoint } from "./index";

const pt = (x: number, y: number): LngLat => [29 + x / 85_277, 40 + y / 110_540];

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

const fix = (at: LngLat, accuracyM = 8): LocationFix => ({ position: at, accuracyM, t: 0 });

describe("duePoints", () => {
  const a = point("a", pt(0, 0));
  const b = point("b", pt(15, 0));

  it("yarıçap içindekini tetikler, dışındakini tetiklemez", () => {
    expect(duePoints([a], fix(pt(20, 0)), new Set()).map((p) => p.id)).toEqual(["a"]);
    expect(duePoints([a], fix(pt(30, 0)), new Set())).toEqual([]);
  });

  it("bu yürüyüşte açılmış nokta tekrar tetiklenmez", () => {
    expect(duePoints([a], fix(pt(0, 0)), new Set(["a"]))).toEqual([]);
  });

  it("konum hatası büyükse tetikleme yapılmaz", () => {
    expect(duePoints([a], fix(pt(0, 0), 60), new Set())).toEqual([]);
  });

  it("birden çok nokta yakından uzağa sıralanır", () => {
    expect(duePoints([a, b], fix(pt(12, 0)), new Set()).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("yalnız başlangıç ya da yer işareti olan nokta açılmaz; eser varışı açılır", () => {
    const start = point("s", pt(0, 0), { roles: ["start", "landmark"], body: undefined });
    const arrival = point("v", pt(0, 0), { roles: ["arrival"], workSlug: "koza-hani" });
    expect(duePoints([start, arrival], fix(pt(0, 0)), new Set()).map((p) => p.id)).toEqual(["v"]);
  });
});

describe("pointVoice", () => {
  const at = pt(0, 0);

  it("İngilizce kayıt varsa onu çalar", () => {
    const p = point("p", at, { audio: { tr: "tr.mp3", en: "en.mp3" }, body: { tr: "Metin", en: "Text" } });
    expect(pointVoice(p, "en")).toEqual({ kind: "file", path: "en.mp3", lang: "en" });
  });

  it("İngilizce kayıt yoksa İngilizce metni seslendirir", () => {
    const p = point("p", at, { audio: { tr: "tr.mp3" }, body: { tr: "Metin", en: "Text" } });
    expect(pointVoice(p, "en")).toEqual({ kind: "tts", text: "Text", lang: "en" });
  });

  it("İngilizce metin de yoksa Türkçe kayda düşer", () => {
    const p = point("p", at, { audio: { tr: "tr.mp3" } });
    expect(pointVoice(p, "en")).toEqual({ kind: "file", path: "tr.mp3", lang: "tr" });
  });

  it("kayıt yoksa Türkçe metni seslendirir; metin de yoksa ses yok", () => {
    expect(pointVoice(point("p", at), "tr")).toEqual({ kind: "tts", text: "Metin p", lang: "tr" });
    expect(pointVoice(point("q", at, { roles: ["landmark"], body: undefined }), "tr")).toBeNull();
  });
});

describe("startPointsOf", () => {
  it("yalnız başlangıçlar, sıra numarasına göre", () => {
    const list = [
      point("b", pt(0, 0), { roles: ["start"], sortOrder: 2 }),
      point("x", pt(0, 0), { roles: ["landmark"] }),
      point("a", pt(0, 0), { roles: ["start", "landmark"], sortOrder: 1 }),
    ];
    expect(startPointsOf(list).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
