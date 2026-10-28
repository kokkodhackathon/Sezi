import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "../globals.css";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTRAST_KEY_NAME, TEXT_KEY_NAME } from "@/lib/appearance-keys";
import { isLang, LANGS, t } from "@/lib/i18n";
import { themeCss } from "@/lib/theme";

// Yazı tipleri önceden çekilmez: kapak fotoğrafı ilk bağlantıları paylaşmasın. `swap` yedek yazıyla boyar.
const heading = Nunito({ subsets: ["latin", "latin-ext"], weight: ["700", "800"], variable: "--font-nunito", display: "swap", preload: false });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin", "latin-ext"], weight: ["400", "600", "700"], variable: "--font-atkinson", display: "swap", preload: false });

// İlk boyamadan önce görünüm tercihi <html>'e yazılır (yüksek kontrast / yazı boyutu yanıp sönmez).
const APPEARANCE_SCRIPT = `try{var d=document.documentElement;if(localStorage.getItem(${JSON.stringify(CONTRAST_KEY_NAME)})==="high")d.dataset.contrast="high";var s=localStorage.getItem(${JSON.stringify(TEXT_KEY_NAME)});if(s==="lg"||s==="xl")d.dataset.text=s;}catch(e){}`;

export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://sezi.info"),
    title: { default: `${t(lang, "site.name")} · ${t(lang, "site.tagline")}`, template: `%s · ${t(lang, "site.name")}` },
    description: t(lang, "site.description"),
    alternates: { languages: { tr: "/tr", en: "/en" } },
    openGraph: { siteName: t(lang, "site.name"), locale: lang === "tr" ? "tr_TR" : "en_GB", type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function LangLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body className="flex min-h-dvh flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Providers lang={lang}>
          <SiteHeader />
          <main id="icerik" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter lang={lang} />
        </Providers>
      </body>
    </html>
  );
}
