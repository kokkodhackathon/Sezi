import { loc } from "@sezi/shared";
import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer, PageIntro, SectionTitle } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCities, getInventoryBooks } from "@/lib/data";
import { formatNumber, href, isLang, t, type MessageKey } from "@/lib/i18n";

export const revalidate = 600;

const TEAM_MEMBERS: { name: string; roleKey: MessageKey }[] = [
  { name: "Ediz", roleKey: "about.team.ediz.role" },
  { name: "Eda", roleKey: "about.team.eda.role" },
  { name: "İnci", roleKey: "about.team.inci.role" },
  { name: "Zehra", roleKey: "about.team.zehra.role" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: t(lang, "about.title"),
    description: t(lang, "about.lead"),
    alternates: {
      languages: {
        tr: "/tr/hakkinda",
        en: "/en/hakkinda",
      },
    },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const [cities, books] = await Promise.all([getCities(), getInventoryBooks()]);
  const cityById = new Map(cities.map((c) => [c.id, c]));

  return (
    <PageContainer className="grid gap-12">
      <PageIntro
        eyebrow={t(lang, "about.eyebrow")}
        title={t(lang, "about.title")}
        lead={t(lang, "about.lead")}
      />

      {/* 1. Proje amacı ve Kevin Lynch yaklaşımı */}
      <section aria-labelledby="about-lynch-heading" className="grid gap-4 rounded-2xl border bg-card p-6 sm:p-8">
        <SectionTitle id="about-lynch-heading" className="mb-0">
          {t(lang, "about.lynch.title")}
        </SectionTitle>
        <p className="max-w-4xl text-base leading-relaxed text-foreground">
          {t(lang, "about.lynch.p1")}
        </p>
        <p className="max-w-4xl text-base leading-relaxed text-muted-foreground">
          {t(lang, "about.lynch.p2")}
        </p>
      </section>

      {/* 2. Erişilebilirlik yaklaşımı */}
      <section aria-labelledby="about-a11y-heading" className="grid gap-4 rounded-2xl border bg-card p-6 sm:p-8">
        <SectionTitle id="about-a11y-heading" className="mb-0">
          {t(lang, "about.a11y.title")}
        </SectionTitle>
        <p className="max-w-4xl text-base leading-relaxed text-foreground">
          {t(lang, "about.a11y.p1")}
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border bg-background p-4 text-sm leading-relaxed text-foreground">
            {t(lang, "about.a11y.wheelchair")}
          </li>
          <li className="rounded-xl border bg-background p-4 text-sm leading-relaxed text-foreground">
            {t(lang, "about.a11y.blind")}
          </li>
          <li className="rounded-xl border bg-background p-4 text-sm leading-relaxed text-foreground">
            {t(lang, "about.a11y.deaf")}
          </li>
        </ul>
        <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">
          {t(lang, "about.a11y.wcag")}
        </p>
      </section>

      {/* 3. Ekip: LAHMACUN & 4. Hackathon */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="about-team-heading" className="grid content-start gap-4 rounded-2xl border bg-card p-6 sm:p-8">
          <SectionTitle id="about-team-heading" className="mb-0">
            {t(lang, "about.team.title")}
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TEAM_MEMBERS.map((member) => (
              <li
                key={member.name}
                className="flex items-center justify-between rounded-xl border bg-background px-4 py-3"
              >
                <span className="font-heading text-base font-bold text-foreground">
                  {member.name}
                </span>
                <Badge variant="secondary">{t(lang, member.roleKey)}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="about-hackathon-heading" className="grid content-start gap-4 rounded-2xl border bg-card p-6 sm:p-8">
          <SectionTitle id="about-hackathon-heading" className="mb-0">
            {t(lang, "about.hackathon.title")}
          </SectionTitle>
          <p className="text-base leading-relaxed text-muted-foreground">
            {t(lang, "about.hackathon.body")}
          </p>
        </section>
      </div>

      {/* 5. Veri politikası ve telif */}
      <section aria-labelledby="about-copyright-heading" className="grid gap-3 rounded-2xl border bg-card p-6 sm:p-8">
        <SectionTitle id="about-copyright-heading" className="mb-0">
          {t(lang, "about.copyright.title")}
        </SectionTitle>
        <p className="max-w-4xl text-base leading-relaxed text-foreground">
          {t(lang, "about.copyright.p1")}
        </p>
        <p className="max-w-4xl text-base leading-relaxed text-muted-foreground">
          {t(lang, "about.copyright.p2")}
        </p>
      </section>

      {/* 6. Kaynaklar: Envanter kitapları, iller, Wikidata, OSM, Mapbox */}
      <section aria-labelledby="about-sources-heading" className="grid gap-8">
        <SectionTitle id="about-sources-heading" className="mb-0">
          {t(lang, "about.sources.title")}
        </SectionTitle>

        {/* Envanter illeri */}
        {cities.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="font-heading text-lg font-bold">{t(lang, "about.sources.citiesTitle")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cities.map((city) => (
                <Card key={city.id}>
                  <CardContent className="grid gap-1.5 p-4">
                    <Link
                      href={href(lang, `/il/${city.slug}`)}
                      className="inline-flex min-h-12 items-center font-heading text-base font-bold text-link underline"
                    >
                      {loc(city.name, lang)}
                    </Link>
                    <p className="text-xs text-muted-foreground num">
                      {[
                        city.inventory_year ? String(city.inventory_year) : null,
                        city.inventory_works !== null
                          ? `${formatNumber(lang, city.inventory_works)} ${t(lang, "works.city.statInventoryWorks").toLocaleLowerCase(lang)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {/* Envanter kitapları */}
        {books.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="font-heading text-lg font-bold">{t(lang, "about.sources.booksTitle")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => {
                const city = book.city_id ? cityById.get(book.city_id) : undefined;
                return (
                  <Card key={book.id}>
                    <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2">
                          <BookOpenIcon className="size-4 text-primary" aria-hidden />
                          <h4 className="font-heading text-base font-bold">{book.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[
                            city ? loc(city.name, lang) : null,
                            book.volume !== null
                              ? t(lang, "about.sources.volume", { v: book.volume })
                              : null,
                            book.year ? String(book.year) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {book.url ? (
                        <div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={book.url} target="_blank" rel="noopener noreferrer">
                              <span>{t(lang, "about.sources.openBook")}</span>
                              <ExternalLinkIcon aria-hidden />
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Diğer kaynaklar */}
        <div className="grid gap-3">
          <h3 className="font-heading text-lg font-bold">{t(lang, "about.sources.otherTitle")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold">
                  {t(lang, "about.sources.vakifTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(lang, "about.sources.vakifBody")}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold">
                  {t(lang, "about.sources.wikidataTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(lang, "about.sources.wikidataBody")}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold">
                  {t(lang, "about.sources.osmTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(lang, "about.sources.osmBody")}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold">
                  {t(lang, "about.sources.mapboxTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(lang, "about.sources.mapboxBody")}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
