/**
 * Envanter metin taslakları için admin önerileri: mimari bölümün yeri ve yapım yılı. Hiçbiri kendiliğinden
 * uygulanmaz; admin önerilen paragrafları ve cümleyi kitapla karşılaştırıp kabul eder ya da düzeltir.
 *
 * Mimari: envanter kitaplarında mimari tanım tarihçenin ortasında tek blok halinde durur (tarihçe → mimari →
 * onarımlar ve bugünkü kullanım). Her paragraf mimari sözcüklerle artı, tarihî/onarım sözcükleri ve yıllarla eksi
 * puan alır; toplamı en yüksek ardışık blok önerilir. Yayındaki 19 Bursa eserinde blok başlangıcı 16'sında tam,
 * 17'sinde en fazla bir paragraf kayık bulundu (22 Ekim).
 */
import { splitReadAlong } from "./sentences";

export type SuggestLang = "tr" | "en";

/** Boş satırla ayrılmış paragraflar (metin olduğu gibi; taşırken geri birleştirilir). */
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Sözcük başına eşleşen kökler (ardından herhangi bir ek gelebilir). */
const stems = (list: string[]) => new RegExp(`(?<![\\p{L}])(?:${list.join("|")})\\p{L}*`, "gu");
/** Tam sözcükler. */
const words = (list: string[]) => new RegExp(`(?<![\\p{L}])(?:${list.join("|")})(?![\\p{L}])`, "gu");

const ARCH: Record<SuggestLang, RegExp[]> = {
  tr: [
    stems(["plan", "kubbe", "minare", "cephe", "mihrab", "mihrap", "minber", "revak", "kemer", "örtü", "duvar",
      "son cemaat", "harim", "taç kapı", "pencere", "sıra", "moloz", "kesme taş", "tuğla", "almaşık", "tonoz",
      "pandantif", "tromp", "kasnak", "şerefe", "avlu", "eyvan", "ölçü", "boyut", "metre", "çatı", "kiremit",
      "sütun", "paye", "mukarnas", "bezeme", "süsleme", "çini", "kalem işi", "ahşap", "mermer", "zemin", "kat",
      "oda", "hücre", "giriş", "kapı", "mekân", "dikdörtgen", "kare", "sekizgen", "kavsara", "silme", "korkuluk",
      "merdiven", "örgü", "gövde", "kaide", "külah", "saçak", "cumba", "sofa"]),
    /\d\s*(?:m|cm|metre)(?![\p{L}])/gu,
  ],
  en: [
    stems(["plan", "dome", "minaret", "facade", "façade", "mihrab", "minbar", "portico", "arch", "vault", "wall",
      "narthex", "last congregation", "prayer hall", "portal", "window", "rubble", "cut stone", "brick", "alternat",
      "pendentive", "squinch", "drum", "balcon", "courtyard", "iwan", "eyvan", "dimension", "metre", "meter", "roof",
      "tile", "column", "pier", "muqarnas", "decorat", "ornament", "wood", "marble", "floor", "stor", "room", "cell",
      "entrance", "door", "space", "rectangular", "square", "octagonal", "molding", "moulding", "railing", "stair",
      "masonry", "body", "base", "cone", "eave"]),
    /\d\s*(?:m|cm|metres?|meters?)(?![\p{L}])/gu,
  ],
};

const HISTORY: Record<SuggestLang, RegExp[]> = {
  tr: [
    stems(["inşa ettir", "yaptır", "vakf", "vakıf", "yüzyıl", "tarihli", "sultan", "padişah", "paşa", "gazi", "oğlu",
      "kızı", "vefat", "defnedil", "kayıt", "kaynak", "belge", "rivayet", "evliya çelebi", "seyyah", "dönem"]),
    words(["bey", "han", "yılında"]),
    /(?<![\p{L}])[HM]\.\s*\d/gu,
  ],
  en: [
    stems(["commission", "endow", "waqf", "century", "dated", "sultan", "pasha", "gazi", "ghazi", "died", "buried",
      "record", "source", "document", "legend", "evliya", "traveller", "traveler", "period", "reign", "founder"]),
    words(["bey", "han", "khan", "son", "daughter", "built by"]),
    /(?<![\p{L}])(?:AH|AD)\s*\d/gu,
  ],
};

/** Onarım ve bugünkü kullanım: mimari bloğun ardından gelen tarihçe. */
const LATER: Record<SuggestLang, RegExp[]> = {
  tr: [
    stems(["onar", "tamir", "restor", "tadilat", "ihya", "günümüzde", "bugün", "kullanılmak", "koruma altı", "unesco",
      "harap", "yangın", "deprem", "esnaf", "ziyarete", "ibadete açık", "belediye", "vakıflar genel", "vakıflar bölge"]),
  ],
  en: [
    stems(["repair", "restor", "renovat", "today", "currently", "nowadays", "used as", "protection", "unesco", "ruin",
      "fire", "earthquake", "tradesm", "shopkeeper", "municipal", "general directorate", "regional directorate"]),
  ],
};

const YEAR = /(?<!\d)(?:1\d{3}|20[0-2]\d)(?!\d)/gu;

const count = (res: RegExp[], text: string) => res.reduce((n, re) => n + (text.match(re)?.length ?? 0), 0);

/** Paragrafın mimari puanı (100 sözcük başına): artı mimari, eksi tarih/onarım/yıl. */
export function architectureScore(paragraph: string, lang: SuggestLang): number {
  const low = paragraph.toLocaleLowerCase(lang === "tr" ? "tr" : "en");
  const wordCount = Math.max(paragraph.split(/\s+/).length, 1);
  const score =
    count(ARCH[lang], low) -
    count(HISTORY[lang], lang === "tr" ? paragraph.replace(/(?<![\p{L}])([hm])\./gu, (m) => m.toUpperCase()) : paragraph) -
    count(LATER[lang], low) -
    2 * (paragraph.match(YEAR)?.length ?? 0);
  return (score / wordCount) * 100;
}

export interface ArchitectureSuggestion {
  /** İlk mimari paragraf (dahil). */
  start: number;
  /** Bloğun sonu (hariç). */
  end: number;
}

/**
 * Mimari bölüm olması en olası ardışık paragraf bloğu. Blok mimari puanı artı değilse ya da metin tek
 * paragrafsa öneri yoktur.
 */
export function suggestArchitecture(paragraphs: string[], lang: SuggestLang): ArchitectureSuggestion | null {
  const s = paragraphs.map((p) => architectureScore(p, lang));
  if (s.length < 2) return null;
  const total = s.reduce((a, b) => a + b, 0);
  // blok içi toplam − blok dışı toplam = 2·(blok toplamı) − tümü; en büyük toplamlı alt dizi (Kadane).
  let best: ArchitectureSuggestion | null = null;
  let bestSum = -Infinity;
  let run = 0;
  let runStart = 0;
  s.forEach((v, i) => {
    if (run <= 0) {
      run = v;
      runStart = i;
    } else run += v;
    if (run > bestSum) {
      bestSum = run;
      best = { start: runStart, end: i + 1 };
    }
  });
  if (!best || bestSum <= 0 || 2 * bestSum - total <= 0) return null;
  return best;
}

export interface BuiltYearSuggestion {
  year: number;
  /** Yılın geçtiği kitap cümlesi (admin kanıt olarak görür). */
  sentence: string;
}

const BUILD = /(?<![\p{L}])(?:inşa|yaptır|yapıl|bina ettir|tamamlan|kurul|yapımı)\p{L}*/iu;
/** Yapımla değil sonraki bir olayla ilgili cümleler. */
const NOT_BUILD = /(?<![\p{L}])(?:yeniden inşa|onar|tamir|restor|vefat|yıkıl|yıktır|deprem|yangın|ihya|tayin|tadilat)\p{L}*/iu;
/** Hicrî tarih ("H. 802 /", "H. 17 Recep 1082 /"): miladi karşılığından önce atlanır. */
const HIJRI = /(?<![\p{L}])H\.\s*[^/]{1,40}\/\s*/gu;
const MILADI = /(?<![\p{L}])M\.\s*(?:\d{1,2}\s+\p{L}+\s+)?(\d{4})/u;

/**
 * Türkçe metinden yapım yılı önerileri (en fazla 3, metindeki sırayla): yapım fiili ve miladi yıl geçen, onarım
 * ya da vefat anlatmayan cümleler. "M." ile verilen yıl önceliklidir; hicrî yıllar sayılmaz.
 */
export function suggestBuiltYears(text: string, limit = 3): BuiltYearSuggestion[] {
  const out: BuiltYearSuggestion[] = [];
  for (const sentence of splitReadAlong(text).flat()) {
    if (!BUILD.test(sentence) || NOT_BUILD.test(sentence)) continue;
    const plain = sentence.replace(HIJRI, "");
    const year = Number(plain.match(MILADI)?.[1] ?? plain.match(YEAR)?.[0] ?? NaN);
    if (!Number.isInteger(year) || year < 1000 || year > 2100 || out.some((o) => o.year === year)) continue;
    out.push({ year, sentence });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Önerilen (ya da admin'in seçtiği) paragrafları tarihçeden mimariye taşır; sıra korunur. Mimari alanda zaten
 * metin varsa taşınanlar onun sonuna eklenir.
 */
export function moveToArchitecture(history: string, architecture: string, picked: Set<number>): { history: string; architecture: string } {
  const paras = paragraphsOf(history);
  const keep = paras.filter((_, i) => !picked.has(i));
  const moved = paras.filter((_, i) => picked.has(i));
  return {
    history: keep.join("\n\n"),
    architecture: [...paragraphsOf(architecture), ...moved].join("\n\n"),
  };
}
