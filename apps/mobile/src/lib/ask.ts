import type { WorkRow } from './works';

/**
 * Kayıt araması: LLM (RAG) gelene kadar "Sezi'ye Sor" bu yerel eşleştirmeyle yanıt verir.
 * Yalnızca doğrulanmış eserlerin adı, türü, ilçesi ve ili aranır; metin üretilmez.
 */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

// Soru kelimesi → tür eşlemesi (kökler; ekli halleri de yakalar).
const TYPE_HINTS: [string, string[]][] = [
  ['medrese', ['medrese']],
  ['madrasa', ['medrese']],
  ['ilim', ['medrese']],
  ['su', ['cesme', 'sebil']],
  ['water', ['cesme', 'sebil']],
  ['cesme', ['cesme']],
  ['fountain', ['cesme', 'sebil']],
  ['sebil', ['sebil']],
  ['turbe', ['turbe']],
  ['tomb', ['turbe']],
  ['cami', ['cami']],
  ['mosque', ['cami']],
  ['hamam', ['hamam']],
  ['bath', ['hamam']],
  ['imaret', ['imaret']],
  ['kutuphane', ['kutuphane']],
  ['library', ['kutuphane']],
  ['han', ['han']],
  ['inn', ['han']],
  ['carsi', ['carsi']],
  ['bedesten', ['carsi']],
  ['bazaar', ['carsi']],
  ['kilise', ['kilise']],
  ['church', ['kilise']],
  ['sinagog', ['sinagog']],
  ['synagogue', ['sinagog']],
  ['tekke', ['tekke']],
  ['zaviye', ['tekke']],
  ['mektep', ['mektep']],
  ['school', ['mektep', 'medrese']],
  ['konak', ['konak']],
  ['mansion', ['konak']],
  ['kopru', ['kopru']],
  ['bridge', ['kopru']],
];

const STOP = new Set(['hangi', 'hangileri', 'nerede', 'var', 'mi', 'mu', 'ne', 'nedir', 'kulliye', 'kulliyede', 'the', 'which', 'where', 'is', 'are', 'in', 'of', 'what', 'complex']);

export function searchWorks(query: string, works: WorkRow[]): WorkRow[] {
  const q = normalize(query);
  const words = q.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (words.length === 0) return [];

  const types = new Set<string>();
  for (const w of words) for (const [stem, ts] of TYPE_HINTS) if (w.startsWith(stem)) ts.forEach((x) => types.add(x));

  // İl/ilçe adı geçiyorsa ("Osmangazi'deki hamamlar") sonuçlar o yerle sınırlanır.
  const placeOf = (w: WorkRow) => normalize([w.district, w.city_name.tr, w.city_name.en].filter(Boolean).join(' '));
  const placeWords = words.filter((w) => w.length > 3 && works.some((x) => placeOf(x).split(/\s+/).includes(w)));
  const pool = placeWords.length ? works.filter((x) => placeWords.every((p) => placeOf(x).split(/\s+/).includes(p))) : works;
  const rest = words.filter((w) => !placeWords.includes(w));

  const scored = pool.map((work) => {
    const hay = normalize([work.name.tr, work.name.en, work.type_name.tr, work.type_name.en].filter(Boolean).join(' '));
    let score = 0;
    for (const w of rest) if (w.length > 2 && hay.includes(w.slice(0, Math.max(3, w.length - 2)))) score += 2;
    if (types.has(work.type_slug)) score += 3;
    if (types.size && !types.has(work.type_slug) && score < 4) score = 0;
    if (placeWords.length && rest.length === 0) score = 1;
    return { work, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.work);
}
