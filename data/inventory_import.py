"""Envanter eser listesini (inventory_geo.json) veritabanına aktaran SQL üretir.

Durum kuralları:
  - Ad, il, ilçe ve tür Vakıf Katılım'ın yayımladığı envanterden gelir: kaynaklı bilgi → verified.
  - Ayrıştırmanın şüpheli bıraktığı kayıtlar (needs_review) → draft (admin panelinde onaylanır).
  - Konum ayrı işaretlenir: Wikidata yapı eşleşmesi (güven ≥ 0.9) → exact; diğer eşleşmeler → approximate; yoksa → unknown.
Tarihçe, mimari metin ve fotoğraflar AKTARILMAZ (telif; resmî paylaşım beklenir).

Girdi:  data/out/inventory_geo.json
Çıktı:  supabase/seed_inventory.sql (yeniden çalıştırılabilir; slug ve kaynak URL+cilt'e göre günceller)
Kullanım:  python -I data/inventory_import.py
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / "data/out/inventory_geo.json"
OUT = ROOT / "supabase/seed_inventory.sql"
OVERRIDES = ROOT / "data/geo_overrides.json"
# İçindekiler ayrıştırmasının bozduğu adlar; kitaptaki başlıkla elle doğrulandı (slug aynı kalır).
NAME_OVERRIDES = ROOT / "data/name_overrides.json"

# Ad içindeki tür sözcüğü → work_types.slug. Sıra önemlidir: "Camii ve Türbesi" → cami (ilk ana yapı).
TYPE_RULES = [
    (r"külliye", "kulliye"),
    (r"cami|\bmescid|\bmescit", "cami"),
    (r"medrese|darülhadis|darülkurra|dârülkurrâ|darülhuffaz|dârü’l-huffaz|dar’ül huffaz", "medrese"),
    (r"darüşşifa|darültıb|şifahane|bimarhane", "darussifa"),
    (r"türbe|kümbet|kabri|kabir", "turbe"),
    (r"hazire|mezarlı", "hazire"),
    (r"hamam", "hamam"),
    (r"sebil", "sebil"),
    (r"çeşme|şadırvan|su yapı|suyolu|maksem", "cesme"),
    (r"sarnıç", "sarnic"),
    (r"kervansaray", "kervansaray"),
    (r"\bhan\b|hanı", "han"),
    (r"bedesten|çarşı|arasta|bazaar", "carsi"),
    (r"köprü", "kopru"),
    (r"imaret|aşevi", "imaret"),
    (r"tekke|zaviye|dergâh|dergah|mevlevihane|hankah|hanikah|hânkâh", "tekke"),
    (r"mektep|mektebi|sıbyan|okul", "mektep"),
    (r"kütüphane", "kutuphane"),
    (r"kilise|manastır", "kilise"),
    (r"sinagog|havra", "sinagog"),
    (r"konak|konağı|\bev\b|evi|konut|köşk", "konak"),
    (r"değirmen", "degirmen"),
]


def slugify(text: str) -> str:
    text = text.replace("ı", "i").replace("İ", "i")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return "-".join(p for p in re.sub(r"[^a-z0-9]+", "-", text).split("-") if p)


def type_of(name: str) -> str:
    low = name.replace("İ", "i").replace("I", "ı").lower()
    # Parantez içi eski ad/takma addır ("Orhan Bey Hamamı (Aynalı Çarşı)"); "X Camii ve Türbesi"nde ana yapı ilk parçadır.
    low = re.sub(r"\([^)]*\)", " ", low)
    first = re.split(r"\s+ve\s+|,", low)[0]
    find = lambda text: [(m.start(), slug) for pat, slug in TYPE_RULES for m in re.finditer(pat, text)]
    hits = find(first) or find(low)
    if not hits:
        return "diger"
    # Türkçe tamlamada baş isim sondadır: "Koza Han Mescidi" bir mesciddir, han değil.
    return max(hits)[1]


def sql(s) -> str:
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def main():
    rows = json.loads(IN.read_text(encoding="utf-8"))
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    names = json.loads(NAME_OVERRIDES.read_text(encoding="utf-8"))
    out, slugs = [], set()
    for r in rows:
        base = slugify(f"{r['city']}-{r['name_tr']}")
        slug = base
        n = 2
        while slug in slugs:
            slug = f"{base}-{n}"
            n += 1
        slugs.add(slug)
        geo = r.get("geo")
        fix = overrides.get(slug)
        if fix:
            geo = {"lng": fix["lng"], "lat": fix["lat"], "osm": fix.get("osm"), "method": "curated", "confidence": 1.0} if fix["lng"] is not None else None
        if geo and geo["method"] == "curated":
            precision = "exact"
        elif geo and geo["method"] == "wikidata" and geo["confidence"] >= 0.9:
            precision = "exact"
        elif geo:
            precision = "approximate"
        else:
            precision = "unknown"
        b = r["book"]
        out.append(
            {
                "slug": slug,
                "name": names.get(slug) or {"tr": r["name_tr"], **({"en": r["name_en"]} if r.get("name_en") else {})},
                "type": (fix or {}).get("type") or type_of((names.get(slug) or {}).get("tr") or r["name_tr"]),
                "city": r["city"].lower(),
                "district": r["district"],
                "lng": geo["lng"] if geo else None,
                "lat": geo["lat"] if geo else None,
                "precision": precision,
                "status": "draft" if r.get("needs_review") else "verified",
                "needs_review": bool(r.get("needs_review")),
                "external_ids": {k: v for k, v in (("wikidata", (geo or {}).get("qid")), ("osm", (geo or {}).get("osm"))) if v},
                "book_title": f"{b['title']}{' — Cilt ' + str(b['volume']) if b['volume'] else ''}",
                "book_volume": b["volume"],
                "book_year": b["year"],
                "book_url": b["url"],
                "page": str(r["page"]),
                "section": r["section"],
            }
        )
    data = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        f"""-- Otomatik üretildi: data/inventory_import.py. Elle düzenlemeyin.
-- Kaynak: Vakıf Katılım, Vakıf Eserleri Envanteri (içindekiler: ad, il, ilçe, cilt, sayfa).
-- Konumlar: Wikidata (CC0) ve OpenStreetMap/Nominatim (ODbL). Tarihçe metni ve fotoğraf içermez.
begin;
create temp table inv on commit drop as
select * from jsonb_to_recordset($json${data}$json$::jsonb) as d(
  slug text, name jsonb, type text, city text, district text, lng float8, lat float8, precision text, status text,
  needs_review boolean, external_ids jsonb, book_title text, book_volume int, book_year int, book_url text, page text, section jsonb);

insert into sources (title, author, publisher, year, url, kind, city_id, volume)
select distinct inv.book_title, null::text, 'Vakıf Katılım', inv.book_year, inv.book_url, 'inventory', c.id, inv.book_volume
from inv join cities c on c.slug = inv.city
where not exists (select 1 from sources s where s.url = inv.book_url);

insert into works (slug, name, work_type_id, city_id, district, location, location_precision, status, needs_review, external_ids)
select inv.slug, inv.name,
  (select id from work_types t where t.slug = inv.type),
  (select id from cities c where c.slug = inv.city),
  inv.district,
  case when inv.lng is null then null else extensions.st_setsrid(extensions.st_makepoint(inv.lng, inv.lat), 4326)::extensions.geography end,
  inv.precision::location_precision, inv.status::content_status, inv.needs_review, inv.external_ids
from inv
-- Admin bir konum adayını kabul ettiyse (location_candidates.status = 'accepted') konum alanları seed'le ezilmez.
on conflict (slug) do update set name = excluded.name, work_type_id = excluded.work_type_id, district = excluded.district,
  location = case when exists (select 1 from location_candidates lc where lc.work_id = works.id and lc.status = 'accepted')
    then works.location else excluded.location end,
  location_precision = case when exists (select 1 from location_candidates lc where lc.work_id = works.id and lc.status = 'accepted')
    then works.location_precision else excluded.location_precision end,
  needs_review = excluded.needs_review,
  external_ids = case when exists (select 1 from location_candidates lc where lc.work_id = works.id and lc.status = 'accepted')
    then works.external_ids else excluded.external_ids end;

insert into work_sources (work_id, source_id, page, section)
select w.id, s.id, inv.page, inv.section
from inv join works w on w.slug = inv.slug join sources s on s.url = inv.book_url
on conflict (work_id, source_id) do update set page = excluded.page, section = excluded.section;
commit;
""",
        encoding="utf-8",
    )
    by = {}
    for o in out:
        k = (o["city"], o["precision"])
        by[k] = by.get(k, 0) + 1
    types = {}
    for o in out:
        types[o["type"]] = types.get(o["type"], 0) + 1
    print(f"{len(out)} eser → {OUT.relative_to(ROOT)}", file=sys.stderr)
    print("konum:", dict(sorted(by.items())), file=sys.stderr)
    print("tür:", dict(sorted(types.items(), key=lambda x: -x[1])), file=sys.stderr)


if __name__ == "__main__":
    main()
