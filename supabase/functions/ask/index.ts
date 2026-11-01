// Sezi'ye Sor: yalnız doğrulanmış eser metnini bulur, DeepSeek'e sınırlı bağlam verir ve kaynakları doğrular.
// DeepSeek'e konum, hesap, cihaz kimliği ya da IP gönderilmez. API anahtarı yalnız Edge Function secret'ıdır.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

import { llmProviderFromEnv, type LlmContext } from '../_shared/llm.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SLUG = /^[a-z0-9-]+$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const Body = z.object({
  question: z.string().trim().min(2).max(240),
  lang: z.enum(['tr', 'en']),
  deviceId: z.string().uuid(),
  candidateSlugs: z.array(z.string().regex(SLUG)).max(10).default([]),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(600) })).max(6).default([]),
});

const Chunk = z.object({
  chunk_id: z.string().uuid(),
  work_slug: z.string(),
  work_name: z.string(),
  section: z.enum(['facts', 'summary', 'history', 'architecture', 'app']),
  content: z.string(),
  source_title: z.string(),
  source_publisher: z.string().nullable(),
  source_year: z.number().nullable(),
  source_url: z.string().nullable(),
  source_volume: z.number().nullable(),
  source_page: z.string().nullable(),
  rank: z.number(),
});

const insufficient = (lang: 'tr' | 'en') => lang === 'tr'
  ? 'Bu konuda elimde yeterli bilgi yok. Sezi’de yayımlanan bilgilerle henüz yanıtlayamıyorum.'
  : 'I don’t have enough information on this yet. The details published in Sezi don’t cover it.';

async function subjectHash(deviceId: string, req: Request, secret: string): Promise<string> {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]!.trim();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${deviceId}|${ip}`));
  return [...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!req.headers.get('Authorization')) return json(401, { error: 'unauthorized' });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'bad_request' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const found = await admin.rpc('search_ask_chunks', {
    p_query: parsed.data.question,
    p_lang: parsed.data.lang,
    p_work_slugs: parsed.data.candidateSlugs,
    p_limit: 12,
  });
  if (found.error) {
    console.error('search', found.error.message);
    return json(500, { error: 'db' });
  }
  const rows = z.array(Chunk).safeParse(found.data ?? []);
  if (!rows.success) {
    console.error('search format', rows.error.message);
    return json(500, { error: 'db_format' });
  }
  if (!rows.data.length) {
    return json(200, { mode: 'insufficient', answer: insufficient(parsed.data.lang), citations: [], workSlugs: [] });
  }

  const provider = llmProviderFromEnv();
  if (!provider) return json(503, { error: 'not_configured' });
  const serviceSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const hash = await subjectHash(parsed.data.deviceId, req, serviceSecret);
  const reserved = await admin.rpc('reserve_ask_usage', {
    p_subject_hash: hash,
    p_prompt_chars: parsed.data.question.length,
    p_provider: provider.name,
    p_model: provider.model,
  });
  if (reserved.error) {
    console.error('reserve', reserved.error.message);
    return json(500, { error: 'db' });
  }
  if (!reserved.data) return json(429, { error: 'rate_limit' });

  const contexts: LlmContext[] = rows.data.map((row, i) => ({
    id: `K${i + 1}`,
    workName: row.work_name,
    section: row.section,
    sourceTitle: row.source_title,
    sourcePage: row.source_page,
    content: row.content.slice(0, 1_800),
  }));
  let answer;
  try {
    answer = await provider.answer({
      question: parsed.data.question,
      lang: parsed.data.lang,
      history: parsed.data.history,
      contexts,
    });
  } catch (e) {
    console.error('llm', e instanceof Error ? e.message : String(e));
    return json(502, { error: 'upstream' });
  }

  const byId = new Map(contexts.map((c, i) => [c.id, { context: c, row: rows.data[i]! }]));
  // Metindeki işaretler kaynak listesinden daha güvenilirdir. Model işaret koymadıysa JSON listesini kullanırız;
  // bağlamda bulunmayan tek bir işaret varsa kaynaklı görünmesi için başka bir kaynakla değiştirmeyiz.
  const markers = [...answer.answer.matchAll(/\[(K\d+)\]/g)].map((match) => match[1]!);
  const requested = markers.length ? markers : answer.citationIds;
  const citationIds = [...new Set(requested)].filter((id) => byId.has(id)).slice(0, 6);
  if (answer.status !== 'answer' || !answer.answer || citationIds.length === 0) {
    return json(200, { mode: 'insufficient', answer: insufficient(parsed.data.lang), citations: [], workSlugs: [] });
  }

  let rendered = answer.answer;
  const citations = citationIds.map((id, index) => {
    const hit = byId.get(id)!;
    rendered = rendered.replaceAll(`[${id}]`, `[${index + 1}]`);
    return {
      index: index + 1,
      workSlug: hit.row.work_slug,
      workName: hit.row.work_name,
      section: hit.row.section,
      sourceTitle: hit.row.source_title,
      sourcePublisher: hit.row.source_publisher,
      sourceYear: hit.row.source_year,
      sourceUrl: safeHttpUrl(hit.row.source_url),
      sourceVolume: hit.row.source_volume,
      sourcePage: hit.row.source_page,
    };
  });
  // Model kaynak listesini doğru verip metinde işaret koymayı atlarsa cevap yine kaynaksız görünmesin.
  if (!citations.some((c) => rendered.includes(`[${c.index}]`))) rendered = `${rendered} [1]`;
  // Bağlamda olmayan uydurma K işaretlerini temizle.
  rendered = rendered.replace(/\[K\d+\]/g, '').replace(/\s+([.,;:!?])/g, '$1').trim();
  const workSlugs = [...new Set(citations.map((c) => c.workSlug))];
  return json(200, { mode: 'rag', answer: rendered, citations, workSlugs, provider: provider.name, model: provider.model });
});

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
