// Eser metinleri: kitaptan gelen tarihçe ve mimari metninden 2–3 cümlelik sade özet ÖNERİSİ üretir (Gemini).
// Yalnız admin çağırır: istek admin'in oturum anahtarıyla yapılır, taslak RLS ile okunur ve yazılır (service role yok).
// Öneri text_drafts.summary_suggestion'a yazılır; yayına girmez. Admin kitapla karşılaştırıp özete taşır ve yayınlar.
// Toplu iş yok: her çağrı tek eser, admin'in düğmesiyle.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_CHARS = 80_000; // TR + EN tarihçe ve mimari; en uzunu Ulucami ~40 bin
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const str = (v: unknown): string => (typeof v === 'string' ? v.normalize('NFC').trim() : '');

const Body = z.object({ draft_id: z.string().regex(UUID_RE), tr: z.string(), en: z.string().default('') });
const Name = z.object({ tr: z.string(), en: z.string().optional() });
const WorkRel = z.union([z.object({ name: Name }), z.array(z.object({ name: Name }))]);
const GeminiResponse = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }) })).min(1),
});
const Summary = z.object({ tr: z.string(), en: z.string() });
const GoogleError = z.object({ error: z.object({ message: z.string() }) });

const PROMPT = `Bir vakıf eseri için kitap metninden sade bir özet yazacaksın.

KURALLAR
- Yalnız aşağıdaki metinde açıkça yazan bilgiyi kullan. Metinde olmayan hiçbir yıl, ad, sayı, olay, değerlendirme ya da sıfat ekleme.
- Türkçe özeti TÜRKÇE metinden, İngilizce özeti İNGİLİZCE metinden yaz. İngilizce metin yoksa İngilizce özeti Türkçe özetin çevirisi olarak yaz.
- Her dilde 2 ya da 3 kısa cümle, toplam en çok 350 karakter.
- Önce yapının ne olduğu ve ne zaman, kim tarafından yaptırıldığı (metinde varsa); sonra metindeki en önemli bir ya da iki bilgi.
- Günlük dil kullan: eski ya da teknik sözcük gerekiyorsa basit karşılığını seç (ör. "hazire" yerine "mezarlık"), anlamı değiştirme.
- Metin kesin konuşmuyorsa ("tahmin edilmektedir", "rivayete göre") özette de kesin konuşma.
- Kitabe çevirisi, kaynak gösterimi, sayfa numarası ve onarım listesi yazma.
- Yalnız JSON döndür: {"tr": "...", "en": "..."}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const auth = req.headers.get('Authorization');
  if (!auth) return json(401, { error: 'unauthorized' });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: 'bad_request' });
  const draftId = body.data.draft_id;
  // Kaynak metin formdaki hâlidir (admin düzeltip henüz yayınlamamış olabilir); okunan taslakla aynı eserin metnidir.
  const sourceTr = str(body.data.tr);
  const sourceEn = str(body.data.en);
  if (!sourceTr) return json(400, { error: 'bad_request' });
  if (sourceTr.length + sourceEn.length > MAX_CHARS) return json(413, { error: 'too_long' });

  // Admin'in kendi anahtarıyla: RLS (text_drafts yalnız admin) yetkiyi denetler.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const draft = await supabase.from('text_drafts').select('id, work:works!inner(name)').eq('id', draftId).maybeSingle();
  if (draft.error) {
    console.error('read', draft.error.message);
    return json(500, { error: 'db' });
  }
  if (!draft.data) return json(403, { error: 'forbidden' });
  const rel = WorkRel.safeParse(draft.data.work);
  const workName = rel.success ? (Array.isArray(rel.data) ? rel.data[0]?.name : rel.data.name) : undefined;
  // Yetki önce denetlenir: yetkisiz çağrı servisin kurulu olup olmadığını öğrenmesin.
  // Aynı Google Cloud anahtarı hem Text-to-Speech hem Gemini (Generative Language API) yetkisine sahip;
  // ayrı anahtar istenirse GEMINI_API_KEY tanımlanır.
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_TTS_API_KEY');
  if (!apiKey) return json(503, { error: 'not_configured' });
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';

  const input = `${PROMPT}\n\nESER: ${workName?.tr ?? ''}${workName?.en ? ` / ${workName.en}` : ''}\n\nTÜRKÇE METİN:\n${sourceTr}\n\nİNGİLİZCE METİN:\n${sourceEn || '(yok)'}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'low' },
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: { tr: { type: 'string' }, en: { type: 'string' } },
          required: ['tr', 'en'],
        },
      },
    }),
  }).catch((e: unknown) => {
    console.error('gemini fetch', e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!res) return json(504, { error: 'upstream_timeout' });
  if (!res.ok) {
    const raw = await res.text();
    console.error('gemini', res.status, raw.slice(0, 500));
    // Çağıran admin (RLS'ten geçti): Google'ın hata nedeni panelde gösterilir (ör. API anahtarda kapalı).
    const detail = GoogleError.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
    return json(502, { error: 'upstream', status: res.status, detail: detail.success ? detail.data.error.message.slice(0, 300) : undefined });
  }
  const out = GeminiResponse.safeParse(await res.json().catch(() => null));
  const text = out.success ? out.data.candidates[0]!.content.parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('') : '';
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // aşağıda biçim hatası olarak döner
  }
  const result = Summary.safeParse(parsed);
  if (!result.success || !str(result.data.tr)) {
    console.error('gemini format', text.slice(0, 300));
    return json(502, { error: 'upstream_format' });
  }
  const suggestion = { tr: str(result.data.tr), en: str(result.data.en) };

  const by = model;
  const at = new Date().toISOString();
  const saved = await supabase
    .from('text_drafts')
    .update({ summary_suggestion: suggestion.en ? suggestion : { tr: suggestion.tr }, summary_suggestion_by: by, summary_suggested_at: at })
    .eq('id', draftId)
    .select('id');
  if (saved.error || !saved.data?.length) {
    console.error('save', saved.error?.message ?? 'no row');
    return json(500, { error: 'db' });
  }
  return json(200, { suggestion, by, at });
});
