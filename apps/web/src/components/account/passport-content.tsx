"use client";

import {
  achievements,
  EMPTY_CONTRIBUTIONS,
  passportStats,
  type Achievement,
  type LocalizedText,
  type PassportStats,
  type PassportTour,
  type PassportWork,
  type Visit,
} from "@sezi/shared";
import Link from "next/link";

import { AccountNote } from "@/components/account/form-error";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate, href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import {
  getCities,
  getContributions,
  getTours,
  getVisits,
  getWorks,
} from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export interface PassportData {
  works: PassportWork[];
  tours: PassportTour[];
  visits: Visit[];
  cities: { slug: string; name: LocalizedText }[];
  stats: PassportStats;
  list: Achievement[];
}

export function usePassportData(uid: string | undefined) {
  return useAsync(async () => {
    if (!uid) return null;
    const [works, tours, visits, contributions, cities] = await Promise.all([
      getWorks(),
      getTours(),
      getVisits(uid),
      getContributions(uid),
      getCities(),
    ]);
    return {
      works,
      tours,
      visits,
      cities,
      stats: passportStats(visits, works, tours),
      list: achievements({
        works,
        tours,
        visits,
        contributions: contributions ?? EMPTY_CONTRIBUTIONS,
      }),
    };
  }, [uid]);
}
export function DiscoveryStats({ stats }: { stats: PassportStats }) {
  const { t } = useT();
  return (
    <dl className="grid grid-cols-3 gap-4 rounded-lg border bg-card p-4">
      <div>
        <dt className="text-sm text-muted-foreground">{t("passport.title")}</dt>
        <dd className="mt-1 font-heading text-xl font-bold">
          {t("passport.stamps", { n: stats.stamps })}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">{t("passport.types")}</dt>
        <dd className="mt-1 font-heading text-xl font-bold">{stats.types}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">
          {t("passport.distance")}
        </dt>
        <dd className="mt-1 font-heading text-xl font-bold">
          {(stats.distanceM / 1000).toFixed(1)}
        </dd>
      </div>
    </dl>
  );
}
export function StampList({
  visits,
  works,
}: {
  visits: Visit[];
  works: PassportWork[];
}) {
  const { t, lang } = useT();
  const bySlug = new Map(works.map((work) => [work.slug, work]));
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {[...visits]
        .sort((a, b) => b.first_at.localeCompare(a.first_at))
        .map((visit) => {
          const work = bySlug.get(visit.work_slug);
          if (!work) return null;
          return (
            <li key={visit.work_slug}>
              <Link
                className="flex min-h-12 flex-col justify-center gap-1 p-4 hover:bg-muted"
                href={href(lang, `/eser/${work.slug}`)}
              >
                <span className="font-heading font-bold">
                  {work.name[lang] ?? work.name.tr}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(lang, visit.first_at)} ·{" "}
                  {t(
                    visit.method === "checkin"
                      ? "passport.byCheckin"
                      : "passport.byRoute",
                  )}
                </span>
              </Link>
            </li>
          );
        })}
    </ul>
  );
}
export function PassportContent({ data }: { data: PassportData }) {
  const { t, lang } = useT();
  return (
    <>
      <DiscoveryStats stats={data.stats} />
      <section className="grid gap-4">
        <h2 className="font-heading text-lg font-bold">
          {t("passport.cities")}
        </h2>
        {data.stats.cities.map((city) => {
          const name = data.cities.find(
            (item) => item.slug === city.slug,
          )?.name;
          return (
            <ProgressBar
              key={city.slug}
              value={city.visited}
              max={city.total}
              label={name ? (name[lang] ?? name.tr) : city.slug}
            />
          );
        })}
      </section>
      {data.visits.length ? (
        <StampList visits={data.visits} works={data.works} />
      ) : (
        <>
          <AccountNote text={t("passport.empty")} />
          <AccountNote text={t("passport.webNote")} />
        </>
      )}
    </>
  );
}
