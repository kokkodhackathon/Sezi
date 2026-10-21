"use client";

import { useRef, useState, type ReactNode } from "react";

const SIZE = 200;
const ZOOM = 2.5;

/**
 * Büyüteç: fare ile fotoğrafın üstünde gezince imlecin altını büyütür (kitabe yazısı, süsleme ayrıntısı).
 * Yalnız ince işaretçide (fare, kalem) çalışır; dokunmatikte ve klavyede aynı fotoğraf tam ekran açılır.
 * Görsel yardımdır, ekran okuyucuya gösterilmez. Büyütülen kopya çerçeveyle aynı `object-cover` yerleşimini kullanır.
 */
export function Lens({ src, children }: { src: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  return (
    <div
      ref={ref}
      className="relative"
      onPointerMove={(e) => {
        if (e.pointerType === "touch" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        setAt({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
      }}
      onPointerLeave={() => setAt(null)}
    >
      {children}
      {at ? (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-4 border-card shadow-lg contrast:border-foreground"
          style={{ width: SIZE, height: SIZE, left: at.x - SIZE / 2, top: at.y - SIZE / 2 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- büyütülmüş kopya; Next görseli burada boyut hesabını bozar */}
          <img
            src={src}
            alt=""
            className="absolute max-w-none object-cover"
            style={{ width: at.w * ZOOM, height: at.h * ZOOM, left: SIZE / 2 - at.x * ZOOM, top: SIZE / 2 - at.y * ZOOM }}
          />
        </div>
      ) : null}
    </div>
  );
}
