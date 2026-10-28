import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Nunito } from "next/font/google";

import { NotFoundScreen } from "@/components/not-found-screen";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { themeCss } from "@/lib/theme";

import "./globals.css";

// Yazı tipleri önceden çekilmez: kapak fotoğrafı ilk bağlantıları paylaşmasın.
const heading = Nunito({ subsets: ["latin", "latin-ext"], weight: ["700", "800"], variable: "--font-nunito", display: "swap", preload: false });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin", "latin-ext"], weight: ["400", "600", "700"], variable: "--font-atkinson", display: "swap", preload: false });

export const metadata: Metadata = { title: "Sayfa bulunamadı · Page not found" };

/**
 * Kök yerleşim yok; bu sayfa yalnızca hiçbir rotaya düşmeyen adresler içindir.
 * `headers()` okunmaz: 404 sınırı dinamik olursa `notFound()` çağıran statik sayfa 500 verir.
 * Dil seçimi proxy'nin `/tr` veya `/en` yeniden yazımı ve `[lang]/not-found` üzerindedir.
 * Buraya düşen istek iki dili birden gösterir.
 */
export default function NotFound() {
  return (
    <html lang="tr" className={`${heading.variable} ${body.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body className="flex min-h-dvh flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Providers lang="tr">
          <SiteHeader />
          <main id="icerik" tabIndex={-1} className="flex-1 outline-none">
            <NotFoundScreen lang="both" />
          </main>
          <SiteFooter lang="tr" />
        </Providers>
      </body>
    </html>
  );
}
