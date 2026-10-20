import * as about from "./messages/about";
import * as account from "./messages/account";
import * as core from "./messages/core";
import * as report from "./messages/report";
import * as route from "./messages/route";
import * as works from "./messages/works";

/** Tüm metinler: alan başına bir dosya (`messages/*.ts`), her biri TR + EN. */
const tr = { ...core.tr, ...works.tr, ...route.tr, ...report.tr, ...account.tr, ...about.tr };
export type MessageKey = keyof typeof tr;
const en: Record<MessageKey, string> = { ...core.en, ...works.en, ...route.en, ...report.en, ...account.en, ...about.en };

export const messages: Record<"tr" | "en", Record<MessageKey, string>> = { tr, en };
