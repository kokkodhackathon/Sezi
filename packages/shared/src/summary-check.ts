/**
 * Sade özet denetimi: özetteki sayıların ve özel adların kaynak metinde geçip geçmediği.
 * Yapay zekâ özetinde en sık uydurma biçimi yeni bir yıl ya da ad eklemektir; bulunamayanlar admin'e uyarı olarak
 * gösterilir (karar admin'indir, özet kendiliğinden reddedilmez). Formdaki o anki metinle hesaplanır.
 */
export type SummaryLang = "tr" | "en";

/** Küçük harf ve şapka/nokta farkı gider: "Fâtih" = "Fatih", "İstanbul" = "Istanbul" (iki taraf aynı biçimde katlanır). */
const fold = (s: string, lang: SummaryLang) => s.toLocaleLowerCase(lang === "tr" ? "tr" : "en").normalize("NFD").replace(/\p{M}/gu, "");

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };
/** Kitaplar yüzyılı Roma rakamıyla yazar ("XIV. yüzyıl"); özet "14. yüzyıl" diyebilir. */
function romanNumbers(source: string): string[] {
  return (source.match(/\b[IVX]{1,5}(?=\.)/g) ?? []).map((r) => {
    let n = 0;
    for (let i = 0; i < r.length; i++) {
      const v = ROMAN[r[i]!]!, next = ROMAN[r[i + 1] ?? ""] ?? 0;
      n += v < next ? -v : v;
    }
    return String(n);
  });
}

/** Ek ayrılır: "Orhan Gazi'nin" → "Orhan", "Bursa’da" → "Bursa". */
const stripSuffix = (w: string) => w.split(/['’]/)[0]!;

/** Kökü kaynakta arar: çekim eki farkı (Osmanlı’nın / Osmanlıların) uyarı vermesin. */
function stemIn(word: string, source: string, lang: SummaryLang): boolean {
  const w = fold(word, lang);
  const n = Math.min(w.length, Math.max(5, Math.ceil(w.length * 0.5)));
  return source.includes(w.slice(0, n));
}

/** Özette geçen ama kaynak metinde bulunmayan sayılar ve özel adlar (tekrarsız, özetteki sırayla). */
export function unsupportedInSummary(summary: string, source: string, lang: SummaryLang): string[] {
  const src = fold(source.normalize("NFC"), lang);
  const srcNumbers = new Set([...(source.match(/\d+/g) ?? []), ...romanNumbers(source)]);
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  for (const n of summary.match(/\d+/g) ?? []) if (!srcNumbers.has(n)) add(n);
  // Cümle başındaki büyük harf özel ad sayılmaz.
  for (const sentence of summary.normalize("NFC").split(/(?<=[.!?])\s+/)) {
    const words = sentence.match(/[\p{L}'’]+/gu) ?? [];
    words.forEach((raw, i) => {
      if (i === 0) return;
      const word = stripSuffix(raw);
      if (word.length < 2 || !/^\p{Lu}/u.test(word)) return;
      if (!stemIn(word, src, lang)) add(word);
    });
  }
  return out;
}
