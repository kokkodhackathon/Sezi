import {
  coverOf,
  excerpt,
  hasLocation,
  inventorySource,
  loc,
  type WorkCondition,
  type WorkSource,
} from "@sezi/shared";
import { AlertTriangleIcon, ExternalLinkIcon, RouteIcon, Volume2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LazySeziMap } from "@/components/map";
import { PageContainer } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommunityPhotos } from "@/components/works/community-photos";
import { PhotoGallery } from "@/components/works/photo-gallery";
import { ReadMore } from "@/components/works/read-more";
import { PrecisionBadge, WorkCard } from "@/components/works/work-card";
import { getWork, getWorkIndex } from "@/lib/data";
import { href, isLang, t, type Lang, type MessageKey } from "@/lib/i18n";
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

/** Envanter kitabı atfı: cilt başlıkta yoksa ayrıca yazılır; varsa yinelenmez. */
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
  if (inv.volume !== null && !volumeInTitle) {
    return t(lang, "works.detail.refVolume", { title: inv.title, volume: inv.volume });
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
    ...(cover
      ? {
          openGraph: {
            title: name,
            description,
            images: [
              {
                url: photoUrl(cover, "full"),
                alt: loc(cover.alt, lang) || name,
              },
            ],
          },
        }
      : {}),
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

  // Metin bölümü yoksa (fotoğrafsız/metinsiz eser) sayfa tek sütundur; boş sol sütun bırakılmaz.
  const hasText = Boolean(summary || audioPath || history || architecture);
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
    <PageContainer className="work-detail-page grid gap-8 lg:gap-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PhotoGallery photos={work.photos} workName={name} typeSlug={work.type_slug} />

      <header className="grid gap-4">
        <h1 className="line-clamp-2 max-w-[20ch] text-[clamp(2.25rem,5vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.04em]">
          {name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-foreground [&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:min-h-8 [&_[data-slot=badge]]:text-base">
          <Link
            href={href(lang, `/?tur=${work.type_slug}`)}
            className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
          >
            {typeName}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href={href(lang, `/il/${work.city_slug}`)}
            className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
          >
            {[work.district, cityName].filter(Boolean).join(", ")}
          </Link>
          <PrecisionBadge precision={work.location_precision} lang={lang} />
          {work.unesco ? <Badge variant="secondary" className="h-auto min-h-8 text-base">{t(lang, "works.unesco")}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isPilot ? (
            <Button asChild className="min-h-12">
              <Link href={href(lang, `/rota?hedef=${work.slug}`)}>
                <RouteIcon aria-hidden />
                <span>{t(lang, "works.detail.planRoute")}</span>
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild className="min-h-12">
            <Link href={href(lang, `/bildirim?eser=${work.slug}`)}>
              <AlertTriangleIcon aria-hidden />
              <span>{t(lang, "works.detail.reportIssue")}</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Sayfanın tek <main> öğesi düzende; burada yalnız sütunlar var. Yapışkan sütun yok: uzun yan sütun ekrana sığmayınca alt kısmı erişilmez kalıyordu. */}
      <div
        className={
          hasText
            ? "grid gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)] lg:items-start lg:gap-16"
            : "grid gap-12"
        }
      >
        <div className="grid min-w-0 content-start gap-12 empty:hidden lg:max-w-[65ch] lg:gap-16">
          {summary ? (
            <section aria-labelledby="eser-ozet-heading" className="work-detail-section grid gap-4">
              <h2 id="eser-ozet-heading" className="text-2xl font-bold leading-tight">
                {t(lang, "works.detail.summaryTitle")}
              </h2>
              <p className="text-lg leading-[1.6] text-foreground">{summary}</p>
            </section>
          ) : null}

          {audioPath ? (
            <section aria-labelledby="eser-ses-heading" className="work-detail-section grid gap-4">
              <h2 id="eser-ses-heading" className="text-2xl font-bold leading-tight">
                {t(lang, "works.detail.audioTitle")}
              </h2>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Volume2Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <audio
                  controls
                  preload="none"
                  src={`${AUDIO_BASE}${audioPath}`}
                  aria-label={`${name} — ${t(lang, "works.detail.audioTitle")}`}
                  className="h-12 w-full"
                />
              </div>
            </section>
          ) : null}

          {history ? (
            <section aria-labelledby="eser-tarihce-heading" className="work-detail-section grid gap-4">
              <h2 id="eser-tarihce-heading" className="text-2xl font-bold leading-tight">
                {t(lang, "works.detail.historyTitle")}
              </h2>
              <ReadMore
                text={history}
                headingId="eser-tarihce-heading"
                contentId="eser-tarihce-icerik"
              />
            </section>
          ) : null}

          {architecture ? (
            <section aria-labelledby="eser-mimari-heading" className="work-detail-section grid gap-4">
              <h2 id="eser-mimari-heading" className="text-2xl font-bold leading-tight">
                {t(lang, "works.detail.architectureTitle")}
              </h2>
              <ReadMore
                text={architecture}
                headingId="eser-mimari-heading"
                contentId="eser-mimari-icerik"
              />
            </section>
          ) : null}
          {bookAttribution && (history || architecture) ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(lang, "works.detail.bookAttribution", { attribution: bookAttribution })}
            </p>
          ) : null}
          <CommunityPhotos slug={work.slug} />
        </div>

        {/* Metinsiz eserde künye, harita ve kaynaklar geniş ekranda iki sütuna yayılır; sağda boşluk kalmaz. */}
        <div
          className={
            hasText
              ? "grid min-w-0 content-start gap-12"
              : "grid min-w-0 content-start items-start gap-12 lg:grid-cols-2 lg:gap-16"
          }
        >
          <section aria-labelledby="eser-kunye-heading" className="work-detail-section grid gap-4">
            <h2 id="eser-kunye-heading" className="text-2xl font-bold leading-tight">
              {t(lang, "works.detail.infoTitle")}
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {period ? (
                <div>
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoPeriod")}</dt>
                  <dd className="text-base font-medium text-foreground">{period}</dd>
                </div>
              ) : null}
              {work.built_year !== null ? (
                <div>
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoBuiltYear")}</dt>
                  <dd className="num text-base font-medium text-foreground">{work.built_year}</dd>
                </div>
              ) : null}
              {work.founder ? (
                <div>
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoFounder")}</dt>
                  <dd className="text-base font-medium text-foreground">{work.founder}</dd>
                </div>
              ) : null}
              {address ? (
                <div className="sm:col-span-2 lg:col-span-1">
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoAddress")}</dt>
                  <dd className="text-base font-medium text-foreground">{address}</dd>
                </div>
              ) : null}
              {work.condition !== "unknown" ? (
                <div>
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoCondition")}</dt>
                  <dd className="text-base font-medium text-foreground">
                    {t(lang, CONDITION_KEYS[work.condition])}
                    {conditionNote ? (
                      <span className="block text-sm font-normal text-muted-foreground">
                        {conditionNote}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {work.complex_slug && complexName ? (
                <div>
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoComplex")}</dt>
                  <dd className="text-base font-medium">
                    <Link
                      href={href(lang, `/kulliye/${work.complex_slug}`)}
                      className="text-link underline-offset-4 hover:underline"
                    >
                      {complexName}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {invSection ? (
                <div>
                  <dt className="text-sm text-muted-foreground">{t(lang, "works.detail.infoBookSection")}</dt>
                  <dd className="text-base font-medium text-foreground">{invSection}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {hasLocation(work) ? (
            <section aria-labelledby="eser-harita-heading" className="work-detail-section grid gap-4">
              <h2 id="eser-harita-heading" className="text-2xl font-bold leading-tight">
                {t(lang, "works.detail.mapTitle")}
              </h2>
              <LazySeziMap
                label={`${name} — ${t(lang, "works.detail.mapTitle")}`}
                center={[work.lng, work.lat]}
                zoom={work.location_precision === "exact" ? 16.5 : 15}
                miniMap
                markers={[
                  {
                    id: work.slug,
                    location: [work.lng, work.lat],
                    label: name,
                    typeSlug: work.type_slug,
                    approximate: work.location_precision !== "exact",
                    emphasis: "dest",
                  },
                ]}
                className="mini-map h-64 w-full rounded-lg border"
              />
            </section>
          ) : null}

        {inv || otherSources.length > 0 ? (
          <section aria-labelledby="eser-kaynak-heading" className="work-detail-section grid gap-4">
            <h2 id="eser-kaynak-heading" className="text-2xl font-bold leading-tight">
              {t(lang, "works.detail.sourcesTitle")}
            </h2>
            <div className="grid gap-3 text-base leading-relaxed text-foreground">
              {inv ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{bookAttribution ?? inv.title}</span>
                  {inv.url ? (
                    <a
                      href={inv.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-1 font-semibold text-link underline"
                    >
                      <span>{t(lang, "works.detail.openBookPdf")}</span>
                      <ExternalLinkIcon className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
              ) : null}
              {otherSources.map((src) => (
                <div key={src.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {[
                      src.title,
                      src.publisher,
                      src.year ? String(src.year) : null,
                      src.page ? `s. ${src.page}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-1 font-semibold text-link underline"
                    >
                      <span>{t(lang, "works.detail.openSourceUrl")}</span>
                      <ExternalLinkIcon className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
          {complexName && work.complex_slug && complexSiblings.length > 0 ? (
            <section aria-labelledby="eser-kulliye-heading" className="work-detail-section grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="eser-kulliye-heading" className="text-2xl font-bold leading-tight">
                  {t(lang, "works.detail.complexTitle")}
                </h2>
                <Link
                  href={href(lang, `/kulliye/${work.complex_slug}`)}
                  className="inline-flex min-h-12 items-center text-base font-semibold text-link underline-offset-4 hover:underline"
                >
                  {t(lang, "works.detail.complexAllLink", { name: complexName })}
                </Link>
              </div>
              <div className="grid gap-4">
                {complexSiblings.slice(0, 3).map((sibling) => (
                  <WorkCard key={sibling.slug} work={sibling} lang={lang} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
