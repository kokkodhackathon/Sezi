import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { navFor } from '@/lib/nav';

/**
 * Sayfa başlığı: başlık + tek cümlelik açıklama (menüdeki tanımdan) + sağda sayfa eylemleri.
 * `title`/`hint` verilirse menü tanımının yerine geçer (ör. eser düzenlemede eserin adı).
 */
export function PageHeader({ title, hint, actions }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode }) {
  const item = navFor(useLocation().pathname);
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">{title ?? item?.title}</h1>
        {(hint ?? item?.hint) ? <p className="text-muted-foreground">{hint ?? item?.hint}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
