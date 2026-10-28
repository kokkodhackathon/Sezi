import { describe, expect, it } from "vitest";

import { achievementLevels, achievements, badgeFor, EMPTY_CONTRIBUTIONS, newlyEarned } from "./index";
import type { Achievement, PassportWork, Visit } from "./index";

function work(slug: string, complex: string | null = null, located = true): PassportWork {
  return { slug, name: { tr: slug }, type_slug: slug, city_slug: slug, complex_slug: complex, complex_name: complex ? { tr: complex } : null, located };
}

function visit(slug: string, day: number, distance = 500): Visit {
  return { work_slug: slug, first_at: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`, method: "route", distance_m: distance };
}

describe("achievements", () => {
  it("beşinci ziyarette damga düzeyi 1 olur ve ilk eşik tarihi korunur", () => {
    const works = Array.from({ length: 15 }, (_, index) => work(`work-${index}`));
    const visits = works.map((item, index) => visit(item.slug, index + 1));
    const fifth = achievements({ works, tours: [], contributions: EMPTY_CONTRIBUTIONS, visits: visits.slice(0, 5).reverse() });
    expect(fifth.find((item) => item.id === "stamps")).toMatchObject({ level: 1, current: 5, maxLevel: 3, nextTarget: 15, earnedAt: visits[4]!.first_at });
    const fifteenth = achievements({ works, tours: [], contributions: EMPTY_CONTRIBUTIONS, visits });
    expect(fifteenth.find((item) => item.id === "stamps")).toMatchObject({ level: 2, nextTarget: 40, earnedAt: visits[4]!.first_at });
    expect(fifth.find((item) => item.id === "types")).toMatchObject({ level: 1, earnedAt: visits[2]!.first_at });
    expect(fifth.find((item) => item.id === "cities")).toMatchObject({ level: 2, earnedAt: visits[1]!.first_at });
    expect(fifth.find((item) => item.id === "walker")).toMatchObject({ level: 1, earnedAt: visits[1]!.first_at });
  });

  it("tek konumlu eserli külliyeye ve tek geçerli duraklı tura başarım üretmez", () => {
    const list = achievements({
      works: [work("a", "küçük"), work("b", "küçük", false)], visits: [],
      tours: [{ slug: "tiny", title: { tr: "Kısa" }, stops: ["a", "missing"] }], contributions: EMPTY_CONTRIBUTIONS,
    });
    expect(list.some((item) => item.kind === "complex" || item.kind === "tour")).toBe(false);
  });

  it("turun bilinmeyen durağını hedefe katmaz; tekrarları tek sayar", () => {
    const list = achievements({
      works: [work("a", "külliye"), work("b", "külliye"), work("c", "külliye", false)],
      visits: [visit("b", 2), visit("a", 1), visit("missing", 3), visit("a", 4)],
      tours: [{ slug: "tour", title: { tr: "Tur" }, stops: ["a", "b", "missing", "a"] }], contributions: EMPTY_CONTRIBUTIONS,
    });
    for (const id of ["complex:külliye", "tour:tour"]) {
      expect(list.find((item) => item.id === id)).toMatchObject({ current: 2, level: 1, maxLevel: 1, nextTarget: null, earnedAt: visit("b", 2).first_at });
    }
    expect(list.find((item) => item.id === "first_stamp")).toMatchObject({ current: 2, earnedAt: visit("a", 1).first_at });
  });

  it("katkıları doğru sayaçlardan alır; katkı başarımlarının tarihi yoktur", () => {
    const list = achievements({ visits: [], works: [], tours: [], contributions: { reports_approved: 5, photos_public: 1, photos_archived: 2, friends: 1 } });
    expect(list.slice(-4).map(({ kind, current, level, earnedAt }) => ({ kind, current, level, earnedAt }))).toEqual([
      { kind: "reporter", current: 5, level: 2, earnedAt: null },
      { kind: "photographer", current: 2, level: 1, earnedAt: null },
      { kind: "sharer", current: 1, level: 1, earnedAt: null },
      { kind: "companion", current: 1, level: 1, earnedAt: null },
    ]);
  });

  it("tür sırasını ve külliye ile tur için Türkçe ad sırasını korur", () => {
    const list = achievements({
      visits: [], works: [work("a", "Şehir"), work("b", "Şehir"), work("c", "Çarşı"), work("d", "Çarşı")],
      tours: [{ slug: "s", title: { tr: "Şehir" }, stops: ["a", "b"] }, { slug: "c", title: { tr: "Çarşı" }, stops: ["a", "b"] }],
      contributions: EMPTY_CONTRIBUTIONS,
    });
    expect(list.map((item) => item.id)).toEqual([
      "first_stamp", "stamps", "types", "cities", "walker", "complex:Çarşı", "complex:Şehir", "tour:c", "tour:s", "reporter", "photographer", "sharer", "companion",
    ]);
    expect(list.every((item) => item.level === 0 && item.earnedAt === null)).toBe(true);
  });
});

function badgeSubject(kind: Achievement["kind"], slug: string, name = slug): Achievement {
  return {
    id: `${kind}:${slug}`, kind, level: 0, maxLevel: 1, current: 0, nextTarget: 1, earnedAt: null,
    subject: { slug, name: { tr: name } },
  };
}

describe("rozet eşlemesi", () => {
  it("türleri çizilen rozetlere bağlar", () => {
    const list = achievements({ visits: [], works: [], tours: [], contributions: EMPTY_CONTRIBUTIONS });
    const byKind = Object.fromEntries(list.map((item) => [item.kind, badgeFor(item)]));
    expect(byKind).toMatchObject({
      first_stamp: "01-ilk-damga",
      stamps: "02-vakif-kasifi",
      types: "03-uslup-avcisi",
      cities: "04-sehirler-arasi",
      walker: "05-ilk-kilometre",
      reporter: "11-erisilebilirlik-elcisi",
      photographer: "12-arsiv-gozu",
      sharer: "13-ilk-kare",
      companion: "14-yol-arkadasi",
    });
  });

  it("tur slug'ını tabloya bağlar; bilinmeyen tur kervana düşer", () => {
    expect(badgeFor(badgeSubject("tour", "carsinin-kalbi"))).toBe("06-carsi-ehli");
    expect(badgeFor(badgeSubject("tour", "hanlar-yolu"))).toBe("07-kervan-yolcusu");
    expect(badgeFor(badgeSubject("tour", "kuzey-mahalleleri"))).toBe("08-kuzey-ruzgari");
    expect(badgeFor(badgeSubject("tour", "tophane-turbeleri"))).toBe("07-kervan-yolcusu");
    expect(badgeFor(badgeSubject("tour", "mahalle-camileri", "Sakin mahalle camileri"))).toBe("07-kervan-yolcusu");
  });

  it("külliyede kubbeleri, yalnız cami adında sessiz minareleri kullanır", () => {
    expect(badgeFor(badgeSubject("complex", "suleymaniye", "Süleymaniye Külliyesi"))).toBe("10-kubbeler-altinda");
    expect(badgeFor(badgeSubject("complex", "ulu-cami", "Ulu Cami"))).toBe("09-sessiz-minareler");
  });
});

describe("başarım düzeyi değişimleri", () => {
  it("1'den 2'ye geçişi döndürür; aynı düzeyi döndürmez", () => {
    const input = { visits: [], works: [], tours: [], contributions: { ...EMPTY_CONTRIBUTIONS, reports_approved: 1 } };
    const before = achievementLevels(achievements(input));
    const after = achievements({ ...input, contributions: { ...EMPTY_CONTRIBUTIONS, reports_approved: 5 } });
    expect(newlyEarned(before, after).map((item) => item.id)).toEqual(["reporter"]);
    expect(newlyEarned(achievementLevels(after), after)).toEqual([]);
    expect(newlyEarned({}, after).map((item) => item.id)).toEqual(["reporter"]);
  });
});
