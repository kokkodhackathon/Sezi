"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Kayan seçim dolgusu için seçili öğenin kap içindeki yeri ve genişliği. Öğeler farklı genişlikte olduğundan
 * ölçülür; kap boyutu değişince (yazı boyutu, pencere) yeniden ölçülür. `index` -1 ise seçili öğe yok (null).
 * Dolgu `transform` + `width` geçişiyle kayar; hareket azaltmada genel CSS kuralı geçişi anlık yapar.
 */
export function useSlidingBox(container: RefObject<HTMLElement | null>, selector: string, index: number, deps: unknown[] = []) {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const item = index < 0 ? undefined : el.querySelectorAll<HTMLElement>(selector)[index];
      setBox(item ? { left: item.offsetLeft, width: item.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, selector, index, ...deps]);

  return box;
}
