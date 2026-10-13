"""Vakıf Katılım envanter kitaplarının içindekiler sayfalarından eser listesi çıkarır.

Yalnızca olgusal alanlar alınır: il, ilçe, bölüm (kategori/külliye), eser adı (TR/EN), kitap/cilt/sayfa.
Tarihçe metinleri ve fotoğraflar alınmaz: kitaplar "tüm hakları saklıdır"; resmî paylaşım beklenir.

Girdi:  data/raw/books/*.pdf  (https://www.vakifkatilim.com.tr/tr/hakkimizda/medya-merkezi/yayinlarimiz; gitignore'da)
Çıktı:  data/out/inventory_toc.json
Gerekli: pdftotext (poppler)

Yöntem: pdftotext -raw çok sütunlu içindekiler sayfalarında sütun sırasını karıştırabildiği için
ilçe ve bölüm satır sırasına göre değil, SAYFA ARALIĞINA göre atanır (ör. "MERAM 75" ile
"KARATAY 174" arasındaki eserler Meram'dır).

Kullanım:  python -I data/inventory_toc.py
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / "data/raw/books"
OUT = ROOT / "data/out/inventory_toc.json"

PUB = "https://www.vakifkatilim.com.tr/documents/KurumsalIletisim"
BOOK_DEFS = [
    {"file": "hatay.pdf", "city": "Hatay", "title": "Hatay Vakıf Eserleri", "volume": None, "year": 2022, "url": f"{PUB}/hatay-vakif-eserleri.pdf", "style": "bullet"},
    {"file": "konya-envanteri-1_cilt-web.pdf", "city": "Konya", "title": "Konya Vakıf Eserleri", "volume": 1, "year": 2024, "url": f"{PUB}/yayinlarimiz/konya-envanteri-1_cilt-web.pdf", "style": "raw"},
    {"file": "konya-envanteri-2_cilt-web.pdf", "city": "Konya", "title": "Konya Vakıf Eserleri", "volume": 2, "year": 2024, "url": f"{PUB}/yayinlarimiz/konya-envanteri-2_cilt-web.pdf", "style": "raw"},
    {"file": "bursa-envanteri-cilt-1.pdf", "city": "Bursa", "title": "Bursa Vakıf Eserleri", "volume": 1, "year": 2025, "url": f"{PUB}/yayinlarimiz/bursa-envanteri-cilt-1.pdf", "style": "raw"},
    {"file": "bursa-envanteri-cilt-2.pdf", "city": "Bursa", "title": "Bursa Vakıf Eserleri", "volume": 2, "year": 2025, "url": f"{PUB}/yayinlarimiz/bursa-envanteri-cilt-2.pdf", "style": "raw"},
    {"file": "bursa-envanteri-cilt-3.pdf", "city": "Bursa", "title": "Bursa Vakıf Eserleri", "volume": 3, "year": 2025, "url": f"{PUB}/yayinlarimiz/bursa-envanteri-cilt-3.pdf", "style": "raw"},
]

# Resmî ilçe adları (büyük harf, Türkçe). İçindekilerdeki ilçe başlıkları bunlarla tanınır.
DISTRICTS = {
    "Konya": "AHIRLI AKÖREN AKŞEHİR ALTINEKİN BEYŞEHİR BOZKIR CİHANBEYLİ ÇELTİK ÇUMRA DERBENT DEREBUCAK DOĞANHİSAR EMİRGAZİ EREĞLİ GÜNEYSINIR HADİM HALKAPINAR HÜYÜK ILGIN KADINHANI KARAPINAR KARATAY KULU MERAM SARAYÖNÜ SELÇUKLU SEYDİŞEHİR TAŞKENT TUZLUKÇU YALIHÜYÜK YUNAK",
    "Bursa": "BÜYÜKORHAN GEMLİK GÜRSU HARMANCIK İNEGÖL İZNİK KARACABEY KELES KESTEL MUDANYA MUSTAFAKEMALPAŞA NİLÜFER ORHANELİ ORHANGAZİ OSMANGAZİ YENİŞEHİR YILDIRIM",
    "Hatay": "ALTINÖZÜ ANTAKYA ARSUZ BELEN DEFNE DÖRTYOL ERZİN HASSA İSKENDERUN KIRIKHAN KUMLU PAYAS REYHANLI SAMANDAĞ YAYLADAĞI",
}
DISTRICTS = {c: set(v.split()) for c, v in DISTRICTS.items()}

CREDITS = re.compile(r"(PROJE YÖNETMEN|Project Manager|YAYINCI|Publisher|EDİTÖR|Editor|FOTOĞRAF|Photograph|KOORDİNATÖR|Coordinator|BASKI|Printing|ÇEVİRİ|Translation|BİLİM KURULU|SAHA )", re.I)
NOT_ENTRY = re.compile(r"(SUNUŞ|TAKDİM|GİRİŞ|ÖNSÖZ|KAYNAKÇA|SÖZLÜK|TERİMLER|DİZİN|TARİHİ|TARİHÇESİ|KONUMU|İçindekiler|içindekiler|C o n t e n t s|Introduction|History of)", re.I)
UPPER = re.compile(r"^[A-ZÇĞİÖŞÜÂÎÛ0-9 .,'’()\-/&–]+$")
WITH_PAGE = re.compile(r"^(.*?)[\s\t]+(\d{1,3})$")


def fix_glyphs(s: str) -> str:
    # Bursa ciltlerinde gömülü yazı tipi "İ" harfini "%" olarak veriyor (ör. "%mareti", "%shak").
    s = s.replace("%", "İ")
    return s.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("­", "")


def tr_title(s: str) -> str:
    """Türkçe kurallarına uygun başlık biçimi (İSTANBUL → İstanbul, ILGIN → Ilgın)."""
    words = []
    for w in s.split():
        if re.fullmatch(r"[IVX]+\.?", w):  # Roma rakamı: II. Murad
            words.append(w)
            continue
        low = w.replace("I", "ı").replace("İ", "i").lower()
        if low in {"ve", "ile"}:
            words.append(low)
            continue
        k = 0
        while k < len(low) and not low[k].isalpha():  # "(beyhan)" → "(Beyhan)"
            k += 1
        if k < len(low):
            c = {"i": "İ", "ı": "I"}.get(low[k], low[k].upper())
            low = low[:k] + c + low[k + 1 :]
        words.append(low)
    return " ".join(words)


def en_title(s: str) -> str:
    words = []
    for w in s.split():
        low = w.replace("İ", "i").replace("I", "i").lower()
        words.append(low if low in {"and", "of", "the"} else low[:1].upper() + low[1:])
    return " ".join(words)


def pdf_pages(path: Path, raw: bool) -> list[str]:
    args = ["pdftotext", "-enc", "UTF-8", "-l", "24", "-raw" if raw else "-layout", str(path), "-"]
    return subprocess.run(args, capture_output=True, check=True).stdout.decode("utf-8").split("\f")


def toc_pages(pages: list[str]) -> list[str]:
    """Sayfa numaralı satırların yoğun olduğu sayfalar içindekilerdir."""
    out = []
    for p in pages:
        lines = [l for l in p.splitlines() if l.strip()]
        hits = sum(1 for l in lines if WITH_PAGE.match(l.strip()) or re.search(r"\.{4,}\s*\d{1,3}\b", l))
        if hits >= 8 and hits >= len(lines) * 0.15:
            out.append(p)
    return out


def parse_raw(text: str, city: str):
    """Ham içindekileri belirteçlere ayırır: ilçe başlığı, bölüm başlığı (TR+EN), eser (TR ad + sayfa, ardından EN ad)."""
    lines = [fix_glyphs(l.strip()) for l in text.splitlines() if l.strip()]
    tokens = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = WITH_PAGE.match(line)
        bare = m.group(1).strip() if m else line
        if NOT_ENTRY.search(bare):
            i += 1
            # "KONYA TARİHİ 15 / History of Konya" gibi bölümlerin EN satırını da atla
            if i < len(lines) and not UPPER.match(lines[i]) and not WITH_PAGE.match(lines[i]):
                i += 1
            continue
        if UPPER.match(bare):
            page = int(m.group(2)) if m else None
            if bare in DISTRICTS[city]:
                tokens.append(("district", tr_title(bare), page))
                i += 1
                continue
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            en = nxt if nxt and not UPPER.match(nxt) and not WITH_PAGE.match(nxt) else None
            # Büyük harfli eser başlığı ("ULUCAMİ 37 / ULUCAMI") ya da bölüm başlığı ("KÜLLİYELER / Complexes")
            if page is not None and en is None and i + 1 < len(lines) and UPPER.match(nxt):
                tokens.append(("entry", tr_title(bare), tr_title(nxt), page))
                i += 2
                continue
            tokens.append(("section", tr_title(bare), en, page))
            i += 2 if en else 1
            continue
        # Türkçe eser adı: sayfa numarası gelene ya da İngilizce satıra geçene kadar
        tr_lines, page = [], None
        while i < len(lines):
            mm = WITH_PAGE.match(lines[i])
            if mm and not UPPER.match(mm.group(1).strip()):
                tr_lines.append(mm.group(1).strip())
                page = int(mm.group(2))
                i += 1
                break
            if UPPER.match(lines[i]) or (tr_lines and looks_english(lines[i])):
                break
            tr_lines.append(lines[i])
            i += 1
        if not tr_lines:
            i += 1
            continue
        n = len(tr_lines)
        en_lines = []
        while i < len(lines) and len(en_lines) < n and not WITH_PAGE.match(lines[i]) and not UPPER.match(lines[i]):
            en_lines.append(lines[i])
            i += 1
        tokens.append(("entry", join(tr_lines), join(en_lines) or None, page))
    return tokens


ENGLISH_HINT = re.compile(r"\b(Mosque|Masjid|Madrasa|Tomb|Bath|Fountain|Inn|Bridge|Complex|Church|Graveyard|Caravanserai|Lodge|Mansion|House|School|Imaret|Bazaar|Village|Minaret|Library|Hospital)\b")


def looks_english(s: str) -> bool:
    return bool(ENGLISH_HINT.search(s)) and not re.search(r"(Camii|Mescidi|Medresesi|Türbesi|Hamamı|Çeşmesi|Hanı|Köprüsü|Külliyesi)", s)


def join(parts: list[str]) -> str:
    s = " ".join(parts)
    return re.sub(r"(\w)- (\w)", r"\1-\2", s).replace("\t", " ").strip()


def resolve(tokens, carry_district=None):
    """Sayfasız başlıklara sonraki eserin sayfasını ver; ilçe/bölümü sayfa aralığıyla ata."""
    for k, tok in enumerate(tokens):
        if tok[0] in ("district", "section") and tok[-1] is None:
            nxt = next((t for t in tokens[k + 1 :] if t[0] == "entry" and t[-1] is not None), None)
            tokens[k] = (*tok[:-1], nxt[-1] if nxt else None)
    # Sayfasız eser: kendinden önceki sayfalı başlığın sayfası
    last_header_page = None
    fixed = []
    for tok in tokens:
        if tok[0] != "entry":
            last_header_page = tok[-1]
            fixed.append(tok)
        elif tok[-1] is None and last_header_page is not None:
            fixed.append((*tok[:-1], last_header_page))
        elif tok[-1] is not None:
            fixed.append(tok)
    districts = sorted((t[2], t[1]) for t in fixed if t[0] == "district" and t[2] is not None)
    sections = sorted((t[3], t[1], t[2]) for t in fixed if t[0] == "section" and t[3] is not None)
    entries = []
    for t in fixed:
        if t[0] != "entry":
            continue
        page = t[3]
        d = [name for p, name in districts if p <= page]
        s = [(tr, en) for p, tr, en in sections if p <= page]
        entries.append({
            "district": d[-1] if d else carry_district,
            "section": {"tr": s[-1][0], "en": s[-1][1]} if s else None,
            "name_tr": t[1],
            "name_en": t[2],
            "page": page,
        })
    return entries, (districts[-1][1] if districts else carry_district)


def parse_bullets(text: str):
    """Hatay: '• TR AD / EN NAME ..... sayfa' ve noktasız bölüm başlıkları (ilçe yok, kitap türe göre düzenli)."""
    entries, section = [], None
    flat = re.sub(r"\.{3,}\s*\n\s*(\d{1,3})", r"... \1", text)
    for chunk in re.split(r"\s{6,}|\n", flat):
        c = chunk.strip()
        m = re.match(r"^(•\s*)?(.+?)\s*/\s*(.+?)\s*\.{3,}\s*(\d{1,3})$", c)
        if not m:
            continue
        tr, en, page = m.group(2).strip(), m.group(3).strip(), int(m.group(4))
        if not m.group(1):
            if not NOT_ENTRY.search(tr):
                section = {"tr": tr_title(tr), "en": en_title(en)}
            continue
        entries.append({"district": None, "section": section, "name_tr": tr_title(tr), "name_en": en_title(en), "page": page})
    return entries


def main():
    rows, carry = [], {}
    for b in BOOK_DEFS:
        path = BOOKS / b["file"]
        if not path.exists():
            print(f"  eksik: {path}", file=sys.stderr)
            continue
        if b["style"] == "bullet":
            items = parse_bullets("\n".join(toc_pages(pdf_pages(path, raw=False))))
        else:
            tokens = parse_raw("\n".join(toc_pages(pdf_pages(path, raw=True))), b["city"])
            items, carry[b["city"]] = resolve(tokens, carry.get(b["city"]))
        items = [x for x in items if 3 <= len(x["name_tr"]) <= 120 and not CREDITS.search(x["name_tr"]) and not (x["section"] and CREDITS.search(x["section"]["tr"]))]
        for x in items:
            # Otomatik ayrıştırmanın şüpheli bıraktığı kayıtlar admin panelinde gözden geçirilir.
            x["needs_review"] = (not x["name_en"]) or len(x["name_tr"]) > 70 or bool(re.search(r"[A-ZÇĞİÖŞÜ]{4,}\s+\d", x["name_tr"]))
        seen, kept = set(), 0
        for it in sorted(items, key=lambda x: x["page"]):
            key = (it["name_tr"], it["page"])
            if key in seen:
                continue
            seen.add(key)
            kept += 1
            rows.append({**it, "city": b["city"], "book": {k: b[k] for k in ("title", "volume", "year", "url")}})
        print(f"{b['file']}: {kept} kayıt", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    by_city = {}
    for r in rows:
        by_city[r["city"]] = by_city.get(r["city"], 0) + 1
    print(f"toplam {len(rows)}: {by_city}", file=sys.stderr)


if __name__ == "__main__":
    main()
