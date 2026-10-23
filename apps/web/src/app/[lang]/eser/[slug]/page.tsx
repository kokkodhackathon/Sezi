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

import { SeziMap } from "@/components/map";
import { PageContainer } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <PageContainer className="grid max-w-4xl gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. Büyük tepe fotoğrafı / karo */}
      <PhotoGallery photos={work.photos} workName={name} typeSlug={work.type_slug} />

      {/* 2. Ad + tek satırda tür, il/ilçe + birincil eylemler */}
      <header className="grid gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{name}</h1>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={href(lang, `/?tur=${work.type_slug}`)}
            className="font-medium text-foreground hover:underline"
          >
            {typeName}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href={href(lang, `/il/${work.city_slug}`)}
            className="font-medium text-foreground hover:underline"
          >
            {[work.district, cityName].filter(Boolean).join(", ")}
          </Link>
          <span aria-hidden>·</span>
          <PrecisionBadge precision={work.location_precision} lang={lang} />
          {work.unesco ? <Badge variant="secondary">{t(lang, "works.unesco")}</Badge> : null}
        </div>

        {/* Birincil eylemler: yalnız iki düğme */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {isPilot ? (
            <Button asChild>
              <Link href={href(lang, `/rota?hedef=${work.slug}`)}>
                <RouteIcon aria-hidden />
                <span>{t(lang, "works.detail.planRoute")}</span>
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href={href(lang, `/bildirim?eser=${work.slug}`)}>
              <AlertTriangleIcon aria-hidden />
              <span>{t(lang, "works.detail.reportIssue")}</span>
            </Link>
          </Button>
        </div>

        {summary ? (
          <p className="pt-2 text-lg leading-relaxed text-foreground/90">{summary}</p>
        ) : null}
      </header>

      {/* Ses kaydı (varsa) */}
      {audioPath ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <Volume2Icon className="size-5 shrink-0 text-primary" aria-hidden />
          <audio
            controls
            preload="none"
            src={`${AUDIO_BASE}${audioPath}`}
            aria-label={`${name} — ${t(lang, "works.detail.audioTitle")}`}
            className="h-10 w-full"
          />
        </div>
      ) : null}

      {/* 3. Tarihçe ve Mimari (ReadMore) */}
      {history ? (
        <section aria-labelledby="eser-tarihce-heading" className="grid gap-2 border-t pt-6">
          <h2 id="eser-tarihce-heading" className="font-heading text-lg font-bold">
            {t(lang, "works.detail.historyTitle")}
          </h2>
          <ReadMore
            text={history}
            headingId="eser-tarihce-heading"
            contentId="eser-tarihce-icerik"
          />
          {bookAttribution ? (
            <p className="text-xs text-muted-foreground">
              {t(lang, "works.detail.bookAttribution", { attribution: bookAttribution })}
            </p>
          ) : null}
        </section>
      ) : null}

      {architecture ? (
        <section aria-labelledby="eser-mimari-heading" className="grid gap-2 border-t pt-6">
          <h2 id="eser-mimari-heading" className="font-heading text-lg font-bold">
            {t(lang, "works.detail.architectureTitle")}
          </h2>
          <ReadMore
            text={architecture}
            headingId="eser-mimari-heading"
            contentId="eser-mimari-icerik"
          />
          {bookAttribution ? (
            <p className="text-xs text-muted-foreground">
              {t(lang, "works.detail.bookAttribution", { attribution: bookAttribution })}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 4. Kompakt künye listesi: yalnız dolu alanlar */}
      <section aria-label={t(lang, "works.detail.infoTitle")} className="border-t pt-6">
        <h2 className="mb-3 font-heading text-lg font-bold">{t(lang, "works.detail.infoTitle")}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 text-sm">
          {period ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoPeriod")}</dt>
              <dd className="font-medium text-foreground">{period}</dd>
            </div>
          ) : null}
          {work.built_year !== null ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoBuiltYear")}</dt>
              <dd className="font-medium text-foreground num">{work.built_year}</dd>
            </div>
          ) : null}
          {work.founder ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoFounder")}</dt>
              <dd className="font-medium text-foreground">{work.founder}</dd>
            </div>
          ) : null}
          {address ? (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoAddress")}</dt>
              <dd className="font-medium text-foreground">{address}</dd>
            </div>
          ) : null}
          {work.condition !== "unknown" ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoCondition")}</dt>
              <dd className="font-medium text-foreground">
                {t(lang, CONDITION_KEYS[work.condition])}
                {conditionNote ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {conditionNote}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {work.complex_slug && complexName ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoComplex")}</dt>
              <dd>
                <Link
                  href={href(lang, `/kulliye/${work.complex_slug}`)}
                  className="font-medium text-link hover:underline"
                >
                  {complexName}
                </Link>
              </dd>
            </div>
          ) : null}
          {invSection ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t(lang, "works.detail.infoBookSection")}</dt>
              <dd className="font-medium text-foreground">{invSection}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* 5. Mini harita */}
      {hasLocation(work) ? (
        <section aria-labelledby="eser-harita-heading" className="grid gap-2 border-t pt-6">
          <h2 id="eser-harita-heading" className="font-heading text-lg font-bold">
            {t(lang, "works.detail.mapTitle")}
          </h2>
          <SeziMap
            label={`${name} — ${t(lang, "works.detail.mapTitle")}`}
            center={[work.lng, work.lat]}
            zoom={work.location_precision === "exact" ? 16.5 : 15}
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
            className="h-64 w-full"
          />
        </section>
      ) : null}

      {/* 6. Aynı külliyedeki eserler */}
      {work.complex_slug && complexSiblings.length > 0 ? (
        <section aria-labelledby="eser-kulliye-heading" className="grid gap-4 border-t pt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 id="eser-kulliye-heading" className="font-heading text-lg font-bold">
              {t(lang, "works.detail.complexTitle")}
            </h2>
            <Link
              href={href(lang, `/kulliye/${work.complex_slug}`)}
              className="text-xs font-bold text-link hover:underline"
            >
              {t(lang, "works.detail.complexAllLink", {
                name: complexName || work.complex_slug,
              })}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {complexSiblings.slice(0, 3).map((sibling) => (
              <WorkCard key={sibling.slug} work={sibling} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Kaynaklar: details içinde katlanmış */}
      <details className="group rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-heading font-bold text-foreground hover:text-link">
          {t(lang, "works.detail.sourcesTitle")}
        </summary>
        <div className="mt-3 grid gap-2.5 pt-2 text-muted-foreground">
          {inv ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{bookAttribution ?? inv.title}</span>
              {inv.url ? (
                <a
                  href={inv.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-link underline"
                >
                  <span>{t(lang, "works.detail.openBookPdf")}</span>
                  <ExternalLinkIcon className="size-3" aria-hidden />
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
                  className="inline-flex items-center gap-1 text-xs text-link underline"
                >
                  <span>{t(lang, "works.detail.openSourceUrl")}</span>
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </details>
    </PageContainer>
  );
}
