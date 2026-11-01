import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { isLang, t, type MessageKey } from "@/lib/i18n";

export const revalidate = 600;

const TEAM_MEMBERS: { name: string; roleKey: MessageKey }[] = [
  { name: "Ediz", roleKey: "about.team.ediz.role" },
  { name: "Eda", roleKey: "about.team.eda.role" },
  { name: "İnci", roleKey: "about.team.inci.role" },
  { name: "Sıla", roleKey: "about.team.sila.role" },
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

  return (
    <PageContainer className="grid max-w-3xl gap-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t(lang, "about.title")}</h1>
      </header>

      {/* 1. Amaç ve Lynch Yaklaşımı */}
      <section aria-labelledby="about-lynch-heading" className="grid gap-2">
        <h2 id="about-lynch-heading" className="font-heading text-lg font-bold text-foreground">
          {t(lang, "about.lynch.title")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(lang, "about.lynch.p1")}</p>
      </section>

      {/* 2. Erişilebilirlik */}
      <section aria-labelledby="about-a11y-heading" className="grid gap-2 border-t pt-6">
        <h2 id="about-a11y-heading" className="font-heading text-lg font-bold text-foreground">
          {t(lang, "about.a11y.title")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(lang, "about.a11y.p1")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(lang, "about.a11y.wcag")}</p>
      </section>

      {/* 3. Ekip & Hackathon */}
      <section aria-labelledby="about-team-heading" className="grid gap-3 border-t pt-6">
        <h2 id="about-team-heading" className="font-heading text-lg font-bold text-foreground">
          {t(lang, "about.team.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          Takım LAHMACUN · 42 Türkiye x Vakıf Katılım KÖK&KOD Hackathon
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {TEAM_MEMBERS.map((member) => (
            <span
              key={member.name}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold text-foreground"
            >
              <span>{member.name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{t(lang, member.roleKey)}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 4. Telif ve Veri Politikası (tek satır) */}
      <section aria-labelledby="about-copyright-heading" className="grid gap-2 border-t pt-6">
        <h2 id="about-copyright-heading" className="font-heading text-lg font-bold text-foreground">
          {t(lang, "about.copyright.title")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(lang, "about.copyright.p1")} {t(lang, "about.copyright.p2")}
        </p>
      </section>

      {/* 5. Kaynaklar Listesi */}
      <section aria-labelledby="about-sources-heading" className="grid gap-3 border-t pt-6">
        <h2 id="about-sources-heading" className="font-heading text-lg font-bold text-foreground">
          {t(lang, "about.sources.title")}
        </h2>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li className="rounded-lg border bg-card p-3">
            <strong className="text-foreground">{t(lang, "about.sources.vakifTitle")}:</strong>{" "}
            {t(lang, "about.sources.vakifBody")}
          </li>
          <li className="rounded-lg border bg-card p-3">
            <strong className="text-foreground">{t(lang, "about.sources.wikidataTitle")}:</strong>{" "}
            {t(lang, "about.sources.wikidataBody")}
          </li>
          <li className="rounded-lg border bg-card p-3">
            <strong className="text-foreground">{t(lang, "about.sources.osmTitle")}:</strong>{" "}
            {t(lang, "about.sources.osmBody")}
          </li>
          <li className="rounded-lg border bg-card p-3">
            <strong className="text-foreground">{t(lang, "about.sources.mapboxTitle")}:</strong>{" "}
            {t(lang, "about.sources.mapboxBody")}
          </li>
        </ul>
      </section>
    </PageContainer>
  );
}
