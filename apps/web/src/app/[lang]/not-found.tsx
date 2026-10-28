"use client";

import { NotFoundScreen } from "@/components/not-found-screen";
import { useT } from "@/lib/i18n-client";

/** Yerelleştirilmiş 404. Dil, `[lang]` yerleşimindeki sağlayıcıdan gelir; istek başlığı okunmaz. */
export default function NotFound() {
  const { lang } = useT();
  return <NotFoundScreen lang={lang} />;
}
