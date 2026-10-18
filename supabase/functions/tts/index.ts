// Türkçe metni Google Chirp 3 HD ile seslendirir; aynı metin bir kez üretilir ve `tts` bucket'ında saklanır.
// Önbellek isabetinde Google çağrılmaz. Yeni üretim günlük karakter bütçesinden düşer (tts_reserve).
import { createClient } from 'npm:@supabase/supabase-js@2';

const VOICE_RE = /^tr-TR-Chirp3-HD-[A-Za-z]+$/;
const MAX_BYTES = 4500; // Google sınırı 5000 bayt
const enc = new TextEncoder();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY');
  if (!apiKey) return json(503, { error: 'not_configured' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_request' });
  }
  const { text: rawText, voice } = (body ?? {}) as { text?: unknown; voice?: unknown };
  if (typeof rawText !== 'string' || typeof voice !== 'string' || !VOICE_RE.test(voice)) {
    return json(400, { error: 'bad_request' });
  }
  const text = rawText.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!text) return json(400, { error: 'bad_request' });
  const bytes = enc.encode(text);
  if (bytes.length > MAX_BYTES) return json(413, { error: 'too_long' });

  const key = await sha256Hex(bytes);
  const dir = `chirp3/${voice}`;
  const path = `${dir}/${key}.mp3`;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const bucket = supabase.storage.from('tts');
  const url = bucket.getPublicUrl(path).data.publicUrl;

  const listed = await bucket.list(dir, { search: `${key}.mp3`, limit: 1 });
  if (listed.error) {
    console.error('list', listed.error.message);
    return json(500, { error: 'storage' });
  }
  if (listed.data.some((o) => o.name === `${key}.mp3`)) return json(200, { url, key });

  const cap = Number(Deno.env.get('TTS_DAILY_CHAR_LIMIT') ?? '30000');
  const reserved = await supabase.rpc('tts_reserve', { n: text.length, cap });
  if (reserved.error) {
    console.error('reserve', reserved.error.message);
    return json(500, { error: 'budget_check' });
  }
  if (reserved.data !== true) return json(429, { error: 'budget' });

  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'tr-TR', name: voice },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  if (!res.ok) {
    console.error('google', res.status, await res.text());
    return json(502, { error: 'upstream' });
  }
  const { audioContent } = (await res.json()) as { audioContent?: string };
  if (!audioContent) {
    console.error('google', 'audioContent yok');
    return json(502, { error: 'upstream' });
  }

  const up = await bucket.upload(path, fromBase64(audioContent), {
    contentType: 'audio/mpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  // İki istemci aynı metni aynı anda üretmişse ikinci yükleme "exists" alır: dosya zaten orada.
  if (up.error && !/exists|duplicate/i.test(up.error.message)) {
    console.error('upload', up.error.message);
    return json(500, { error: 'storage' });
  }
  return json(200, { url, key });
});
