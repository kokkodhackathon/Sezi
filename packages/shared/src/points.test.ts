import { describe, expect, it } from "vitest";
import { arrivalText, duePoints, excerpt, passingWorkPoints, pointVoice, startPointsOf, withoutSupersededArrivals, workPoint, type LngLat, type LocationFix, type NavPoint } from "./index";

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

describe("excerpt", () => {
  it("kısa ilk paragrafa ikinciyi ekler, uzunsa son tam cümlede keser", () => {
    const s1 = "Cami, Sultan II. Murad’ın harem ağalarından Reyhan Paşa tarafından 15. yüzyılda inşa ettirilmiştir.";
    const s2 = "Acemlerin ayinlerini icra ettikleri hane aynı mahallededir.";
    const long = `${s1} ${s2} ${"Yapı defalarca onarılmıştır. ".repeat(20)}`;
    // "II." ve "15." cümle sonu sayılmaz; kesim tam cümlede biter.
    expect(excerpt(long, 180)).toBe(`${s1} ${s2}`);
    expect(excerpt(`Kısa giriş.\n\n${s1}`)).toBe(`Kısa giriş. ${s1}`);
  });

  it("cümle sonu bulunamazsa sözcük sınırında üç noktayla keser", () => {
    const out = excerpt("kelime ".repeat(100), 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith("kelime…")).toBe(true);
  });
});

describe("passingWorkPoints", () => {
  const w = (slug: string) => workPoint({ slug, citySlug: "bursa", name: { tr: slug }, location: pt(0, 0), text: { tr: `${slug} metni.` } });

  it("admin'de anlatımı olan, hedef ya da turdaki eseri atlar", () => {
    const nav = [point("p", pt(0, 0), { workSlug: "a" }), point("l", pt(0, 0), { roles: ["landmark"], body: undefined, workSlug: "b" })];
    const out = passingWorkPoints([w("a"), w("b"), w("c"), w("d")], nav, new Set(["d"]));
    // b'nin noktası yalnız yer işareti (metin açmaz): eser kartı yine açılır.
    expect(out.map((p) => p.workSlug)).toEqual(["b", "c"]);
  });

  it("yanından geçerken yarıçapta tetiklenir", () => {
    expect(duePoints([w("c")], fix(pt(15, 0)), new Set()).map((p) => p.id)).toEqual(["work:c"]);
    expect(duePoints([w("c")], fix(pt(30, 0)), new Set())).toEqual([]);
  });
});

describe("varış metninin sırası", () => {
  const w = (slug: string) => workPoint({ slug, citySlug: "bursa", name: { tr: slug }, location: pt(0, 0), text: { tr: `${slug} özeti.` } });
  const arrival = (slug: string) => point(`v-${slug}`, pt(0, 0), { roles: ["arrival"], workSlug: slug, body: { tr: `${slug} varış notu.` } });

  it("eserin metni varsa o, yoksa admin'in varış noktası", () => {
    expect(arrivalText("a", [w("a")], arrival("a"))?.body?.tr).toBe("a özeti.");
    expect(arrivalText("b", [w("a")], arrival("b"))?.body?.tr).toBe("b varış notu.");
    expect(arrivalText("c", [w("a")], undefined)).toBeUndefined();
  });

  it("metni olan eserin varış noktası yolda açılmaz, yerine eserin anlatımı açılır; anlatım noktası kalır", () => {
    const story = point("s-a", pt(0, 0), { roles: ["story", "arrival"], workSlug: "a" });
    const nav = withoutSupersededArrivals([arrival("a"), arrival("b"), story], [w("a")]);
    expect(nav.map((p) => p.id)).toEqual(["v-b", "s-a"]);
    expect(passingWorkPoints([w("a")], withoutSupersededArrivals([arrival("a")], [w("a")]), new Set()).map((p) => p.workSlug)).toEqual(["a"]);
  });
});
