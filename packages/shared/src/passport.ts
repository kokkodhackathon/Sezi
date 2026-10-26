import { z } from "zod";

import { IdentitySchema, Visibility } from "./account";
import { distanceM } from "./geo";
import type { LocalizedText } from "./schemas";

export const VisitMethod = z.enum(["route", "checkin"]);
export type VisitMethod = z.infer<typeof VisitMethod>;
export const VisitSchema = z.object({
  work_slug: z.string(),
  first_at: z.string(),
  method: VisitMethod,
  distance_m: z.number().int().nullable(),
});
export type Visit = z.infer<typeof VisitSchema>;

export interface PassportWork {
  slug: string;
  name: LocalizedText;
  type_slug: string;
  city_slug: string;
  complex_slug: string | null;
  complex_name: LocalizedText | null;
  located: boolean;
}

export interface PassportTour {
  slug: string;
  title: LocalizedText;
  stops: string[];
}

export const ContributionsSchema = z.object({
  reports_approved: z.number(),
  photos_public: z.number(),
  photos_archived: z.number(),
  friends: z.number(),
});
export type Contributions = z.infer<typeof ContributionsSchema>;
export const EMPTY_CONTRIBUTIONS: Contributions = {
  reports_approved: 0, photos_public: 0, photos_archived: 0, friends: 0,
};

export interface PassportStats {
  stamps: number;
  types: number;
  distanceM: number;
  firstAt: string | null;
  cities: { slug: string; visited: number; total: number }[];
  toursDone: string[];
}

/** Aynı eserin ilk damgasını korur; tarih sırası saat diliminden bağımsızdır. */
export function mergeVisits(a: Visit[], b: Visit[]): Visit[] {
  const earliest = new Map<string, Visit>();
  for (const visits of [a, b]) {
    for (const visit of visits) {
      const previous = earliest.get(visit.work_slug);
      if (!previous || Date.parse(visit.first_at) < Date.parse(previous.first_at)) {
        earliest.set(visit.work_slug, visit);
      }
    }
  }
  return [...earliest.values()].sort((left, right) => Date.parse(left.first_at) - Date.parse(right.first_at));
}

export function passportStats(visits: Visit[], works: PassportWork[], tours: PassportTour[]): PassportStats {
  const bySlug = new Map(works.map((work) => [work.slug, work]));
  const cities = new Map<string, { slug: string; visited: number; total: number }>();
  for (const work of works) {
    let city = cities.get(work.city_slug);
    if (!city) {
      city = { slug: work.city_slug, visited: 0, total: 0 };
      cities.set(work.city_slug, city);
    }
    if (work.located) city.total++;
  }
  const knownVisits = mergeVisits(visits, []).filter((visit) => bySlug.has(visit.work_slug));
  const visited = new Set(knownVisits.map((visit) => visit.work_slug));
  const types = new Set<string>();
  let walked = 0;
  for (const visit of knownVisits) {
    const work = bySlug.get(visit.work_slug)!;
    types.add(work.type_slug);
    cities.get(work.city_slug)!.visited++;
    walked += visit.distance_m ?? 0;
  }
  return {
    stamps: knownVisits.length,
    types: types.size,
    distanceM: walked,
    firstAt: knownVisits[0]?.first_at ?? null,
    cities: [...cities.values()].filter((city) => city.total > 0)
      .sort((a, b) => b.visited - a.visited || a.slug.localeCompare(b.slug)),
    toursDone: tours.filter((tour) => {
      const stops = tour.stops.filter((slug) => bySlug.has(slug));
      return stops.length > 0 && stops.every((slug) => visited.has(slug));
    }).map((tour) => tour.slug),
  };
}

export const CHECKIN_RADIUS_M = 60;
export const CHECKIN_MAX_ACCURACY_M = 50;
export type CheckInResult = { ok: true; distanceM: number } | {
  ok: false;
  reason: "no_location" | "imprecise_place" | "weak_fix" | "far";
  distanceM: number | null;
};

export function checkIn(
  work: { lng: number | null; lat: number | null; location_precision: "exact" | "approximate" | "unknown" },
  fix: { position: [number, number]; accuracyM: number },
): CheckInResult {
  if (work.lng === null || work.lat === null) return { ok: false, reason: "no_location", distanceM: null };
  if (work.location_precision !== "exact") return { ok: false, reason: "imprecise_place", distanceM: null };
  if (fix.accuracyM > CHECKIN_MAX_ACCURACY_M) return { ok: false, reason: "weak_fix", distanceM: null };
  const distance = distanceM([work.lng, work.lat], fix.position);
  return distance > CHECKIN_RADIUS_M
    ? { ok: false, reason: "far", distanceM: distance }
    : { ok: true, distanceM: distance };
}

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_THUMB_EDGE = 480;
export const PHOTO_ALT_MAX = 300;
export const PHOTO_CAPTION_MAX = 280;
export const PHOTO_LIMIT = 300;
export const COMMUNITY_LICENSE = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" } as const;

export const UserPhotoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  work_slug: z.string(),
  path: z.string(),
  thumb_path: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  alt_text: z.string().trim().min(1).max(PHOTO_ALT_MAX),
  caption: z.string().max(PHOTO_CAPTION_MAX).nullable(),
  taken_at: z.string().nullable(),
  visibility: Visibility,
  review: z.enum(["none", "pending", "approved", "rejected"]),
  archive: z.enum(["none", "suggested", "accepted", "declined"]),
  credit_name: z.string().nullable(),
  media_id: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type UserPhoto = z.infer<typeof UserPhotoSchema>;

export const ProfileCardSchema = IdentitySchema.pick({
  user_id: true, display_name: true, username: true, avatar_path: true,
  avatar_tone: true, visibility: true, findable: true,
});
export type ProfileCard = z.infer<typeof ProfileCardSchema>;

export const FriendshipRowSchema = z.object({
  id: z.string().uuid(),
  requester: z.string().uuid(),
  addressee: z.string().uuid(),
  status: z.enum(["pending", "accepted"]),
  created_at: z.string(),
});
export type FriendshipRow = z.infer<typeof FriendshipRowSchema>;
export type FriendState = "none" | "outgoing" | "incoming" | "friends";

export function friendState(rows: FriendshipRow[], me: string, other: string): FriendState {
  const row = rows.find((item) => (item.requester === me && item.addressee === other)
    || (item.addressee === me && item.requester === other));
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester === me ? "outgoing" : "incoming";
}
