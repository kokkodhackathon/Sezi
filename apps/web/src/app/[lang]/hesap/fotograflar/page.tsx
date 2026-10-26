"use client";

import { loc } from "@sezi/shared";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { PhotoImage, PhotoStatus } from "@/components/works/community-photos";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { getPhotos, getWorks, photoUrls } from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export default function PhotosPage() {
  return (
    <Suspense>
      <PhotoArchive />
    </Suspense>
  );
}

function PhotoArchive() {
  const { t, lang } = useT();
  const { ready, user } = useSocialAccount();
  const search = useSearchParams();
  const workSlug = search.get("eser") ?? "";
  const result = useAsync(async () => {
    if (!user) return null;
    const [photos, works] = await Promise.all([
      getPhotos({ uid: user.id, workSlug: workSlug || undefined }),
      getWorks(),
    ]);
    const urls = await photoUrls(photos.map((photo) => photo.thumb_path));
    return { photos, works, urls };
  }, [user?.id, workSlug]);
  const data = result.data;
  if (!ready || !user) return null;
  return (
    <SocialShell
      title="photos.title"
      error={result.error}
      loading={result.loading}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Field className="max-w-sm">
          <FieldLabel htmlFor="photo-work-filter">
            {t("photos.work")}
          </FieldLabel>
          <select
            id="photo-work-filter"
            value={workSlug}
            className="min-h-12 rounded-md border bg-background px-3 text-sm"
            onChange={(event) => {
              const url = new URL(window.location.href);
              if (event.target.value)
                url.searchParams.set("eser", event.target.value);
              else url.searchParams.delete("eser");
              window.history.replaceState(null, "", url);
            }}
          >
            <option value="">{t("photos.allWorks")}</option>
            {data?.works.map((work) => (
              <option key={work.slug} value={work.slug}>
                {loc(work.name, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Button asChild className="min-h-12">
          <Link
            href={href(
              lang,
              `/hesap/fotograflar/yeni${workSlug ? `?eser=${encodeURIComponent(workSlug)}` : ""}`,
            )}
          >
            {t("photos.add")}
          </Link>
        </Button>
      </div>
      {data?.photos.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("photos.empty")}</EmptyTitle>
            <EmptyDescription>{t("photos.emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data?.photos.map((photo) => {
          const work = data.works.find((item) => item.slug === photo.work_slug);
          return (
            <Link
              key={photo.id}
              href={href(lang, `/hesap/fotograflar/${photo.id}`)}
              className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border bg-card pb-3 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <PhotoImage
                src={data.urls[photo.thumb_path]}
                alt={photo.alt_text}
              />
              <div className="flex flex-col gap-2 px-3">
                <p className="truncate font-semibold">
                  {work ? loc(work.name, lang) : photo.work_slug}
                </p>
                <PhotoStatus photo={photo} />
              </div>
            </Link>
          );
        })}
      </div>
    </SocialShell>
  );
}
