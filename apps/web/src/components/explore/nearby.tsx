"use client";

import { coverOf, distanceM, formatDistance, loc, type LngLat } from "@sezi/shared";
import { LoaderCircleIcon, LocateFixedIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CardCarousel } from "@/components/card-carousel";
import { Button } from "@/components/ui/button";
import { WorkThumb } from "@/components/work-thumb";
import type { ExploreItem } from "@/lib/explore";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

const COUNT = 12;

type State = { kind: "idle" } | { kind: "locating" } | { kind: "ready"; at: LngLat } | { kind: "denied" } | { kind: "error" };

/**
 * "Yakınınızda": tarayıcı konumuna en yakın eserler, yana kayan kartlarla. Konum yalnız istenince alınır
 * (izin daha önce verildiyse sayfa açılınca); sunucuya gitmez, saklanmaz. Uzaklık her kartta yazılı.
 */
export function Nearby({ items }: { items: ExploreItem[] }) {
  const { t, lang } = useT();
  const [state, setState] = useState<State>({ kind: "idle" });

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setState({ kind: "error" });
      return;
    }
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ kind: "ready", at: [p.coords.longitude, p.coords.latitude] }),
      (e) => setState({ kind: e.code === e.PERMISSION_DENIED ? "denied" : "error" }),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  };

  // İzin önceden verildiyse sormadan konum alınır; verilmediyse kullanıcı düğmeye basana kadar beklenir.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        if (!cancelled && s.state === "granted") locate();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const nearest = useMemo(() => {
    if (state.kind !== "ready") return [];
    return items
      .flatMap((w) => (w.lng !== null && w.lat !== null ? [{ work: w, m: distanceM(state.at, [w.lng, w.lat]) }] : []))
      .sort((a, b) => a.m - b.m)
      .slice(0, COUNT);
  }, [items, state]);

  return (
    <section aria-labelledby="nearby-title" className="grid min-w-0 content-start gap-3">
      <h2 id="nearby-title" className="font-heading text-xl font-extrabold">
        {t("home.nearTitle")}
      </h2>

      {state.kind === "ready" && nearest.length > 0 ? (
        <CardCarousel label={t("home.nearTitle")} itemClassName="w-44 sm:w-52">
          {nearest.map(({ work, m }) => {
            const name = loc(work.name, lang);
            const cover = coverOf(work);
            return (
              <Link key={work.slug} href={href(lang, `/eser/${work.slug}`)} className="group grid gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
                <WorkThumb photo={cover} typeSlug={work.type_slug} alt={cover ? loc(cover.alt, lang) || name : ""} sizes="208px" className="aspect-[4/3] w-full rounded-lg contrast:outline-2 contrast:outline-border" sourceTag />
                <span className="grid gap-0.5 px-0.5">
                  <span className="line-clamp-2 font-heading text-sm font-bold leading-snug group-hover:underline">{name}</span>
                  <span className="num text-sm text-muted-foreground">{t("home.nearDistance", { d: formatDistance(m, lang) })}</span>
                </span>
              </Link>
            );
          })}
        </CardCarousel>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg bg-secondary p-5">
          <LocateFixedIcon className="size-6 shrink-0 text-link" aria-hidden />
          <p className="min-w-48 flex-1 text-sm" role={state.kind === "denied" || state.kind === "error" ? "alert" : undefined}>
            {state.kind === "denied" ? t("home.nearDenied") : state.kind === "error" ? t("home.nearError") : t("home.nearPrompt")}
          </p>
          <Button type="button" onClick={locate} disabled={state.kind === "locating"}>
            {state.kind === "locating" ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <LocateFixedIcon aria-hidden />}
            {state.kind === "locating" ? t("home.nearLocating") : t("home.nearUse")}
          </Button>
        </div>
      )}
    </section>
  );
}
