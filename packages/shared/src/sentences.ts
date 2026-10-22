/**
 * Eşli okuma için metni paragraflara, paragrafları cümlelere böler: her cümle ayrı seslendirilir ve okunurken
 * ekranda vurgulanır. Envanter metnindeki sıra sayıları (II. Murad, 14. yüzyıl) ve kısaltmalar (H. 740, Hz., s. 12)
 * cümle sonu sayılmaz. Parçalar birleşince (boşluklar sadeleşmiş) metnin tamamı geri gelir.
 */
const ABBREVIATIONS = new Set(["hz", "bkz", "bk", "vb", "vs", "yy", "sh", "st", "dr", "prof", "no", "nr", "çev", "haz", "yay", "ö", "öl"]);
const ROMAN = /^[IVXLC]+$/;
/** Cümle sonu: nokta, ünlem, soru, üç nokta; ardından kapanan tırnak/parantez olabilir. */
const END = /[.!?…]+["”’»)]*\s+/gu;
const STARTS_SENTENCE = /^[\p{Lu}\d"“‘«(]/u;

function endsWithAbbreviation(before: string): boolean {
  const word = before.slice(before.lastIndexOf(" ") + 1).replace(/^[("“‘«]+/u, "");
  if (word.length === 1) return true; // baş harf ya da H./M./s.
  return ROMAN.test(word) || ABBREVIATIONS.has(word.toLocaleLowerCase("tr"));
}

function sentencesOf(paragraph: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of paragraph.matchAll(END)) {
    const cut = m.index + m[0].trimEnd().length;
    const next = paragraph.slice(m.index + m[0].length);
    if (!STARTS_SENTENCE.test(next)) continue;
    if (m[0].startsWith(".") && m[0].trimEnd() === "." && endsWithAbbreviation(paragraph.slice(start, m.index))) continue;
    out.push(paragraph.slice(start, cut));
    start = m.index + m[0].length;
  }
  const rest = paragraph.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

export function splitReadAlong(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map(sentencesOf);
}
