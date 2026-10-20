import { loc, type ExhibitionRow } from "@sezi/shared";
import { CalendarIcon, ExternalLinkIcon, ImageIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber, href, t, type Lang } from "@/lib/i18n";

/** Sergi kartı: başlık, mekân, tarih aralığı, fotoğraf sayısı, açıklama, il ve duyuru bağlantısı. */
export function ExhibitionCard({ exhibition, lang }: { exhibition: ExhibitionRow; lang: Lang }) {
  const today = new Date().toISOString().slice(0, 10);
  const ongoing = Boolean(
    exhibition.starts_on &&
      exhibition.starts_on <= today &&
      (!exhibition.ends_on || exhibition.ends_on >= today),
  );
  const title = loc(exhibition.title, lang);
  const venue = loc(exhibition.venue, lang);
  const description = loc(exhibition.description, lang);
  const dates = exhibition.starts_on
    ? exhibition.ends_on
      ? t(lang, "works.exhibitions.dates", {
          from: formatDate(lang, exhibition.starts_on),
          to: formatDate(lang, exhibition.ends_on),
        })
      : t(lang, "works.exhibitions.from", { from: formatDate(lang, exhibition.starts_on) })
    : "";

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="font-heading text-xl font-bold">{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {ongoing ? <Badge variant="success">{t(lang, "works.exhibitions.ongoing")}</Badge> : null}
            {exhibition.city ? (
              <Badge variant="secondary">{loc(exhibition.city.name, lang)}</Badge>
            ) : null}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <MapPinIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{venue}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {dates ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4 shrink-0" aria-hidden />
              <span>{dates}</span>
            </span>
          ) : null}
          {exhibition.photo_count ? (
            <span className="inline-flex items-center gap-1.5 num">
              <ImageIcon className="size-4 shrink-0" aria-hidden />
              <span>
                {t(lang, "works.exhibitions.photos", {
                  n: formatNumber(lang, exhibition.photo_count),
                })}
              </span>
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {description ? <p className="text-base leading-relaxed text-muted-foreground">{description}</p> : null}
        {exhibition.city || exhibition.source_url ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {exhibition.city ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={href(lang, `/il/${exhibition.city.slug}`)}>
                  {t(lang, "works.exhibitions.cityLink", { city: loc(exhibition.city.name, lang) })}
                </Link>
              </Button>
            ) : null}
            {exhibition.source_url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={exhibition.source_url} target="_blank" rel="noopener noreferrer">
                  <span>{t(lang, "works.exhibitions.sourceLink")}</span>
                  <ExternalLinkIcon aria-hidden />
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
