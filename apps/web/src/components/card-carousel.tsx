"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

/**
 * Yana kayan kart şeridi (apple.com kart dizisi gibi): yerel kaydırma + yapışma, telefonda parmakla,
 * masaüstünde ok düğmeleriyle. Kartlar sıradan bağlantılardır; Tab ile gezilince odaklanan kart görünür alana gelir.
 * Ok düğmeleri yalnız o yönde kaydırılacak içerik varsa etkin. Hareket azaltmada kaydırma anlıktır.
 */
export function CardCarousel({ label, children, itemClassName, className }: { label: string; children: ReactNode; itemClassName?: string; className?: string }) {
  const { t } = useT();
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const items = Children.toArray(children);

  return (
    <section aria-label={label} className={cn("grid gap-3", className)}>
      <ul ref={ref} className="-mx-4 -my-2 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((child, i) => (
          <li key={i} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
      {edges.start && edges.end ? null : (
        <div className="hidden justify-end gap-2 sm:flex">
          <Button type="button" variant="outline" size="icon" aria-label={t("carousel.prev")} disabled={edges.start} onClick={() => step(-1)}>
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label={t("carousel.next")} disabled={edges.end} onClick={() => step(1)}>
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      )}
    </section>
  );
}
