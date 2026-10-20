import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Sayfa kabı: tüm sayfalar aynı genişlik ve kenar boşluğuyla. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:py-10", className)}>{children}</div>;
}

/** Sayfa başlığı: isteğe bağlı üst satır, h1 ve kısa giriş. Sayfada tek h1 olur. */
export function PageIntro({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="mb-8 grid gap-2">
      {eyebrow ? <p className="font-heading text-sm font-bold text-link">{eyebrow}</p> : null}
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      {lead ? <p className="max-w-3xl text-lg text-muted-foreground">{lead}</p> : null}
      {children}
    </header>
  );
}

/** Bölüm başlığı (h2). */
export function SectionTitle({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("mb-4 text-2xl font-extrabold tracking-tight", className)}>
      {children}
    </h2>
  );
}
