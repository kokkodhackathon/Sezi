import { AskResponseSchema, askConversationReply, searchAskWorks, type AskHistoryMessage, type AskResponse, type WorkRow } from '@sezi/shared';

import { deviceId } from './device';
import type { Lang } from './i18n';
import { supabase } from './supabase';

const MAX_CANDIDATES = 8;

export type AskResult = {
  response: AskResponse;
  works: WorkRow[];
};

/**
 * Yerel arama yalnız aday eserleri bulur; cevap üretmez. Soru, kısa konuşma geçmişi ve aday slug'ları Edge
 * Function'a gider. DeepSeek anahtarı ve doğrulanmış kaynak metinleri cihazda bulunmaz.
 */
export async function askSezi(
  question: string,
  lang: Lang,
  works: WorkRow[],
  history: AskHistoryMessage[],
  previousWorkSlugs: string[],
): Promise<AskResult> {
  const conversation = askConversationReply(question, lang);
  if (conversation) return { response: { mode: 'conversation', answer: conversation, citations: [], workSlugs: [] }, works: [] };
  const local = searchAskWorks(question, works).slice(0, MAX_CANDIDATES);
  const candidateSlugs = [...new Set(local.length ? local.map((w) => w.slug) : previousWorkSlugs)].slice(0, 10);
  const { data, error } = await supabase.functions.invoke('ask', {
    body: {
      question,
      lang,
      deviceId: deviceId(),
      candidateSlugs,
      history: history.slice(-6).map(m => ({ ...m, text: m.text.slice(0, 600) })),
    },
  });
  if (error) throw error;
  const response = AskResponseSchema.parse(data);
  const wanted = new Set(response.workSlugs);
  return { response, works: works.filter((w) => wanted.has(w.slug)) };
}
