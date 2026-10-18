// Sabit Türkçe yönlendirme cümlelerinin Chirp 3 HD seslerini üretir ve uygulamaya gömer.
// Kaynak cümleler: @sezi/shared › staticGuidanceTexts (adsız dönüş + uyarı, varış) ve oturumun sabit uyarıları.
// Edge function `tts` kullanılır: sunucuda zaten varsa Google'a gidilmez.
//
//   cd apps/mobile && npx tsx scripts/gen-voice-bundle.mts
//
// Çıktı: assets/voice/tr/<sha256>.mp3 ve src/lib/voice/bundled.ts. Metin kalıbı değişince yeniden çalıştırın;
// çalıştırılmazsa uygulama yeni cümleyi çalışırken üretir (ya da cihaz sesiyle okur), bozulmaz.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { staticGuidanceTexts } from '@sezi/shared';

import { NAV_STATIC_TR } from '../src/lib/navigation/texts';
import { CHIRP_VOICE } from '../src/lib/voice/voice-name';

const root = resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const base = env.EXPO_PUBLIC_SUPABASE_URL;
if (!base) throw new Error('apps/mobile/.env içinde EXPO_PUBLIC_SUPABASE_URL yok');

// Uygulamadaki normalleştirmeyle aynı (voice/chirp.ts › norm).
const norm = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim();
const texts = [...new Set([...staticGuidanceTexts('tr'), ...NAV_STATIC_TR].map(norm))];

const outDir = resolve(root, 'assets/voice/tr');
mkdirSync(outDir, { recursive: true });

const entries: [string, string][] = [];
for (const text of texts) {
  const res = await fetch(`${base}/functions/v1/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: CHIRP_VOICE }),
  });
  const body: unknown = await res.json();
  if (!res.ok || typeof body !== 'object' || !body || !('url' in body) || !('key' in body)) {
    throw new Error(`tts ${res.status}: ${JSON.stringify(body)} (${text})`);
  }
  const { url, key } = body as { url: string; key: string };
  const file = resolve(outDir, `${key}.mp3`);
  if (!existsSync(file)) {
    const mp3 = await fetch(url);
    if (!mp3.ok) throw new Error(`indirme ${mp3.status}: ${url}`);
    writeFileSync(file, Buffer.from(await mp3.arrayBuffer()));
  }
  entries.push([text, key]);
  console.log(key.slice(0, 8), text);
}

// Artık kullanılmayan sesler silinir (APK şişmesin).
const keep = new Set(entries.map(([, key]) => `${key}.mp3`));
for (const f of readdirSync(outDir)) if (!keep.has(f)) rmSync(resolve(outDir, f));

const lines = entries.map(([text, key]) => `  ${JSON.stringify(text)}: require('../../../assets/voice/tr/${key}.mp3'),`);
writeFileSync(
  resolve(root, 'src/lib/voice/bundled.ts'),
  [
    '// Üretildi: scripts/gen-voice-bundle.mts. Elle düzenlemeyin.',
    '',
    '/** Gömülü seslerin üretildiği ses; uygulamadaki ses farklıysa gömülü sesler kullanılmaz. */',
    `export const BUNDLED_VOICE = ${JSON.stringify(CHIRP_VOICE)};`,
    '',
    '/** Normalleştirilmiş metin → gömülü MP3 (Chirp 3 HD). */',
    'export const BUNDLED: Record<string, number> = {',
    ...lines,
    '};',
    '',
  ].join('\n'),
);
console.log(`${entries.length} cümle gömüldü → assets/voice/tr`);
