"use client";

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountProvider } from "@/lib/account";
import type { Lang } from "@/lib/i18n";
import { LangProvider } from "@/lib/i18n-client";

export function Providers({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <LangProvider lang={lang}>
      <AccountProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </AccountProvider>
    </LangProvider>
  );
}
