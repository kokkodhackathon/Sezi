"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { FormError } from "@/components/account/form-error";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { getPhotos, photoUrls, socialErrorKey } from "@/lib/social";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";

export function PhotoImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const { t } = useT();
  const [failed, setFailed] = useState<string>();
  if (!src || failed === src)
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex aspect-square items-center justify-center bg-muted p-4 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {t("photos.imageUnavailable")}
      </div>
    );
  // İmzalı özel kova adresleri Next görsel önbelleğine alınmaz.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("aspect-square w-full object-cover", className)}
      onError={() => setFailed(src)}
    />
  );
}

export function CommunityPhotos({ slug }: { slug: string }) {
  const { t, lang } = useT();
  const { user } = useAccount();
  const headingId = useId();
  const result = useAsync(async () => {
    const photos = await getPhotos({ workSlug: slug, community: true });
    const urls = await photoUrls(
      photos.flatMap((photo) => [photo.thumb_path, photo.path]),
    );
    return { photos, urls };
  }, [slug, user?.id]);
  const data = result.data;
  if (result.loading || (!result.error && !result.data?.photos.length))
    return null;
  return (
    <section aria-labelledby={headingId} className="grid gap-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="font-heading text-lg font-bold">
          {t("works.community")}
        </h2>
        {user ? (
          <Button asChild variant="outline" className="min-h-12">
            <Link
              href={href(
                lang,
                `/hesap/fotograflar/yeni?eser=${encodeURIComponent(slug)}`,
              )}
            >
              {t("photos.add")}
            </Link>
          </Button>
        ) : null}
      </div>
      {result.error ? (
        <FormError text={t(socialErrorKey(result.error))} />
      ) : null}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {data?.photos.map((photo) => (
          <figure key={photo.id} className="w-48 shrink-0">
            <a
              href={data.urls[photo.path]}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <PhotoImage
                src={data.urls[photo.thumb_path]}
                alt={photo.alt_text}
              />
            </a>
            <figcaption className="mt-2 text-sm text-muted-foreground">
              {photo.credit_name
                ? t("photos.credit", { name: photo.credit_name })
                : null}
              {photo.caption ? (
                <p className="mt-1 text-foreground">{photo.caption}</p>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
