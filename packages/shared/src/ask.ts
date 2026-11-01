import { z } from "zod";

export const AskLangSchema = z.enum(["tr", "en"]);
export type AskLang = z.infer<typeof AskLangSchema>;

export const AskHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(600),
});
export type AskHistoryMessage = z.infer<typeof AskHistoryMessageSchema>;

export const AskRequestSchema = z.object({
  question: z.string().trim().min(2).max(240),
  lang: AskLangSchema,
  deviceId: z.string().uuid(),
  candidateSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(10).default([]),
  history: z.array(AskHistoryMessageSchema).max(6).default([]),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskCitationSchema = z.object({
  index: z.number().int().positive(),
  workSlug: z.string(),
  workName: z.string(),
  section: z.enum(["facts", "summary", "history", "architecture", "app"]),
  sourceTitle: z.string(),
  sourcePublisher: z.string().nullable(),
  sourceYear: z.number().int().nullable(),
  sourceUrl: z.string().url().nullable(),
  sourceVolume: z.number().int().positive().nullable(),
  sourcePage: z.string().nullable(),
});
export type AskCitation = z.infer<typeof AskCitationSchema>;

export const AskResponseSchema = z.object({
  mode: z.enum(["rag", "insufficient"]),
  answer: z.string().trim().min(1).max(2_000),
  citations: z.array(AskCitationSchema).max(6),
  workSlugs: z.array(z.string()).max(10),
  provider: z.string().optional(),
  model: z.string().optional(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;
