import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sezi.info").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/tr/hesap", "/en/hesap", "/hesap"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
