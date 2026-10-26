"use client";

import Link from "next/link";
import { useEffect } from "react";

import { FormError } from "@/components/account/form-error";
import { usePassportData } from "@/components/account/passport-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { errorKey } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { getFriendships, getPhotos } from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export function SocialOverview({ uid }: { uid: string }) {
  const { t, lang } = useT();
  const { identity } = useIdentity();
  const passport = usePassportData(uid);
  const community = useAsync(async () => {
    const [photos, friendships] = await Promise.all([
      getPhotos({ uid }),
      getFriendships(),
    ]);
    return {
      photos: photos.length,
      incoming: friendships.filter(
        (row) => row.status === "pending" && row.addressee === uid,
      ).length,
    };
  }, [uid]);
  const reload = community.reload;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [reload]);
  const data = passport.data;
  const closest = data?.list
    .filter((item) => item.level === 0 && item.nextTarget !== null)
    .sort(
      (a, b) =>
        b.current / (b.nextTarget || 1) - a.current / (a.nextTarget || 1),
    )[0];
  return (
    <>
      <FormError text={passport.error ? t(errorKey(passport.error)) : null} />
      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("passport.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="font-heading text-2xl font-bold">
                {t("passport.stamps", { n: data.stats.stamps })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("passport.summary", {
                  cities: data.stats.cities.filter((city) => city.visited > 0)
                    .length,
                  km: (data.stats.distanceM / 1000).toFixed(1),
                })}
              </p>
              <ul className="grid gap-1 text-sm">
                {data.visits.slice(0, 3).map((visit) => {
                  const work = data.works.find(
                    (item) => item.slug === visit.work_slug,
                  );
                  return work ? (
                    <li key={visit.work_slug}>
                      {work.name[lang] ?? work.name.tr}
                    </li>
                  ) : null;
                })}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="min-h-12">
                <Link href={href(lang, "/hesap/pasaport")}>
                  {t("passport.open")}
                </Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("ach.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p>
                {t("ach.count", {
                  n: data.list.filter((item) => item.level > 0).length,
                  total: data.list.length,
                })}
              </p>
              {closest && closest.nextTarget !== null ? (
                <ProgressBar
                  value={closest.current}
                  max={closest.nextTarget}
                  label={t(`ach.${closest.kind}.title`, {
                    name: closest.subject
                      ? (closest.subject.name[lang] ?? closest.subject.name.tr)
                      : "",
                  })}
                />
              ) : null}
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="min-h-12">
                <Link href={href(lang, "/hesap/basarimlar")}>
                  {t("ach.see")}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </>
      ) : null}
      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-bold">
          {t("social.community")}
        </h2>
        <div className="grid divide-y rounded-lg border bg-card">
          <Link
            className="flex min-h-12 items-center justify-between gap-3 px-4"
            href={href(lang, "/hesap/fotograflar")}
          >
            {t("photos.title")}
            <Badge variant="secondary">{community.data?.photos ?? 0}</Badge>
          </Link>
          <Link
            className="flex min-h-12 items-center justify-between gap-3 px-4"
            href={href(lang, "/hesap/arkadaslar")}
          >
            {t("friends.title")}
            {community.data?.incoming ? (
              <Badge>{community.data.incoming}</Badge>
            ) : null}
          </Link>
          <Link
            className="flex min-h-12 items-center justify-between gap-3 px-4"
            href={href(lang, "/hesap/gizlilik")}
          >
            {t("privacy.title")}
            <span className="text-sm text-muted-foreground">
              {t(
                identity?.visibility === "public"
                  ? "account.visPublic"
                  : identity?.visibility === "friends"
                    ? "account.visFriends"
                    : "account.visPrivate",
              )}
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
