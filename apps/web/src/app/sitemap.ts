import type { MetadataRoute } from "next";

import { getCities, getTours, getWorkIndex } from "@/lib/data";
import { LANGS } from "@/lib/i18n";

export const revalidate = 600;

const STATIC_PATHS = [
  "",
  "/rota",
  "/turlar",
  "/sergiler",
  "/hakkinda",
  "/bildirim",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sezi.info").replace(/\/$/, "");
  const [works, cities, tours] = await Promise.all([getWorkIndex(), getCities(), getTours()]);

  const complexSlugs = new Set<string>();
  for (const w of works) {
    if (w.complex_slug) complexSlugs.add(w.complex_slug);
  }

  const allPaths = [
    ...STATIC_PATHS,
    ...tours.map((tour) => `/turlar/${tour.slug}`),
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
