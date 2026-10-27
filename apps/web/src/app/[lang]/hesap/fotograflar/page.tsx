"use client";

import { loc } from "@sezi/shared";
import { Camera, X } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SocialShell, useSocialAccount } from "@/components/account/social-shell";
import { EmptyInvite, EmptyPhotoArt, photoStatus, StatusDots, TypeGlyph } from "@/components/account/social-visuals";
import { Button } from "@/components/ui/button";
import { PhotoImage } from "@/components/works/community-photos";
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
  const filtered = workSlug ? data?.works.find((work) => work.slug === workSlug) : undefined;
  const addHref = href(lang, `/hesap/fotograflar/yeni${workSlug ? `?eser=${encodeURIComponent(workSlug)}` : ""}`);
  const clearFilter = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("eser");
    window.history.replaceState(null, "", url);
  };
  return (
    <SocialShell title="photos.title" error={result.error} loading={result.loading}>
      {filtered ? (
        <div>
          <button
            type="button"
            onClick={clearFilter}
            aria-label={t("photos.clearFilter", { name: loc(filtered.name, lang) })}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-muted px-4 font-semibold outline-none hover:bg-border/60 focus-visible:ring-3 focus-visible:ring-ring"
          >
            <TypeGlyph slug={filtered.type_slug} className="size-5" />
            {loc(filtered.name, lang)}
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
      {data?.photos.length === 0 ? (
        <EmptyInvite
          art={<EmptyPhotoArt />}
          text={t("photos.emptyInvite")}
          action={
            <Button asChild className="min-h-12">
              <Link href={addHref}>{t("photos.add")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <li>
            <Link
              href={addHref}
              className="grid aspect-square place-items-center content-center gap-2 rounded-lg border-2 border-dashed border-link text-link outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
            >
              <Camera aria-hidden className="size-8" />
              <span className="font-semibold">{t("photos.add")}</span>
            </Link>
          </li>
          {data?.photos.map((photo) => {
            const status = photoStatus(photo, t);
            return (
              <li key={photo.id}>
                <Link
                  href={href(lang, `/hesap/fotograflar/${photo.id}`)}
                  aria-label={`${photo.alt_text}. ${status.map((item) => item.label).join(", ")}`}
                  className="relative block aspect-square overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <PhotoImage src={data.urls[photo.thumb_path]} alt="" className="size-full object-cover" />
                  <StatusDots items={status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SocialShell>
  );
}
