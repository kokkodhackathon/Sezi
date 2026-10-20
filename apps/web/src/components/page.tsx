import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Sayfa kabı: tüm sayfalar aynı genişlik ve kenar boşluğuyla. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:py-10", className)}>{children}</div>;
}
