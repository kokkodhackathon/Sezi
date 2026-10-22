"""Envanter kitaplarındaki eser metinlerini TASLAK olarak text_drafts tablosuna aktaran SQL üretir.

Metinler Vakıf Katılım'ın envanter kitaplarından gelir; hackathon kapsamında organizasyonca
paylaşılmış veri setidir. Hiçbir şey otomatik yayınlanmaz: yalnız taslak (status='pending') yazılır,
yayına alma kararı admin panelindeki eşleştirme masasındadır. Her taslak kitap, cilt ve sayfa ile atfedilir.

Yöntem:
  - Her eserin metni kendi basılı sayfasından bir sonraki eserin sayfasının öncesine kadardır (en çok 8 sayfa).
  - PDF "çift sayfa yayılımı"dır (bir PDF sayfasında iki basılı sayfa); basılı numara = 2 × PDF dizini + kitaba özgü sabit.
  - Gövde metni yazı boyutuyla ayrılır (başlık, altyazı, sayfa numarası, dikey ilçe harfleri atılır), kalan bloklar
    sözcük ve Türkçe harf puanıyla TR ya da EN diye sınıflanır. Kararsız blok atılır ve uyarı olarak yazılır.
  - Bursa ciltlerindeki bozuk glifler düzeltilir (ş → "!", Ş/İ → "%", ff → "%").
  - TR metnin ilk cümlesi adres cümlesiyse address alanına alınır ve gövdeden çıkarılır; mimari ayrımı yapılmaz.

Girdi:  data/out/inventory_toc.json, data/raw/books/*.pdf (gitignore'da)
Çıktı:  supabase/seed_text_drafts_01.sql … _NN.sql (her biri ≤ ~500 KB; sorgu boyut sınırı yüzünden parçalı) ve
        seed_text_drafts_cleanup.sql (son uygulanır; artık üretilmeyen bekleyen taslakları siler). Yeniden çalıştırılabilir;
        yalnız status='pending' satırları günceller/siler.
Gerekli: pymupdf (kullanıcı site-packages'ında; -I altında yola eklenir)
Kullanım:  python -I data/inventory_texts.py
"""

import json
import re
import site
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
site.addsitedir(site.getusersitepackages())
import pymupdf  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent))
from inventory_import import slugify  # noqa: E402
from inventory_toc import BOOK_DEFS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / "data/out/inventory_toc.json"
BOOKS = ROOT / "data/raw/books"
OUT_DIR = ROOT / "supabase"
PART_BYTES = 500_000  # uzak sorgu boyut sınırı (413) yüzünden çıktı parçalara bölünür

MAX_PAGES = 8  # bir eserin en çok kaç basılı sayfa okunacağı
# Yazı tipine göre okunan kitaplarda bitiş sonraki eserin başlığıyla kesin bulunur; sınır yalnız güvenlik içindir
# (Ulucami gibi uzun eserler 8 sayfayı aşıyor).
MAX_PAGES_FONTS = 24
TRANSLATION_PARA = re.compile(r"^(Mealen|Bu kitabenin meali|Translation|Meaning|It reads|Which reads|The inscription reads)\b[^:]{0,20}:")
SIZE_TOLERANCE = 0.9  # gövde yazı boyutundan en çok bu kadar sapan bloklar gövdedir
CACHE = ROOT / "data/raw/texts_cache"
CACHE_VERSION = 2  # ayrıştırma kuralları (temizlik, boyut süzgeci) değişince artırın

TR_WORDS = set("ve bir ile olarak bu için da de olan en çok daha gibi kadar ise yer yapı yapının camii camiinin sonra ancak ayrıca ise üzerinde içinde tarafından olup olduğu bulunmaktadır almaktadır edilmiştir yaptırılmıştır".split())
EN_WORDS = set("the and of is was in to with by as for on that which are were it has have from at an this its be been also there their his her located built mosque tomb complex madrasa which during between under after into one two other these those can may not or but when where who while than only most more".split())
TR_CHARS = re.compile(r"[ıİğĞşŞ]")
TR_SUFFIX = re.compile(r"(dır|dir|dur|dür|tır|tir|mış|miş|muş|müş|ları|leri|ında|inde|unda|ünde|ması|mesi|lığı|liği|yla|yle)$")


# ---------- Metin temizliği ----------

LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl", "\xa0": " ", "­": ""}
# "%" sonrası bu kalıplar → Ş; diğerleri (İbrahim, İsa, İznik, İmaret…) → İ
SH_AFTER = re.compile(r"^(e|ub|ul|u\b|ö|â|imdi|a(h|m|ir))")


def fix_bursa(s: str) -> str:
    """Bursa ciltlerinin gömülü yazı tipi: küçük ş → "!", büyük Ş/İ → "%", ff → "%"."""

    def percent(m: re.Match) -> str:
        i = m.start()
        prev = s[i - 1] if i else ""
        nxt = s[i + 1] if i + 1 < len(s) else ""
        if prev.isdigit() or nxt.isdigit():
            return "%"  # gerçek yüzde işareti
        if prev.islower():
            return "ff"  # di%erent, sta%
        if prev.isupper():
            return "İ"  # CAM%LER
        return "Ş" if SH_AFTER.match(s[i + 1 : i + 8].lower()) else "İ"

    def bang(m: re.Match) -> str:
        i = m.start()
        nxt = s[i + 1] if i + 1 < len(s) else ""
        # Gerçek ünlem: metin sonu, kapanış tırnağı öncesi ya da "Haqq!" zikri
        return "!" if nxt in ("", "”", '"') or s[i - 1 : i] == "q" else "ş"

    s = re.sub(r"%", percent, s)
    return re.sub(r"!", bang, s)


def clean_text(raw: str, bursa: bool) -> str:
    """Bloğun satırlarını tek paragrafa birleştirir (satır sonu tirelemesi dahil)."""
    for k, v in LIGATURES.items():
        raw = raw.replace(k, v)
    lines = [re.sub(r"\s+", " ", l).strip() for l in raw.split("\n")]
    out = ""
    for l in filter(None, lines):
        if out.endswith("-") and l[:1].islower() and len(out) > 1 and out[-2].isalpha():
            out = out[:-1] + l
        else:
            out = f"{out} {l}" if out else l
    out = out.strip()
    return fix_bursa(out) if bursa else out


def lang_scores(text: str) -> tuple[int, int]:
    words = re.findall(r"[^\W\d_]+", text.replace("İ", "i").lower())
    tr = sum(w in TR_WORDS or (len(w) > 5 and bool(TR_SUFFIX.search(w))) for w in words) + len(TR_CHARS.findall(text))
    en = sum(w in EN_WORDS for w in words)
    return tr, en


# ---------- PDF okuma ----------


def printed_offset(doc) -> int:
    """Basılı sol sayfa = 2 × PDF dizini + sabit. Sabit, üst/alt köşelerdeki numaraların çoğunluğundan bulunur."""
    votes = Counter()
    for i, page in enumerate(doc):
        w = page.rect.width
        if w < 1000:
            continue
        for x0, y0, _x1, _y1, text, *_ in page.get_text("words"):
            if (y0 < 80 or y0 > 800) and re.fullmatch(r"\d{1,3}", text) and x0 < w * 0.25:
                votes[int(text) - 2 * i] += 1
    return votes.most_common(1)[0][0]


def read_book(path: Path, bursa: bool):
    """Basılı sayfa → gövde blokları [(y0, x0, metin)]; ayrıca ölçüm sayaçları. Sonuç data/raw/ altında önbelleğe alınır."""
    cache = CACHE / f"{path.stem}.json"
    stamp = [path.stat().st_size, path.stat().st_mtime_ns, CACHE_VERSION]
    if cache.exists():
        c = json.loads(cache.read_text(encoding="utf-8"))
        if c["stamp"] == stamp:
            return {int(k): [tuple(b) for b in v] for k, v in c["pages"].items()}, {int(k): v for k, v in c["titles"].items()}, c["info"]
    pages, titles, info = parse_book(path, bursa)
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"stamp": stamp, "pages": pages, "titles": titles, "info": info}, ensure_ascii=False), encoding="utf-8")
    return pages, titles, info


def parse_book(path: Path, bursa: bool):
    doc = pymupdf.open(path)
    off = printed_offset(doc)
    sizes = Counter()
    raw = []  # (printed, y0, x0, size, text)
    for i, page in enumerate(doc):
        w = page.rect.width
        if w < 1000:
            continue
        for b in page.get_text("dict")["blocks"]:
            if b["type"] != 0:
                continue
            spans = [s for l in b["lines"] for s in l["spans"]]
            n = sum(len(s["text"].strip()) for s in spans)
            if not n:
                continue
            size = sum(s["size"] * len(s["text"].strip()) for s in spans) / n
            sizes[round(size)] += n
            text = "\n".join("".join(s["text"] for s in l["spans"]) for l in b["lines"])
            x0, y0, x1, _ = b["bbox"]
            raw.append((2 * i + off + (0 if (x0 + x1) / 2 < w / 2 else 1), y0, x0, size, text))
    body = sizes.most_common(1)[0][0]
    pages: dict[int, list] = {}
    titles: dict[int, list] = {}  # basılı sayfa → büyük puntolu başlık metinleri (eserin gerçek başlangıç sayfasını bulmak için)
    for printed, y0, x0, size, text in raw:
        if size > body + 8:
            titles.setdefault(printed, []).append(re.sub(r"\s+", " ", text).strip())
            continue
        if abs(size - body) > SIZE_TOLERANCE:
            continue  # başlık, altyazı, sayfa numarası, dikey ilçe harfleri
        t = clean_text(text, bursa)
        letters = [c for c in t if c.isalpha()]
        if len(t) < 3 or not letters or all(c.isupper() for c in letters):
            continue
        pages.setdefault(printed, []).append((y0, x0, t))
    return pages, titles, {"offset": off, "body_size": body, "pdf_pages": len(doc)}


# ---------- Cümle ve adres ----------

NO_SPLIT = re.compile(r"(^|\s)([IVX]+|\d{1,2}|[A-ZÇĞİÖŞÜ]|No|Cd|Sk|Mah|Dr|Hz|Prof|Doç|St|Ave|Blvd|Bul|Sok|vb|vs|bk|Çev|AH|AD|MÖ|MS|M|Ö)$")


def first_sentence(par: str) -> tuple[str, str]:
    """Paragrafın ilk cümlesi ve kalanı. Roma rakamı ve kısaltma noktaları cümle sonu sayılmaz."""
    for m in re.finditer(r"[.!?…][”’\"')]*\s+(?=[A-ZÇĞİÖŞÜ“\"‘(])", par):
        head = par[: m.start()]
        if NO_SPLIT.search(head):
            continue
        return par[: m.end()].strip(), par[m.end() :].strip()
    return par, ""


TR_ADDR_PLACE = re.compile(r"(ilçe|mahalle|sokak|sokağı|cadde|köy|belde|kasaba|mevki|parsel|mıntıka|meydan|bulvar|merkez|yolu)", re.I)
# Cümlenin yüklemi konum bildirmeli (bulunmaktadır, yer almaktadır, …üzerindedir, …Mahallesi’ndedir); tarih/özellik cümleleri adres değildir.
TR_ADDR_VERB = re.compile(r"(bulunmaktadır|almaktadır|yer alır|bulunur|konumlanmaktadır|konumlanır|\w*(?<!mak)(?<!mek)[dt][ae][dt][ıiuü]r)[.]?$")
EN_ADDR = re.compile(r"(located|situated|lies|stands|found|sits)", re.I)
EN_ADDR_PLACE = re.compile(r"(District|Neighborhood|Neighbourhood|Street|Avenue|Boulevard|Village|Square|plot|parcel|Quarter)", re.I)


ADDR_PARTS = [re.compile(x, re.I) for x in ("ilçe", "mahalle", "sokak|sokağı|cadde", "parsel", "köy", "mıntıka")]


def is_tr_address_loose(s: str) -> bool:
    """Yüklemi konum bildirmeyen ama adres öğeleri (ilçe, mahalle, sokak, parsel…) taşıyan cümle; Hatay metinleri gibi serbest anlatımlar için."""
    return len(s) < 260 and sum(bool(p.search(s)) for p in ADDR_PARTS) >= 2


def is_tr_address(s: str) -> bool:
    return len(s) < 300 and bool(TR_ADDR_PLACE.search(s)) and bool(TR_ADDR_VERB.search(s.strip()))


def is_en_address(s: str) -> bool:
    return len(s) < 450 and bool(EN_ADDR.search(s)) and bool(EN_ADDR_PLACE.search(s))


def pull_address(paras: list[str], test) -> tuple[str | None, list[str]]:
    """İlk paragrafın ilk cümlesi adres ise ayırır; kalan paragrafları döndürür."""
    if not paras:
        return None, paras
    sent, rest = first_sentence(paras[0])
    if not test(sent):
        return None, paras
    return sent, ([rest] if rest else []) + paras[1:]


# ---------- Eserin metni ----------


def classify(blocks):
    """Okuma sırasında (sayfa, y, x) bloklarını TR / EN / sınıflanamayan diye ayırır; sayfalar arası kesik cümleyi birleştirir."""
    out = {"tr": [], "en": []}
    unclassified = 0
    for page, _y, _x, text in blocks:
        tr, en = lang_scores(text)
        if tr == en:
            unclassified += 1
            continue
        paras = out["tr" if tr > en else "en"]
        # Önceki paragraf cümle ortasında bittiyse (sayfa/sütun geçişi) bu blok devamıdır.
        if paras and not re.search(r"[.!?…:;”’\"')]$", paras[-1]) and text[:1].islower():
            paras[-1] = f"{paras[-1]} {text}"
        else:
            paras.append(text)
    return out, unclassified


def reading_order(page: int, blocks):
    """Sayfadaki blokları sütun (soldan sağa), sonra yukarıdan aşağı sıralar. Sütun: x0 değerleri arası 40 ptten büyük boşluk."""
    xs = sorted({x for _y, x, _t in blocks})
    col, cols, prev = 0, {}, None
    for x in xs:
        if prev is not None and x - prev > 40:
            col += 1
        cols[x] = col
        prev = x
    return [(page, y, x, t) for (y, x, t) in sorted(blocks, key=lambda b: (cols[b[1]], b[0]))]


def join_body(paras: list[str]) -> str:
    return "\n\n".join(paras)


# ---------- Yazı tipine göre okuma (Bursa ciltleri) ----------
#
# Bursa ciltlerinde düzen yazı tipiyle kesin ayrılır (üç ciltte aynı):
#   Türkçe gövde BrandonGrotesque-Regular 11 pt, İngilizce gövde -Light 11 pt, kitabe/belge alıntısı -LightIt,
#   alt bölüm başlıkları -Black / -Medium 14–15 pt (büyük harf), eser başlığı Acuta-Bold ~29 pt.
# Böylece dil tahmini gerekmez; kitabe alıntıları ayıklanır; metin sonraki eserin başlığında biter; külliye
# bölümlerinin başlıkları korunur.

FONT_CITIES = {"Bursa"}
FONT_CACHE_VERSION = 3
INSCRIPTION_WORDS = 6  # bu kadar ve daha uzun italik alıntı kitabe/belge metnidir, "[…]" ile çıkarılır
NAME_NOISE = set("ve and the of graveyard mosque tomb bath complex madrasa fountain inn han".split())


def span_kind(font: str, size: float) -> str | None:
    f = font.split("+")[-1]
    if "Acuta" in f and size > 24:
        return "title"
    if ("Black" in f or "Medium" in f) and 13.5 <= size <= 16.5:
        return "head"
    if 10.4 <= size <= 11.6:
        if f.endswith("It") or "Italic" in f:
            return "italic"
        if f.endswith("Regular"):
            return "tr"
        if f.endswith("Light"):
            return "en"
    return None


def body_text(lines: list[list[tuple[str, str]]], bursa: bool) -> tuple[str, str | None, int]:
    """Bir bloğun satırlarından gövde metni, dili ve çıkarılan kitabe alıntısı sayısı. İtalik parçalar \x01…\x02 ile
    işaretlenir; satırlar arası ardışık italik tek alıntı sayılır."""
    counts = Counter()
    raw_lines = []
    for spans in lines:
        out = ""
        for kind, text in spans:
            if kind == "italic":
                out += f"\x01{text}\x02"
            elif kind in ("tr", "en"):
                counts[kind] += len(text.strip())
                out += text
        raw_lines.append(out)
    raw = "\n".join(raw_lines)
    raw = re.sub(r"\x02(\s*)\x01", r"\1", raw)
    removed = 0

    def quote(m: re.Match) -> str:
        nonlocal removed
        inner = m.group(1)
        if len(inner.split()) >= INSCRIPTION_WORDS:
            removed += 1
            return "[…]"
        return inner

    raw = re.sub(r"\x01(.*?)\x02", quote, raw, flags=re.S)
    text = clean_text(raw, bursa)
    text = re.sub(r"[“\"]\s*\[…\]\s*[”\"]?", "[…]", text)
    text = re.sub(r"(\[…\]\s*)+", "[…] ", text).strip()
    lang = None if not counts else ("tr" if counts["tr"] >= counts["en"] else "en")
    if not re.sub(r"[\[\]…\s“”\"'’.,;:-]", "", text):
        return "", None, removed
    return text, lang, removed


def read_book_fonts(path: Path, bursa: bool):
    """Kitabı okuma sırasında öğe akışına çevirir: (basılı sayfa, tür, dil, metin, çıkarılan kitabe). Önbellekli."""
    cache = CACHE / f"{path.stem}.fonts.json"
    stamp = [path.stat().st_size, path.stat().st_mtime_ns, FONT_CACHE_VERSION, CACHE_VERSION]
    if cache.exists():
        c = json.loads(cache.read_text(encoding="utf-8"))
        if c["stamp"] == stamp:
            return [tuple(x) for x in c["stream"]], c["info"]
    doc = pymupdf.open(path)
    off = printed_offset(doc)
    per_page: dict[int, list] = {}
    for i, page in enumerate(doc):
        w = page.rect.width
        if w < 1000:
            continue
        for b in page.get_text("dict")["blocks"]:
            if b["type"] != 0:
                continue
            lines = [[(span_kind(s["font"], s["size"]), s["text"]) for s in l["spans"] if s["text"].strip()] for l in b["lines"]]
            lines = [l for l in lines if l]
            kinds = {k for l in lines for k, _ in l}
            x0, y0, x1, _ = b["bbox"]
            printed = 2 * i + off + (0 if (x0 + x1) / 2 < w / 2 else 1)
            if kinds & {"title", "head"} and not kinds & {"tr", "en"}:
                kind = "title" if "title" in kinds else "head"
                text = re.sub(r"\s+", " ", " ".join(t for l in lines for k, t in l if k == kind)).strip()
                for k, v in LIGATURES.items():
                    text = text.replace(k, v)
                text = fix_bursa(text) if bursa else text
                if text:
                    per_page.setdefault(printed, []).append((y0, x0, kind, None, text, 0))
                continue
            if not kinds & {"tr", "en", "italic"}:
                continue
            text, lang, removed = body_text(lines, bursa)
            if text:
                # Dil yoksa (yalnız kısa italik: ayet, kısa alıntı) akıştaki komşudan alınır: fill_langs.
                per_page.setdefault(printed, []).append((y0, x0, "body", lang, text, removed))
            elif removed:
                per_page.setdefault(printed, []).append((y0, x0, "removed", None, "", removed))
    stream = []
    for printed in sorted(per_page):
        for _page, y, x, item in sorted_columns(printed, per_page[printed]):
            stream.append((printed, *item))
    stream, filled, dropped = fill_langs(stream)
    info = {"offset": off, "pdf_pages": len(doc), "lang_from_context": filled, "dropped": dropped}
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"stamp": stamp, "stream": stream, "info": info}, ensure_ascii=False), encoding="utf-8")
    return stream, info


def fill_langs(stream):
    """Dili belirsiz gövde blokları (yalnız kısa italik) aynı sayfadaki önceki, yoksa sonraki gövde bloğunun dilini
    alır; aynı sayfada dilli blok yoksa "dropped" olur (sessizce kaybolmaz, eserin uyarılarına `unclassified_blocks`
    olarak düşer). Dönüş: (akış, komşudan dil alan sayısı, atılan sayısı)."""
    out = list(stream)
    filled = dropped = 0
    for i, (pg, kind, lang, text, rm) in enumerate(out):
        if kind != "body" or lang:
            continue
        near = [j for j in range(i - 1, -1, -1) if out[j][0] == pg] + [j for j in range(i + 1, len(out)) if out[j][0] == pg]
        found = next((out[j][2] for j in near if out[j][1] == "body" and out[j][2]), None)
        if found:
            out[i] = (pg, kind, found, text, rm)
            filled += 1
        else:
            out[i] = (pg, "dropped", None, text, rm)
            dropped += 1
    return out, filled, dropped


def sorted_columns(page: int, items):
    """reading_order ile aynı sütun kuralı; öğenin geri kalanını taşır."""
    xs = sorted({x for _y, x, *_ in items})
    col, cols, prev = 0, {}, None
    for x in xs:
        if prev is not None and x - prev > 40:
            col += 1
        cols[x] = col
        prev = x
    return [(page, y, x, rest) for (y, x, *rest) in sorted(items, key=lambda it: (cols[it[1]], it[0]))]


def head_langs(stream) -> list[str | None]:
    """Başlığın dili: akışta ondan sonra gelen ilk gövde bloğunun dili (TR başlık TR metinden önce gelir)."""
    langs: list[str | None] = [None] * len(stream)
    nxt = None
    for i in range(len(stream) - 1, -1, -1):
        _p, kind, lang, *_ = stream[i]
        if kind == "body":
            nxt = lang
        elif kind in ("head", "title"):
            langs[i] = nxt
    return langs


def name_tokens(s: str) -> set[str]:
    return {t for t in slugify(s).split("-") if t and t not in NAME_NOISE}


def match_score(name: str, heading: str) -> tuple[float, float]:
    n, h = name_tokens(name), name_tokens(heading)
    if not n or not h:
        return 0.0, 0.0
    common = len(n & h)
    return common / len(n), common / len(h)


SMALL_WORDS = {"ve", "ile", "and", "of", "the", "in", "de", "da"}


def heading_case(s: str, lang: str) -> str:
    """BÜYÜK HARF başlığı okunur biçime çevirir (Türkçe i/İ, Roma rakamları ve bağlaçlar korunur)."""
    def word(w: str, first: bool) -> str:
        if re.fullmatch(r"[IVXLC]+\.?", w):
            return w
        # İngilizce başlıkta da Türkçe adlar geçer: "İ" noktalı i olur (birleşik nokta karakteri bırakmadan).
        low = w.replace("I", "ı").replace("İ", "i").lower() if lang == "tr" else w.replace("İ", "i").lower()
        if not first and low in SMALL_WORDS:
            return low
        head = low[:1]
        head = "İ" if head == "i" and lang == "tr" else head.upper()
        return head + low[1:]

    parts = re.split(r"(\s+|[-(/])", s.strip())
    out, first = [], True
    for p in parts:
        if p and not re.fullmatch(r"\s+|[-(/]", p):
            out.append(word(p, first))
            first = False
        else:
            out.append(p)
    return "".join(out)

def nice_heading(text: str, lang: str) -> str:
    return heading_case(text, lang) if text == text.upper() else text


def plan_by_fonts(items, url, path, bursa, left_of, pdf_of, st, add_row):
    """Yazı tipi akışıyla her eserin metnini bulur.

    Başlangıç: eserin adına uyan TR alt başlık ya da eser başlığı (içindekiler sayfası ±1 yayılım içinde); yoksa
    içindekiler sayfasının ilk öğesi. Bitiş: sonraki eserin başlangıcı ya da sonraki sayfalardaki yeni eser başlığı
    (Acuta). Aradaki diğer alt başlıklar (külliye bölümleri) paragraf olarak korunur; kitabe alıntıları "[…]" olur.
    """
    stream, info = read_book_fonts(path, bursa)
    print(f"  yazı tipi akışı: {len(stream)} öğe, dili komşudan alınan kısa italik blok {info['lang_from_context']}, atılan {info['dropped']}", file=sys.stderr)
    langs = head_langs(stream)

    def first_index(page: int) -> int:
        for i, it in enumerate(stream):
            if it[0] >= page:
                return i
        return len(stream)

    def find_anchor(r, lo: int, hi: int, mutual: float = 0.0):
        best = None
        for i, (pg, kind, _lang, text, _rm) in enumerate(stream):
            if pg < lo or pg > hi or kind not in ("head", "title") or langs[i] == "en":
                continue
            score = match_score(r["name_tr"], text)
            if score[0] >= 0.75 and score[1] >= mutual and (best is None or score > best[0]):
                best = (score, i)
        return best

    for r in items:
        # Önce içindekiler sayfasının yayılımı; bulunamazsa (içindekiler sayfası kaymış) sonraki birkaç sayfada
        # yalnız iki yönlü güçlü eşleşme ("Paşa Camii" gibi genel ad başka eserin başlığına bağlanmasın).
        best = find_anchor(r, left_of(r["page"]), r["page"] + 1) or find_anchor(r, r["page"] + 2, r["page"] + 12, mutual=0.75)
        r["anchor"] = best[1] if best else None
        r["cut"] = best[1] if best else first_index(r["start"])
        r["from"] = r["cut"] + 1 if best else r["cut"]

    cuts = sorted({r["cut"] for r in items})
    titles = [i for i, it in enumerate(stream) if it[1] == "title"]

    for r in items:
        st["entries"] += 1
        warnings = []
        start = r["from"]
        if start >= len(stream):
            st["skipped"] += 1
            continue
        start_page = stream[start][0]
        later = [c for c in cuts if c > r["cut"]] + [t for t in titles if t > r["cut"] and stream[t][0] > start_page]
        end = min(later) if later else len(stream)
        if not later:
            warnings.append("range_capped")
        last_page = start_page + MAX_PAGES_FONTS - 1
        if any(stream[i][0] > last_page for i in range(start, end)):
            warnings.append("range_capped")
            end = next(i for i in range(start, end) if stream[i][0] > last_page)
        if sum(1 for x in items if x["cut"] == r["cut"]) > 1:
            warnings.append("shared_page")
        if r.get("needs_review"):
            warnings.append("needs_review_entry")
        if r["anchor"] is None:
            warnings.append("no_heading")

        texts: dict[str, list[str]] = {"tr": [], "en": []}
        seen = {"tr": False, "en": False}
        after_heading = {"tr": False, "en": False}
        en_title = None
        removed = 0
        dropped = 0
        pages_used = [start_page]
        for i in range(start, end):
            pg, kind, lang, text, rm = stream[i]
            removed += rm
            if kind in ("removed", "title"):
                continue
            if kind == "dropped":
                dropped += 1
                continue
            pages_used.append(pg)
            if kind == "head":
                hl = langs[i] or "tr"
                if not seen[hl]:
                    # Metinden önceki başlık eserin kendi adının (ya da İngilizcesinin) tekrarıdır.
                    if hl == "en" and en_title is None:
                        en_title = text
                    continue
                texts[hl].append(nice_heading(text, hl))
                after_heading[hl] = True
                continue
            paras = texts[lang]
            if paras and not after_heading[lang] and not re.search(r"[.!?…:;”’\"')\]]$", paras[-1]) and text[:1].islower():
                paras[-1] = f"{paras[-1]} {text}"
            else:
                paras.append(text)
            seen[lang] = True
            after_heading[lang] = False
        # Kitabe çevirileri alınmaz (ENVANTER.md §5): "Mealen: …" / "Translation: …" paragrafları düz yazıyla basılmış.
        for lang in ("tr", "en"):
            kept = [p for p in texts[lang] if not TRANSLATION_PARA.match(p)]
            removed += len(texts[lang]) - len(kept)
            texts[lang] = kept
        if dropped:
            warnings.append("unclassified_blocks")
        if removed:
            warnings.append("inscription_removed")
        book_title = None
        if r["anchor"] is not None:
            book_title = {"tr": nice_heading(stream[r["anchor"]][3], "tr"), **({"en": nice_heading(en_title, "en")} if en_title else {})}
        add_row(st, r, url, r["start"], max(pages_used), pdf_of(start_page), texts, warnings, book_title)

def main():
    entries = json.loads(IN.read_text(encoding="utf-8"))

    # inventory_import.main ile aynı slug döngüsü (aynı ada -2 eki)
    used = set()
    for r in entries:
        base = slugify(f"{r['city']}-{r['name_tr']}")
        slug, n = base, 2
        while slug in used:
            slug = f"{base}-{n}"
            n += 1
        used.add(slug)
        r["slug"] = slug

    file_of = {b["url"]: b["file"] for b in BOOK_DEFS}
    rows, stats = [], {}
    by_book: dict[str, list] = {}
    for r in entries:
        by_book.setdefault(r["book"]["url"], []).append(r)

    def add_row(st, r, url, page, end, pdf_page, texts, warnings, book_title=None):
        """TR/EN paragraflarından adres + tarihçe taslağı satırı; adres ilk cümleden ayrılır."""
        if not texts["tr"]:
            st["skipped"] += 1
            return
        addr_tr, tr_paras = pull_address(texts["tr"], is_tr_address)
        if addr_tr is None:
            addr_tr, tr_paras = pull_address(texts["tr"], is_tr_address_loose)
            if addr_tr:
                warnings.append("address_loose")
        addr_en, en_paras = pull_address(texts["en"], is_en_address)
        if addr_tr is None:
            warnings.append("no_address")
            addr_en = None
            en_paras = texts["en"]
        tr_body, en_body = join_body(tr_paras), join_body(en_paras)
        tr_len, en_len = len(tr_body) + len(addr_tr or ""), len(en_body) + len(addr_en or "")
        if en_len < 0.5 * tr_len or en_len > 2 * tr_len:
            warnings.append("tr_en_unbalanced")
        address = {"tr": addr_tr, **({"en": addr_en} if addr_en else {})} if addr_tr else None
        history = {"tr": tr_body, **({"en": en_body} if en_body else {})} if tr_body else None
        if address is None and history is None:
            st["skipped"] += 1
            return
        rows.append(
            {
                "slug": r["slug"],
                "book_url": url,
                "page": page,
                "page_end": end if end > page else None,
                "pdf_page": pdf_page,  # metnin başladığı PDF sayfası (1 tabanlı; tarayıcıda #page=)
                "address": address,
                "history": history,
                "architecture": None,
                "warnings": warnings,
                "book_title": book_title,
            }
        )
        st["drafts"] += 1
        st["address"] += bool(address)
        st["address_en"] += bool(addr_en)
        st["tr_len"] += tr_len
        st["en_len"] += en_len
        st["warnings"].update(warnings)

    for url, items in by_book.items():
        b = items[0]["book"]
        label = f"{b['title']}{' c.' + str(b['volume']) if b['volume'] else ''}"
        path = BOOKS / file_of[url]
        if not path.exists():
            print(f"  eksik: {path}", file=sys.stderr)
            continue
        bursa = items[0]["city"] == "Bursa"
        pages, titles, info = read_book(path, bursa)
        print(f"{label}: PDF {info['pdf_pages']} sayfa, basılı sabit {info['offset']:+d} (basılı sol = 2×dizin{info['offset']:+d}), gövde boyutu {info['body_size']}pt", file=sys.stderr)
        left_of = lambda p: p - ((p - info["offset"]) % 2)  # p'nin bulunduğu çift sayfa yayılımının sol sayfası
        pdf_of = lambda p: (p - info["offset"]) // 2 + 1

        def start_of(r):
            """TOC sayfası sağ sayfaysa ve eserin başlığı yayılımın sol sayfasındaysa (Konya) metin sol sayfada başlar."""
            p = r["page"]
            left = left_of(p)
            name = slugify(r["name_tr"])
            on = lambda pg: any(slugify(t) == name for t in titles.get(pg, []))
            return left if left != p and on(left) and not on(p) else p

        for r in items:
            r["start"] = start_of(r)
        st = stats[label] = {"entries": 0, "drafts": 0, "address": 0, "address_en": 0, "tr_len": 0, "en_len": 0, "warnings": Counter(), "skipped": 0}

        if items[0]["city"] in FONT_CITIES:
            plan_by_fonts(items, url, path, bursa, left_of, pdf_of, st, add_row)
            continue

        starts = sorted({x["start"] for x in items})
        for r in items:
            st["entries"] += 1
            p = r["start"]
            later = [s for s in starts if s > p]
            end = (later[0] - 1) if later else p + MAX_PAGES - 1
            end = max(end, p)
            warnings = []
            if end > p + MAX_PAGES - 1:
                end = p + MAX_PAGES - 1
                warnings.append("range_capped")
            elif not later:
                warnings.append("range_capped")
            if sum(1 for x in items if x["start"] == p) > 1:
                warnings.append("shared_page")
            if r.get("needs_review"):
                warnings.append("needs_review_entry")
            blocks = [b for pg in range(p, end + 1) for b in reading_order(pg, pages.get(pg, []))]
            texts, unclassified = classify(blocks)
            if unclassified:
                warnings.append("unclassified_blocks")
            add_row(st, r, url, p, end, pdf_of(p), texts, warnings)

    for old in OUT_DIR.glob("seed_text_drafts*.sql"):
        old.unlink()
    parts, cur, size = [], [], 0
    for r in rows:
        n = len(json.dumps(r, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        if cur and size + n > PART_BYTES:
            parts.append(cur)
            cur, size = [], 0
        cur.append(r)
        size += n
    parts.append(cur)
    header = """-- Otomatik üretildi: data/inventory_texts.py. Elle düzenlemeyin.
-- Kaynak: Vakıf Katılım, Vakıf Eserleri Envanteri (hackathon kapsamında organizasyonca paylaşılan veri seti).
-- Tümü TASLAKTIR (status='pending'); yayına alma admin panelinde yapılır. Yalnız bekleyen ve elle düzenlenmemiş
-- (edited_at boş) satırlar güncellenir/silinir: admin'in düzenlediği taslak yeniden üretimde ezilmez.
"""
    written = []
    for i, part in enumerate(parts, 1):
        data = json.dumps(part, ensure_ascii=False, separators=(",", ":"))
        assert "$json$" not in data
        f = OUT_DIR / f"seed_text_drafts_{i:02d}.sql"
        f.write_text(
            f"""{header}begin;
create temp table td on commit drop as
select * from jsonb_to_recordset($json${data}$json$::jsonb) as d(
  slug text, book_url text, page int, page_end int, pdf_page int, address jsonb, history jsonb, architecture jsonb, warnings jsonb,
  book_title jsonb);

insert into public.text_drafts (work_id, source_id, page, page_end, pdf_page, address, history, architecture, warnings, book_title)
select w.id, s.id, td.page, td.page_end, td.pdf_page, td.address, td.history, td.architecture,
  coalesce(array(select jsonb_array_elements_text(td.warnings)), '{{}}'), td.book_title
from td
join public.works w on w.slug = td.slug
join public.sources s on s.url = td.book_url and s.kind = 'inventory'
on conflict (work_id, source_id, page) do update
set page_end = excluded.page_end, pdf_page = excluded.pdf_page, address = excluded.address, history = excluded.history,
    architecture = excluded.architecture, warnings = excluded.warnings, book_title = excluded.book_title, updated_at = now()
where public.text_drafts.status = 'pending' and public.text_drafts.edited_at is null;

-- Kitaptaki başlık metne dokunmaz: yayınlanmış ve düzenlenmiş taslaklarda da güncellenir (ad önerisi için).
update public.text_drafts t set book_title = td.book_title
from td
join public.works w on w.slug = td.slug
join public.sources s on s.url = td.book_url and s.kind = 'inventory'
where t.work_id = w.id and t.source_id = s.id and t.page = td.page and t.book_title is distinct from td.book_title;
commit;
""",
            encoding="utf-8",
        )
        written.append(f)
    # Son dosya yalnız anahtarlarla temizler: artık üretilmeyen (sayfa aralığı değişmiş vb.) bekleyen taslakları siler.
    keys = json.dumps([{"slug": r["slug"], "book_url": r["book_url"], "page": r["page"]} for r in rows], ensure_ascii=False, separators=(",", ":"))
    urls = json.dumps(sorted(by_book), ensure_ascii=False)
    f = OUT_DIR / "seed_text_drafts_cleanup.sql"
    f.write_text(
        f"""{header}begin;
delete from public.text_drafts t
using public.sources s
where t.source_id = s.id and s.kind = 'inventory'
  and s.url = any (array(select jsonb_array_elements_text($json${urls}$json$::jsonb)))
  and t.status = 'pending'
  and t.edited_at is null
  and not exists (
    select 1
    from jsonb_to_recordset($json${keys}$json$::jsonb) as k(slug text, book_url text, page int)
    join public.works w on w.slug = k.slug
    where w.id = t.work_id and k.book_url = s.url and k.page = t.page);
commit;
""",
        encoding="utf-8",
    )
    written.append(f)

    tot = Counter()
    for label, st in stats.items():
        d = st["drafts"] or 1
        print(
            f"{label}: {st['entries']} kayıt → {st['drafts']} taslak (atlanan {st['skipped']}), adresli {st['address']}/{st['drafts']}, "
            f"ort. TR {st['tr_len'] // d} / EN {st['en_len'] // d} karakter, uyarılar {dict(st['warnings'])}",
            file=sys.stderr,
        )
        tot.update(st["warnings"])
    print(f"toplam {len(rows)} taslak; uyarılar {dict(tot)} → {', '.join(f.name for f in written)}", file=sys.stderr)


if __name__ == "__main__":
    main()
