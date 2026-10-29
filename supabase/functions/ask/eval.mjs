import { readFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_ANON_KEY gerekli');

const cases = JSON.parse(await readFile(new URL('./eval-cases.json', import.meta.url), 'utf8'));
const deviceId = '1f7429d1-50cf-4dc5-a3ea-72c8664c6ed0';
let failed = 0;

for (const test of cases) {
  const res = await fetch(`${url}/functions/v1/ask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: test.question,
      lang: test.lang,
      deviceId,
      candidateSlugs: test.candidateSlugs || [],
      history: test.history || [],
    }),
  });
  const body = await res.json().catch(() => null);
  const cited = new Set(body?.workSlugs || []);
  const modeOk = res.ok && body?.mode === test.expectMode;
  const worksOk = test.expectWorkSlugs.every((slug) => cited.has(slug));
  const sourcesOk = test.expectMode === 'insufficient' || (body?.citations?.length > 0 && body.citations.every((c) => body.answer.includes(`[${c.index}]`)));
  const ok = modeOk && worksOk && sourcesOk;
  console.log(`${ok ? '✓' : '✗'} ${test.name}: HTTP ${res.status}, ${body?.mode || body?.error || 'yanıt yok'}`);
  if (!ok) failed += 1;
}

if (failed) throw new Error(`${failed}/${cases.length} değerlendirme başarısız`);
console.log(`${cases.length}/${cases.length} değerlendirme geçti`);
