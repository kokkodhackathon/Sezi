import { loc, TOURS, type CityRow } from "@sezi/shared";
import { ArrowRightIcon, CompassIcon, MapPinIcon, RouteIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer, SectionTitle } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkCard } from "@/components/works/work-card";
import { getCities, getWorkIndex } from "@/lib/data";
import { formatNumber, href, isLang, t, type MessageKey } from "@/lib/i18n";

export const revalidate = 600;

const TOUR_KEYS: Record<string, { title: MessageKey; body: MessageKey }> = {
  tum: { title: "works.home.tour.tum.title", body: "works.home.tour.tum.body" },
  hanlar: { title: "works.home.tour.hanlar.title", body: "works.home.tour.hanlar.body" },
  camiler: { title: "works.home.tour.camiler.title", body: "works.home.tour.camiler.body" },
  su: { title: "works.home.tour.su.title", body: "works.home.tour.su.body" },
};

function cityStatusKey(status: CityRow["inventory_status"]): MessageKey {
  switch (status) {
    case "published":
      return "works.city.status.published";
    case "printing":
      return "works.city.status.printing";
    case "in_progress":
      return "works.city.status.in_progress";
    default:
      return "works.city.status.planned";
  }
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const [works, cities] = await Promise.all([getWorkIndex(), getCities()]);
  const worksWithPhotos = works.filter((w) => w.photos.length > 0);
  const featured = [...worksWithPhotos]
    .sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), "tr"))
    .slice(0, 8);

  const countByCity = new Map<string, number>();
  for (const w of works) {
    countByCity.set(w.city_slug, (countByCity.get(w.city_slug) ?? 0) + 1);
  }

  return (
    <PageContainer className="grid gap-14">
      {/* Kahraman bölümü */}
      <section className="rounded-2xl border bg-card p-6 sm:p-10">
        <div className="grid max-w-3xl gap-4">
          <p className="font-heading text-sm font-bold text-link">{t(lang, "works.home.eyebrow")}</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {t(lang, "works.home.title")}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{t(lang, "works.home.lynch")}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button size="lg" asChild>
              <Link href={href(lang, "/eserler")}>
                <CompassIcon aria-hidden />
                <span>{t(lang, "works.home.ctaExplore")}</span>
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={href(lang, "/rota")}>
                <RouteIcon aria-hidden />
                <span>{t(lang, "works.home.ctaRoute")}</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Sayılar */}
        <dl
          aria-label={t(lang, "works.home.statsTitle")}
          className="mt-8 grid gap-4 border-t pt-6 sm:grid-cols-3"
        >
          <div className="rounded-xl bg-muted/60 p-4">
            <dt className="text-sm font-medium text-muted-foreground">{t(lang, "works.home.statWorks")}</dt>
            <dd className="mt-1 font-heading text-3xl font-extrabold num">
              {formatNumber(lang, works.length)}
            </dd>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <dt className="text-sm font-medium text-muted-foreground">{t(lang, "works.home.statPhotos")}</dt>
            <dd className="mt-1 font-heading text-3xl font-extrabold num">
              {formatNumber(lang, worksWithPhotos.length)}
            </dd>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <dt className="text-sm font-medium text-muted-foreground">{t(lang, "works.home.statCities")}</dt>
            <dd className="mt-1 font-heading text-3xl font-extrabold num">
              {formatNumber(lang, cities.length)}
            </dd>
          </div>
        </dl>
      </section>

      {/* İl kartları */}
      <section aria-labelledby="home-cities-heading" className="grid gap-4">
        <div>
          <SectionTitle id="home-cities-heading" className="mb-1">
            {t(lang, "works.home.citiesTitle")}
          </SectionTitle>
          <p className="text-muted-foreground">{t(lang, "works.home.citiesLead")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cities.map((city) => {
            const cityName = loc(city.name, lang);
            const verifiedCount = countByCity.get(city.slug) ?? 0;
            const statusVariant =
              city.inventory_status === "published"
                ? "success"
                : city.inventory_status === "printing"
                  ? "secondary"
                  : "outline";
            return (
              <Card key={city.id} className="group transition-colors hover:border-primary/50">
                <Link
                  href={href(lang, `/il/${city.slug}`)}
                  className="flex h-full min-h-12 flex-col justify-between outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-heading text-xl font-bold group-hover:text-link group-hover:underline">
                        {cityName}
                      </CardTitle>
                      <Badge variant={statusVariant}>{t(lang, cityStatusKey(city.inventory_status))}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between border-t pt-2">
                      <span>{t(lang, "works.city.statYear")}</span>
                      <span className="font-semibold text-foreground num">
                        {city.inventory_year ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t(lang, "works.city.statInventoryWorks")}</span>
                      <span className="font-semibold text-foreground num">
                        {city.inventory_works !== null ? formatNumber(lang, city.inventory_works) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t(lang, "works.city.statVerifiedWorks")}</span>
                      <span className="font-semibold text-foreground num">
                        {formatNumber(lang, verifiedCount)}
                      </span>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Öne çıkan eserler: fotoğraflı ilk 8 eser, ada göre sıralı */}
      <section aria-labelledby="home-featured-heading" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionTitle id="home-featured-heading" className="mb-1">
              {t(lang, "works.home.featuredTitle")}
            </SectionTitle>
            <p className="text-muted-foreground">{t(lang, "works.home.featuredLead")}</p>
          </div>
          <Button variant="outline" asChild>
            <Link href={href(lang, "/eserler")}>
              <span>{t(lang, "works.home.allWorksLink")}</span>
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((work, i) => (
            <WorkCard key={work.slug} work={work} lang={lang} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Pilot alan bölümü: turların listesi ve /turlar bağlantısı */}
      <section
        aria-labelledby="home-pilot-heading"
        className="grid gap-6 rounded-2xl border bg-card p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid max-w-2xl gap-1.5">
            <p className="font-heading text-sm font-bold text-link">
              {t(lang, "works.home.pilotEyebrow")}
            </p>
            <SectionTitle id="home-pilot-heading" className="mb-0">
              {t(lang, "works.home.pilotTitle")}
            </SectionTitle>
            <p className="text-muted-foreground">{t(lang, "works.home.pilotLead")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={href(lang, "/turlar")}>
                <span>{t(lang, "works.home.pilotCtaTours")}</span>
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={href(lang, "/rota")}>
                <MapPinIcon aria-hidden />
                <span>{t(lang, "works.home.pilotCtaRoute")}</span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOURS.map((tour) => {
            const keys = TOUR_KEYS[tour.id];
            if (!keys) return null;
            return (
              <Card key={tour.id} className="group transition-colors hover:border-primary/50">
                <Link
                  href={href(lang, `/turlar/${tour.id}`)}
                  className="flex h-full min-h-12 flex-col justify-between p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <div className="grid gap-2">
                    <h3 className="font-heading text-lg font-bold group-hover:text-link group-hover:underline">
                      {t(lang, keys.title)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(lang, keys.body)}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 font-heading text-sm font-bold text-link">
                    <span>{t(lang, "works.home.pilotCtaTours")}</span>
                    <ArrowRightIcon className="size-4" aria-hidden />
                  </span>
                </Link>
              </Card>
            );
          })}
        </div>
      </section>
    </PageContainer>
  );
}
