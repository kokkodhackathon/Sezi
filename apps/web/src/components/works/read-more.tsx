"use client";

import { excerpt } from "@sezi/shared";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-client";

/** Bundan kısa metin kırpılmaz (mobil ReadMore ile aynı eşik). */
const SHORT = 600;
/** Kapalı hâlin uzunluğu: ilk paragraflar, son tam cümlede kesilir. */
const PREVIEW = 360;
/** Okuma hızı (karakter/dk): ~200 sözcük × ~7 harf. */
const CHARS_PER_MIN = 1300;

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * Uzun metin bileşeni (Tarihçe ve Mimari): 600 karakterden uzunsa `excerpt(text, 360)` ile kısaltır,
 * "Devamını oku · N dk" düğmesiyle tamamını açar, "Kısalt" ile kapatıp bölüm başlığına kaydırır.
 */
export function ReadMore({
  text,
  headingId,
  contentId,
}: {
  text: string;
  headingId: string;
  contentId: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const long = text.length > SHORT;
  const shown = !long || open ? splitParagraphs(text) : [excerpt(text, PREVIEW)];
  const minutes = Math.max(1, Math.round(text.length / CHARS_PER_MIN));

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      const heading = document.getElementById(headingId);
      heading?.scrollIntoView({ block: "start" });
    } else {
      setOpen(true);
    }
  };

  return (
    <div className="grid gap-3">
      <div id={contentId} className="grid gap-3 text-base leading-relaxed text-foreground">
        {shown.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {long ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={handleToggle}
          >
            <span>{open ? t("works.detail.readLess") : t("works.detail.readMore", { n: minutes })}</span>
            {open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
