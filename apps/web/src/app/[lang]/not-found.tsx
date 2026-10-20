"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

export default function NotFound() {
  const { t, lang } = useT();
  return (
    <section className="mx-auto grid max-w-xl gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.body")}</p>
      <div>
        <Button asChild>
          <Link href={href(lang)}>{t("notFound.home")}</Link>
        </Button>
      </div>
    </section>
  );
}
