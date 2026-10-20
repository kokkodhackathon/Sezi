"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-client";

/** Sunucu verisi alınamadı: dil uygun ileti ve yeniden deneme. ISR'da son başarılı sayfa sunulmaya devam eder. */
export default function LangError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useT();
  return (
    <section className="mx-auto grid max-w-xl gap-4 px-4 py-20 text-center" role="alert">
      <h1 className="text-3xl font-extrabold">{t("error.title")}</h1>
      <p className="text-muted-foreground">{t("error.body")}</p>
      <div>
        <Button onClick={reset}>{t("common.retry")}</Button>
      </div>
    </section>
  );
}
