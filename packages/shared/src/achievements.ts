import { mergeVisits } from "./passport";
import type { Contributions, PassportTour, PassportWork, Visit } from "./passport";
import type { LocalizedText } from "./schemas";

export type AchievementKind = "first_stamp" | "stamps" | "types" | "cities" | "walker" | "complex" | "tour" | "reporter" | "photographer" | "sharer" | "companion";

export interface Achievement {
  id: string;
  kind: AchievementKind;
  level: number;
  maxLevel: number;
  current: number;
  nextTarget: number | null;
  earnedAt: string | null;
  subject: { slug: string; name: LocalizedText } | null;
}

/** Külliye ve tur eşikleri içerikteki ziyaret edilebilir duraklardan hesaplanır. */
export const THRESHOLDS = {
  first_stamp: [1],
  stamps: [5, 15, 40],
  types: [3, 6],
  cities: [2, 3],
  walker: [1000, 5000, 20000],
  reporter: [1, 5],
  photographer: [1, 5],
  sharer: [1],
  companion: [1],
} as const;

interface Progress {
  achievement: Achievement;
  targets: readonly number[];
}

function progress(kind: AchievementKind, targets: readonly number[], subject: Achievement["subject"] = null): Progress {
  return {
    targets,
    achievement: {
      id: subject ? `${kind}:${subject.slug}` : kind,
      kind, level: 0, maxLevel: targets.length, current: 0,
      nextTarget: targets[0] ?? null, earnedAt: null, subject,
    },
  };
}

function advance(item: Progress, current: number, at: string | null): void {
  const achievement = item.achievement;
  achievement.current = current;
  achievement.level = item.targets.filter((target) => current >= target).length;
  achievement.nextTarget = item.targets[achievement.level] ?? null;
  if (achievement.level > 0 && achievement.earnedAt === null) achievement.earnedAt = at;
}

export function achievements(input: {
  visits: Visit[];
  works: PassportWork[];
  tours: PassportTour[];
  contributions: Contributions;
}): Achievement[] {
  const { visits, works, tours, contributions } = input;
  const bySlug = new Map(works.map((work) => [work.slug, work]));
  const groups = new Map<string, { subject: NonNullable<Achievement["subject"]>; stops: Set<string> }>();
  for (const work of works) {
    if (!work.located || !work.complex_slug || !work.complex_name) continue;
    let group = groups.get(work.complex_slug);
    if (!group) {
      group = { subject: { slug: work.complex_slug, name: work.complex_name }, stops: new Set() };
      groups.set(work.complex_slug, group);
    }
    group.stops.add(work.slug);
  }
  const membership = new Map<string, Progress[]>();
  const addSubject = (kind: "complex" | "tour", subject: NonNullable<Achievement["subject"]>, stops: Set<string>): Progress => {
    const item = progress(kind, [stops.size], subject);
    for (const slug of stops) {
      const members = membership.get(slug);
      if (members) members.push(item);
      else membership.set(slug, [item]);
    }
    return item;
  };
  const complexes = [...groups.values()].filter((group) => group.stops.size >= 2)
    .sort((a, b) => a.subject.name.tr.localeCompare(b.subject.name.tr, "tr"))
    .map((group) => addSubject("complex", group.subject, group.stops));
  const tourItems = tours.map((tour) => ({ tour, stops: new Set(tour.stops.filter((slug) => bySlug.has(slug))) }))
    .filter((item) => item.stops.size >= 2)
    .sort((a, b) => a.tour.title.tr.localeCompare(b.tour.title.tr, "tr"))
    .map(({ tour, stops }) => addSubject("tour", { slug: tour.slug, name: tour.title }, stops));
  const first = progress("first_stamp", THRESHOLDS.first_stamp);
  const stamps = progress("stamps", THRESHOLDS.stamps);
  const types = progress("types", THRESHOLDS.types);
  const cities = progress("cities", THRESHOLDS.cities);
  const walker = progress("walker", THRESHOLDS.walker);
  const typeSlugs = new Set<string>();
  const citySlugs = new Set<string>();
  let count = 0;
  let walked = 0;
  for (const visit of mergeVisits(visits, [])) {
    const work = bySlug.get(visit.work_slug);
    if (!work) continue;
    count++;
    typeSlugs.add(work.type_slug);
    citySlugs.add(work.city_slug);
    walked += visit.distance_m ?? 0;
    advance(first, count, visit.first_at);
    advance(stamps, count, visit.first_at);
    advance(types, typeSlugs.size, visit.first_at);
    advance(cities, citySlugs.size, visit.first_at);
    advance(walker, walked, visit.first_at);
    for (const item of membership.get(work.slug) ?? []) {
      advance(item, item.achievement.current + 1, visit.first_at);
    }
  }
  const reporter = progress("reporter", THRESHOLDS.reporter);
  const photographer = progress("photographer", THRESHOLDS.photographer);
  const sharer = progress("sharer", THRESHOLDS.sharer);
  const companion = progress("companion", THRESHOLDS.companion);
  advance(reporter, contributions.reports_approved, null);
  advance(photographer, contributions.photos_archived, null);
  advance(sharer, contributions.photos_public, null);
  advance(companion, contributions.friends, null);
  return [first, stamps, types, cities, walker, ...complexes, ...tourItems, reporter, photographer, sharer, companion]
    .map((item) => item.achievement);
}

export function achievementLevels(list: Achievement[]): Record<string, number> {
  return Object.fromEntries(list.map((item) => [item.id, item.level]));
}

export function newlyEarned(prev: Record<string, number>, list: Achievement[]): Achievement[] {
  return list.filter((item) => item.level > (prev[item.id] ?? 0));
}
