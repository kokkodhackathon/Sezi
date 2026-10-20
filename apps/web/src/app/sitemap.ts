import { TOURS } from "@sezi/shared";
import type { MetadataRoute } from "next";

import { getCities, getWorkIndex } from "@/lib/data";
import { LANGS } from "@/lib/i18n";

export const revalidate = 600;

const STATIC_PATHS = [
  "",
  "/eserler",
  "/rota",
  "/turlar",
  "/sergiler",
  "/hakkinda",
  "/bildirim",
  ...TOURS.map((tour) => `/turlar/${tour.id}`),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sezi.info").replace(/\/$/, "");
  const [works, cities] = await Promise.all([getWorkIndex(), getCities()]);

  const complexSlugs = new Set<string>();
  for (const w of works) {
    if (w.complex_slug) complexSlugs.add(w.complex_slug);
  }

  const allPaths = [
    ...STATIC_PATHS,
    ...cities.map((c) => `/il/${c.slug}`),
    ...[...complexSlugs].map((slug) => `/kulliye/${slug}`),
    ...works.map((w) => `/eser/${w.slug}`),
  ];

  const entries: MetadataRoute.Sitemap = [];
  for (const path of allPaths) {
    for (const lang of LANGS) {
      entries.push({
        url: `${base}/${lang}${path}`,
        alternates: {
          languages: {
            tr: `${base}/tr${path}`,
            en: `${base}/en${path}`,
          },
        },
      });
    }
  }
  return entries;
}
