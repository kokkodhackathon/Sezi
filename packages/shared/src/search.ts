import type { WorkRow } from "./works";

export type SearchableWork = Pick<WorkRow, "name" | "type_name" | "type_slug" | "district" | "city_name">;

/**
 * Kayıt araması: Sezi'ye Sor için RAG adaylarını cihazda daraltır; servis yoksa yerel sonuçları gösterir.
 * Yalnızca doğrulanmış eserlerin adı, türü, ilçesi ve ili aranır; burada metin üretilmez.
 */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[ıİ]/g, "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bulu\s*cami(i)?\b/g, "ulu cami$1");
}

// Soru kelimesi → tür eşlemesi (kökler; ekli halleri de yakalar).
const TYPE_HINTS: [string, string[]][] = [
  ["medrese", ["medrese"]],
  ["madrasa", ["medrese"]],
  ["ilim", ["medrese"]],
  ["su", ["cesme", "sebil"]],
  ["water", ["cesme", "sebil"]],
  ["cesme", ["cesme"]],
  ["fountain", ["cesme", "sebil"]],
  ["sebil", ["sebil"]],
  ["turbe", ["turbe"]],
  ["tomb", ["turbe"]],
  ["cami", ["cami"]],
  ["mosque", ["cami"]],
  ["hamam", ["hamam"]],
  ["bath", ["hamam"]],
  ["imaret", ["imaret"]],
  ["kutuphane", ["kutuphane"]],
  ["library", ["kutuphane"]],
  ["han", ["han"]],
  ["inn", ["han"]],
  ["carsi", ["carsi"]],
  ["bedesten", ["carsi"]],
  ["bazaar", ["carsi"]],
  ["kilise", ["kilise"]],
  ["church", ["kilise"]],
  ["sinagog", ["sinagog"]],
  ["synagogue", ["sinagog"]],
  ["tekke", ["tekke"]],
  ["zaviye", ["tekke"]],
  ["mektep", ["mektep"]],
  ["school", ["mektep", "medrese"]],
  ["konak", ["konak"]],
  ["mansion", ["konak"]],
  ["kopru", ["kopru"]],
  ["bridge", ["kopru"]],
];

const STOP = new Set([
  "hakkinda", "biraz", "bilgi", "ver", "verir", "verebilir", "misin", "musun",
  "anlat", "anlatir", "anlatabilir", "biliyorsun", "lutfen", "peki",
  "kim", "yaptirdi", "yaptirmis", "tarihi", "tarihini", "tarihcesi", "mimarisi", "mimarisini",
  "hangi",
  "hangileri",
  "nerede",
  "var",
  "mi",
  "mu",
  "ne",
  "nedir",
  "kulliye",
  "kulliyede",
  "the",
  "which",
  "where",
  "is",
  "are",
  "in",
  "of",
  "what",
  "complex",
]);

const tokens = (...parts: (string | null | undefined)[]) => normalize(parts.filter(Boolean).join(" ")).split(/\s+/).filter(Boolean);

/**
 * Yazarken arama: her kelime eserin adında bir kelimenin başıyla eşleşir ("a" → Alaaddin, Ayasofya; "kay" → Kayıhan).
 * Üç harften uzun kelimelerde ek de tolere edilir ("hamamlar" → hamam). İl / ilçe adı geçiyorsa sonuçlar o yerle
 * sınırlanır; tür sözcüğü ("medreseler", "fountain") o türdeki eserleri getirir. Bütün kelimeler eşleşmeli (VE);
 * hiçbir eserde geçmeyen kelime ("hangi", "da") yok sayılır. Sıra: adın ilk kelimesi, ad, tür, yer eşleşmesi.
 */
export function searchWorks<W extends SearchableWork>(query: string, works: W[]): W[] {
  // Kesmeden sonraki ek bağımsız ad değildir: Ulucami’yi → Ulucami (yi → Yıldırım olmasın).
  const words = normalize(query.replace(/['’ʼ][\p{L}]+/gu, ""))
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP.has(w));
  if (words.length === 0) return [];

  // Tür ipucu: kök en az üç harfse ekli hâli de sayılır ("hanlar"); iki harfli kök ("su") yalnız kendisiyle.
  const hintOf = (w: string) => {
    const out = new Set<string>();
    for (const [stem, ts] of TYPE_HINTS) if (w.startsWith(stem) && (stem.length >= 3 || w === stem)) ts.forEach((x) => out.add(x));
    return out;
  };
  const hints = new Map(words.map((w) => [w, hintOf(w)]));

  // İl/ilçe adı tam geçiyorsa ("Osmangazi'deki hamamlar") sonuçlar o yerle sınırlanır.
  const placeOf = (w: SearchableWork) => tokens(w.district, w.city_name.tr, w.city_name.en);
  const placeWords = words.filter((w) => w.length > 3 && works.some((x) => placeOf(x).includes(w)));
  const pool = placeWords.length ? works.filter((x) => placeWords.every((p) => placeOf(x).includes(p))) : works;
  const rest = words.filter((w) => !placeWords.includes(w));

  const prepared = pool.map((work) => ({
    work,
    name: tokens(work.name.tr, work.name.en),
    type: tokens(work.type_name.tr, work.type_name.en),
    place: placeOf(work),
  }));

  /** Kelimenin bu eserdeki eşleşme puanı (ad + tür; yalnız yer eşleşirse 1); 0 eşleşme yok. */
  const hit = (p: (typeof prepared)[number], w: string): number => {
    const stem = w.length > 3 ? w.slice(0, Math.max(3, w.length - 2)) : null;
    const name = p.name[0]?.startsWith(w) ? 6 : p.name.some((t) => t.startsWith(w)) ? 4 : stem && p.name.some((t) => t.startsWith(stem)) ? 2 : 0;
    // Tür adında kelime başı eşleşmesi en az üç harfle ("a" → "and", "su" → "sufi" gibi gürültü olmasın).
    const type = hints.get(w)?.has(p.work.type_slug) || (w.length >= 3 && p.type.some((t) => t.startsWith(w))) ? 3 : 0;
    if (name + type > 0) return name + type;
    return w.length >= 3 && p.place.some((t) => t.startsWith(w) || (stem !== null && t.startsWith(stem))) ? 1 : 0;
  };

  // Hiçbir eserde geçmeyen kelime soru sözcüğüdür ya da yazım artığıdır: aramayı daraltmaz.
  const live = rest.filter((w) => prepared.some((p) => hit(p, w) > 0));
  if (live.length === 0) return placeWords.length ? pool : [];

  return prepared
    .map((p) => {
      let score = 0;
      for (const w of live) {
        const s = hit(p, w);
        if (s === 0) return { work: p.work, score: 0 };
        score += s;
      }
      return { work: p.work, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.work);
}
