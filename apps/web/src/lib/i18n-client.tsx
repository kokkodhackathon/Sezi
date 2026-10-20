"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { t, type Lang, type MessageKey, type Vars } from "./i18n";

const LangContext = createContext<Lang>("tr");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** İstemci bileşenlerinde metin: `const { t: tr, lang } = useT()`. */
export function useT() {
  const lang = useContext(LangContext);
  return useMemo(() => ({ lang, t: (key: MessageKey, vars?: Vars) => t(lang, key, vars) }), [lang]);
}
