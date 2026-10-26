import { describe, expect, it } from "vitest";

import { checkIn, friendState, IdentitySchema, mergeVisits, passportStats, Visibility } from "./index";
import type { FriendshipRow, PassportWork, Visit } from "./index";

function work(slug: string, city = "bursa", located = true): PassportWork {
  return { slug, name: { tr: slug }, type_slug: "cami", city_slug: city, complex_slug: null, complex_name: null, located };
}

function visit(slug: string, first_at = "2026-10-01T12:00:00Z"): Visit {
  return { work_slug: slug, first_at, method: "route", distance_m: 100 };
}

describe("checkIn", () => {
  const place = { lng: 29, lat: 40, location_precision: "exact" } as const;
  const north = (metres: number): [number, number] => [29, 40 + metres / 6_371_000 * 180 / Math.PI];

  it("59 metrede ve 10 m doğrulukla damga verir", () => {
    const result = checkIn(place, { position: north(59), accuracyM: 10 });
    expect(result.ok).toBe(true);
    expect(result.distanceM).toBeCloseTo(59);
  });

  it("61 metrede uzaklık hatası verir", () => {
    expect(checkIn(place, { position: north(61), accuracyM: 10 })).toMatchObject({ ok: false, reason: "far" });
  });

  it("doğruluk 51 m ise yakın konumda da reddeder", () => {
    expect(checkIn(place, { position: north(0), accuracyM: 51 })).toEqual({ ok: false, reason: "weak_fix", distanceM: null });
  });

  it("yaklaşık konumu GPS doğruluğundan önce reddeder", () => {
    expect(checkIn({ ...place, location_precision: "approximate" }, { position: north(0), accuracyM: 51 }))
      .toEqual({ ok: false, reason: "imprecise_place", distanceM: null });
  });

  it("eksik konumu ilk sırada reddeder; sıfır koordinatını kabul eder", () => {
    expect(checkIn({ ...place, lng: null }, { position: north(0), accuracyM: 10 }))
      .toEqual({ ok: false, reason: "no_location", distanceM: null });
    expect(checkIn({ lng: 0, lat: 0, location_precision: "exact" }, { position: [0, 0], accuracyM: 50 }).ok).toBe(true);
  });
});

describe("passportStats", () => {
  it("bilinmeyen damgaları ve konumsuz il toplamlarını dışarıda bırakır", () => {
    const works = [work("a"), work("b", "bursa", false), work("c", "hatay"), work("d", "konya", false)];
    const stats = passportStats([visit("a"), visit("b"), visit("missing"), visit("d")], works, [
      { slug: "done", title: { tr: "Tur" }, stops: ["a", "b", "missing"] },
      { slug: "later", title: { tr: "Diğer" }, stops: ["a", "c"] },
    ]);
    expect(stats).toEqual({
      stamps: 3, types: 1, distanceM: 300, firstAt: "2026-10-01T12:00:00Z",
      cities: [{ slug: "bursa", visited: 2, total: 1 }, { slug: "hatay", visited: 0, total: 1 }],
      toursDone: ["done"],
    });
  });

  it("eşit ziyaretli illeri slug sırasına dizer; yinelenen damgayı saymaz", () => {
    expect(passportStats([visit("a"), visit("a"), visit("b")], [work("b", "hatay"), work("a")], []).cities)
      .toEqual([{ slug: "bursa", visited: 1, total: 1 }, { slug: "hatay", visited: 1, total: 1 }]);
    expect(passportStats([], [], [])).toEqual({ stamps: 0, types: 0, distanceM: 0, firstAt: null, cities: [], toursDone: [] });
  });
});

describe("mergeVisits", () => {
  it("en erken kaydın yöntemini ve uzaklığını korur; tarih sırasına dizer", () => {
    const early: Visit = { ...visit("a", "2026-10-01T13:00:00+03:00"), method: "checkin", distance_m: null };
    const later = visit("a", "2026-10-01T11:00:00Z");
    const b = visit("b", "2026-10-02T12:00:00Z");
    expect(mergeVisits([b, later], [early])).toEqual([early, b]);
  });
});

describe("sosyal şemalar", () => {
  it("üç görünürlüğü destekler ve yeni kimlik alanlarını zorunlu tutar", () => {
    expect(Visibility.options).toEqual(["private", "friends", "public"]);
    const identity = { user_id: "a", display_name: "Ayşe", username: null, avatar_path: null, avatar_tone: "teal", visibility: "friends" };
    expect(IdentitySchema.safeParse(identity).success).toBe(false);
    expect(IdentitySchema.safeParse({ ...identity, findable: false, photo_default: "private" }).success).toBe(true);
  });

  it("arkadaşlık durumunu iki yönde ayırt eder", () => {
    const row: FriendshipRow = { id: "id", requester: "a", addressee: "b", status: "pending", created_at: "2026-10-01" };
    expect(friendState([row], "a", "b")).toBe("outgoing");
    expect(friendState([row], "b", "a")).toBe("incoming");
    expect(friendState([{ ...row, status: "accepted" }], "b", "a")).toBe("friends");
    expect(friendState([row], "a", "c")).toBe("none");
  });
});
