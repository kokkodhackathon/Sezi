import {
  coverOf,
  excerpt,
  hasLocation,
  inventorySource,
  loc,
  toneForType,
  type WorkCondition,
  type WorkSource,
} from "@sezi/shared";
import { AlertTriangleIcon, ArrowRightIcon, ExternalLinkIcon, RouteIcon, Volume2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeziMap } from "@/components/map";
import { PageContainer, SectionTitle } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoGallery } from "@/components/works/photo-gallery";
import { ReadMore } from "@/components/works/read-more";
import { PrecisionBadge, WorkCard } from "@/components/works/work-card";
import { getWork, getWorkIndex } from "@/lib/data";
import { formatDate, href, isLang, t, type Lang, type MessageKey } from "@/lib/i18n";
import { AUDIO_BASE, photoUrl } from "@/lib/media";
import { PILOT_SLUGS } from "@/lib/pilot-slugs";

export const revalidate = 600;
// Sayfalar ilk ziyarette üretilir ve önbellekte kalır (ISR); derlemede önceden üretilmez.
export const generateStaticParams = async (): Promise<{ slug: string }[]> => [];

const CONDITION_KEYS: Record<WorkCondition, MessageKey> = {
  intact: "works.condition.intact",
  restored: "works.condition.restored",
  damaged: "works.condition.damaged",
  destroyed: "works.condition.destroyed",
  unknown: "works.condition.unknown",
};

/** Envanter kitabı atfı: "Kitap, Cilt X, s. Y" (cilt yoksa ya da kitap adında zaten yazılıysa "Kitap, s. Y"). */
function formatBookAttribution(inv: WorkSource | undefined, lang: Lang): string | null {
  if (!inv) return null;
  const volumeInTitle = inv.volume !== null && new RegExp(`(Cilt|Vol\\.?|Volume)\\s*${inv.volume}\\b`, "i").test(inv.title);
  if (inv.volume !== null && inv.page && !volumeInTitle) {
    return t(lang, "works.detail.refVolumePage", {
      title: inv.title,
      volume: inv.volume,
      page: inv.page,
    });
  }
  if (inv.page) {
    return t(lang, "works.detail.refPageOnly", {
      title: inv.title,
      page: inv.page,
    });
  }
  return inv.title;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const work = await getWork(slug);
  if (!work) return {};

  const name = loc(work.name, lang);
  const rawDesc =
    loc(work.summary, lang) ||
    loc(work.history, lang) ||
    `${loc(work.type_name, lang)} · ${[work.district, loc(work.city_name, lang)].filter(Boolean).join(", ")}`;
  const description = excerpt(rawDesc, 160);
  const cover = coverOf(work);

  return {
    title: name,
    description,
    alternates: {
      languages: {
        tr: `/tr/eser/${work.slug}`,
        en: `/en/eser/${work.slug}`,
      },
    },
    openGraph: {
      title: name,
      description,
      images: cover
        ? [
            {
              url: photoUrl(cover, "full"),
              alt: loc(cover.alt, lang) || name,
            },
          ]
        : undefined,
    },
  };
}

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();

  const work = await getWork(slug);
  if (!work) notFound();

  const allWorks = work.complex_slug ? await getWorkIndex() : [];
  const complexSiblings = work.complex_slug
    ? allWorks.filter((w) => w.complex_slug === work.complex_slug && w.slug !== work.slug)
    : [];

  const name = loc(work.name, lang);
  const typeName = loc(work.type_name, lang);
  const cityName = loc(work.city_name, lang);
  const summary = loc(work.summary, lang);
  const history = loc(work.history, lang);
  const architecture = loc(work.architecture, lang);
  const period = loc(work.period, lang);
  const address = loc(work.address, lang);
  const conditionNote = loc(work.condition_note, lang);
  const complexName = loc(work.complex_name, lang);

  const inv = inventorySource(work);
  const bookAttribution = formatBookAttribution(inv, lang);
  const invSection = loc(inv?.section, lang);
  const otherSources = work.sources.filter((s) => s.kind !== "inventory");
  const isPilot = PILOT_SLUGS.has(work.slug);
  const cover = coverOf(work);

  // Ses kaydı: dilde varsa o, yoksa Türkçe kayıt (varsa); hiçbiri yoksa oynatıcı gösterilmez.
  const audioPath = lang === "en" ? (work.audio_en ?? work.audio_tr) : work.audio_tr;

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sezi.info").replace(/\/$/, "");
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LandmarksOrHistoricalBuildings",
    name,
    description: excerpt(summary || history || `${typeName} · ${cityName}`, 240),
    url: `${siteBase}/${lang}/eser/${work.slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: work.district ?? undefined,
      addressRegion: cityName,
      streetAddress: address || undefined,
      addressCountry: "TR",
    },
    ...(hasLocation(work)
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: work.lat,
            longitude: work.lng,
          },
        }
      : {}),
    ...(cover ? { image: photoUrl(cover, "full") } : {}),
  };

  return (
    <PageContainer className="grid gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. Fotoğraf galerisi */}
      <PhotoGallery photos={work.photos} workName={name} typeSlug={work.type_slug} />

      {/* 2. Ad + tür + il/ilçe + rozetler + özet + pilot eylemleri */}
      <header className="grid gap-4 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={href(lang, `/il/${work.city_slug}`)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center font-heading font-bold text-link underline"
          >
            {cityName}
          </Link>
          {work.district ? (
            <>
              <span aria-hidden>·</span>
              <span>{work.district}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <Link
            href={href(lang, `/eserler?il=${work.city_slug}&tur=${work.type_slug}`)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center font-heading font-bold text-link underline"
          >
            {typeName}
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{name}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <PrecisionBadge precision={work.location_precision} lang={lang} />
          {work.unesco ? <Badge variant="secondary">{t(lang, "works.unesco")}</Badge> : null}
          {work.condition !== "unknown" ? (
            <Badge
              variant={
                work.condition === "damaged" || work.condition === "destroyed"
                  ? "destructive"
                  : "outline"
              }
            >
              {t(lang, CONDITION_KEYS[work.condition])}
            </Badge>
          ) : null}
          {bookAttribution ? <Badge variant="outline">{bookAttribution}</Badge> : null}
        </div>

        {summary ? (
          <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">{summary}</p>
        ) : null}

        {isPilot ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild>
              <Link href={href(lang, `/rota?hedef=${work.slug}`)}>
                <RouteIcon aria-hidden />
                <span>{t(lang, "works.detail.planRoute")}</span>
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={href(lang, `/bildirim?eser=${work.slug}`)}>
                <AlertTriangleIcon aria-hidden />
                <span>{t(lang, "works.detail.reportIssue")}</span>
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      {/* Ses kaydı (varsa) */}
      {audioPath ? (
        <section
          aria-labelledby="eser-ses-heading"
          className="grid gap-3 rounded-2xl border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <Volume2Icon className="size-5 text-primary" aria-hidden />
            <h2 id="eser-ses-heading" className="font-heading text-lg font-bold">
              {t(lang, "works.detail.audioTitle")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">{t(lang, "works.detail.audioDesc")}</p>
          <audio
            controls
            preload="none"
            src={`${AUDIO_BASE}${audioPath}`}
            aria-label={`${name} — ${t(lang, "works.detail.audioTitle")}`}
            className="w-full"
          />
        </section>
      ) : null}

      {/* Ana içerik ve künye yan yana */}
      <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="grid gap-10">
          {/* Tarihçe */}
          <section aria-labelledby="eser-tarihce-heading" className="grid gap-3">
            <SectionTitle id="eser-tarihce-heading" className="mb-0">
              {t(lang, "works.detail.historyTitle")}
            </SectionTitle>
            {history ? (
              <ReadMore
                text={history}
                headingId="eser-tarihce-heading"
                contentId="eser-tarihce-icerik"
              />
            ) : (
              <p className="text-base leading-relaxed text-muted-foreground">
                {bookAttribution
                  ? t(lang, "works.detail.historyRef", { ref: bookAttribution })
                  : t(lang, "works.detail.historyInBook")}
              </p>
            )}
            {bookAttribution ? (
              <p className="text-sm font-medium text-muted-foreground">
                {t(lang, "works.detail.bookAttribution", { attribution: bookAttribution })}
              </p>
            ) : null}
          </section>

          {/* Mimari özellikler */}
          {architecture ? (
            <section aria-labelledby="eser-mimari-heading" className="grid gap-3">
              <SectionTitle id="eser-mimari-heading" className="mb-0">
                {t(lang, "works.detail.architectureTitle")}
              </SectionTitle>
              <ReadMore
                text={architecture}
                headingId="eser-mimari-heading"
                contentId="eser-mimari-icerik"
              />
              {bookAttribution ? (
                <p className="text-sm font-medium text-muted-foreground">
                  {t(lang, "works.detail.bookAttribution", { attribution: bookAttribution })}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Mini harita */}
          <section aria-labelledby="eser-harita-heading" className="grid gap-3">
            <SectionTitle id="eser-harita-heading" className="mb-0">
              {t(lang, "works.detail.mapTitle")}
            </SectionTitle>
            {address ? <p className="text-sm text-foreground">{address}</p> : null}
            {hasLocation(work) ? (
              <div className="grid gap-2">
                <SeziMap
                  label={`${name} — ${t(lang, "works.detail.mapTitle")}`}
                  center={[work.lng, work.lat]}
                  zoom={work.location_precision === "exact" ? 16.5 : 15}
                  markers={[
                    {
                      id: work.slug,
                      location: [work.lng, work.lat],
                      label: name,
                      tone: toneForType(work.type_slug),
                      approximate: work.location_precision !== "exact",
                      emphasis: "dest",
                    },
                  ]}
                  className="h-72 w-full"
                />
                {work.location_precision === "approximate" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(lang, "works.detail.mapApproxNote")}
                  </p>
                ) : null}
              </div>
            ) : (
              <div role="note" className="rounded-xl border bg-muted/60 p-4 text-sm text-muted-foreground">
                {t(lang, "works.detail.mapUnverified")}
              </div>
            )}
          </section>
        </div>

        {/* Künye tablosu */}
        <aside aria-labelledby="eser-kunye-heading" className="rounded-2xl border bg-card p-5">
          <h2 id="eser-kunye-heading" className="mb-4 font-heading text-xl font-bold">
            {t(lang, "works.detail.infoTitle")}
          </h2>
          <dl className="grid divide-y text-sm">
            {period ? (
              <div className="grid gap-1 py-3">
                <dt className="text-muted-foreground">{t(lang, "works.detail.infoPeriod")}</dt>
                <dd className="font-medium text-foreground">{period}</dd>
              </div>
            ) : null}
            {work.built_year !== null ? (
              <div className="grid gap-1 py-3">
                <dt className="text-muted-foreground">{t(lang, "works.detail.infoBuiltYear")}</dt>
                <dd className="font-medium text-foreground num">{work.built_year}</dd>
              </div>
            ) : null}
            {work.founder ? (
              <div className="grid gap-1 py-3">
                <dt className="text-muted-foreground">{t(lang, "works.detail.infoFounder")}</dt>
                <dd className="font-medium text-foreground">{work.founder}</dd>
              </div>
            ) : null}
            <div className="grid gap-1 py-3">
              <dt className="text-muted-foreground">{t(lang, "works.detail.infoCity")}</dt>
              <dd className="font-medium text-foreground">
                {[work.district, cityName].filter(Boolean).join(", ")}
              </dd>
            </div>
            {address ? (
              <div className="grid gap-1 py-3">
                <dt className="text-muted-foreground">{t(lang, "works.detail.infoAddress")}</dt>
                <dd className="font-medium text-foreground">{address}</dd>
              </div>
            ) : null}
            <div className="grid gap-1 py-3">
              <dt className="text-muted-foreground">{t(lang, "works.detail.infoCondition")}</dt>
              <dd className="grid gap-1 font-medium text-foreground">
                <span>{t(lang, CONDITION_KEYS[work.condition])}</span>
                {conditionNote ? (
                  <span className="text-xs font-normal text-muted-foreground">{conditionNote}</span>
                ) : null}
              </dd>
            </div>
            <div className="grid gap-1 py-3">
              <dt className="text-muted-foreground">{t(lang, "works.detail.infoPrecision")}</dt>
              <dd className="pt-0.5">
                <PrecisionBadge precision={work.location_precision} lang={lang} />
              </dd>
            </div>
            {work.complex_slug && complexName ? (
              <div className="grid gap-1 py-3">
                <dt className="text-muted-foreground">{t(lang, "works.detail.infoComplex")}</dt>
                <dd>
                  <Link
                    href={href(lang, `/kulliye/${work.complex_slug}`)}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center font-heading font-bold text-link underline"
                  >
                    {complexName}
                  </Link>
                </dd>
              </div>
            ) : null}
            {invSection ? (
              <div className="grid gap-1 py-3">
                <dt className="text-muted-foreground">{t(lang, "works.detail.infoBookSection")}</dt>
                <dd className="font-medium text-foreground">{invSection}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>

      {/* Aynı külliyedeki eserler */}
      {work.complex_slug && complexSiblings.length > 0 ? (
        <section aria-labelledby="eser-kulliye-heading" className="grid gap-4 border-t pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle id="eser-kulliye-heading" className="mb-0">
              {t(lang, "works.detail.complexTitle")}
            </SectionTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={href(lang, `/kulliye/${work.complex_slug}`)}>
                <span>
                  {t(lang, "works.detail.complexAllLink", {
                    name: complexName || work.complex_slug,
                  })}
                </span>
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {complexSiblings.slice(0, 6).map((sibling) => (
              <WorkCard key={sibling.slug} work={sibling} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Bağlı sergiler */}
      {work.exhibitions.length > 0 ? (
        <section aria-labelledby="eser-sergiler-heading" className="grid gap-4 border-t pt-8">
          <SectionTitle id="eser-sergiler-heading" className="mb-0">
            {t(lang, "works.detail.exhibitionsTitle")}
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {work.exhibitions.map((exh) => {
              const dates = exh.starts_on
                ? exh.ends_on
                  ? t(lang, "works.exhibitions.dates", {
                      from: formatDate(lang, exh.starts_on),
                      to: formatDate(lang, exh.ends_on),
                    })
                  : t(lang, "works.exhibitions.from", { from: formatDate(lang, exh.starts_on) })
                : "";
              return (
                <Card key={exh.slug}>
                  <CardContent className="flex flex-col justify-between gap-2 p-5">
                    <div className="grid gap-1">
                      <h3 className="font-heading text-lg font-bold">{loc(exh.title, lang)}</h3>
                      <p className="text-sm text-foreground">{loc(exh.venue, lang)}</p>
                      {dates ? <p className="text-xs text-muted-foreground">{dates}</p> : null}
                    </div>
                    <div>
                      <Link
                        href={href(lang, "/sergiler")}
                        className="inline-flex min-h-12 items-center gap-1 font-heading text-sm font-bold text-link underline"
                      >
                        <span>{t(lang, "works.exhibitions.title")}</span>
                        <ArrowRightIcon className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Kaynaklar listesi */}
      <section aria-labelledby="eser-kaynaklar-heading" className="grid gap-4 border-t pt-8">
        <SectionTitle id="eser-kaynaklar-heading" className="mb-0">
          {t(lang, "works.detail.sourcesTitle")}
        </SectionTitle>

        {!inv && otherSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(lang, "works.detail.noSources")}</p>
        ) : (
          <div className="grid gap-3">
            {inv ? (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="grid gap-1">
                    <h3 className="font-heading text-base font-bold">
                      {bookAttribution ?? inv.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {[inv.publisher ?? "Vakıf Katılım", inv.year ? String(inv.year) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {inv.url ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={inv.url} target="_blank" rel="noopener noreferrer">
                        <span>{t(lang, "works.detail.openBookPdf")}</span>
                        <ExternalLinkIcon aria-hidden />
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {otherSources.map((src) => (
              <Card key={src.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="grid gap-1">
                    <h3 className="font-heading text-base font-bold">{src.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[src.publisher, src.year ? String(src.year) : null, src.page ? `s. ${src.page}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {src.url ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={src.url} target="_blank" rel="noopener noreferrer">
                        <span>{t(lang, "works.detail.openSourceUrl")}</span>
                        <ExternalLinkIcon aria-hidden />
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
