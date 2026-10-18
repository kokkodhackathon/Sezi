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

        def start_of(r):
            """TOC sayfası sağ sayfaysa ve eserin başlığı yayılımın sol sayfasındaysa (Konya) metin sol sayfada başlar."""
            p = r["page"]
            left = left_of(p)
            name = slugify(r["name_tr"])
            on = lambda pg: any(slugify(t) == name for t in titles.get(pg, []))
            return left if left != p and on(left) and not on(p) else p

        for r in items:
            r["start"] = start_of(r)
        starts = sorted({x["start"] for x in items})
        st = stats[label] = {"entries": 0, "drafts": 0, "address": 0, "address_en": 0, "tr_len": 0, "en_len": 0, "warnings": Counter(), "skipped": 0}
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
            if not texts["tr"]:
                st["skipped"] += 1
                continue
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
                continue
            rows.append(
                {
                    "slug": r["slug"],
                    "book_url": url,
                    "page": p,
                    "page_end": end if end > p else None,
                    "pdf_page": (p - info["offset"]) // 2 + 1,  # metnin başladığı PDF sayfası (1 tabanlı; tarayıcıda #page=)
                    "address": address,
                    "history": history,
                    "architecture": None,
                    "warnings": warnings,
                }
            )
            st["drafts"] += 1
            st["address"] += bool(address)
            st["address_en"] += bool(addr_en)
            st["tr_len"] += tr_len
            st["en_len"] += en_len
            st["warnings"].update(warnings)

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
-- Tümü TASLAKTIR (status='pending'); yayına alma admin panelinde yapılır. Yalnız bekleyen satırlar güncellenir/silinir.
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
  slug text, book_url text, page int, page_end int, pdf_page int, address jsonb, history jsonb, architecture jsonb, warnings jsonb);

insert into public.text_drafts (work_id, source_id, page, page_end, pdf_page, address, history, architecture, warnings)
select w.id, s.id, td.page, td.page_end, td.pdf_page, td.address, td.history, td.architecture,
  coalesce(array(select jsonb_array_elements_text(td.warnings)), '{{}}')
from td
join public.works w on w.slug = td.slug
join public.sources s on s.url = td.book_url and s.kind = 'inventory'
on conflict (work_id, source_id, page) do update
set page_end = excluded.page_end, pdf_page = excluded.pdf_page, address = excluded.address, history = excluded.history,
    architecture = excluded.architecture, warnings = excluded.warnings, updated_at = now()
where public.text_drafts.status = 'pending';
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
