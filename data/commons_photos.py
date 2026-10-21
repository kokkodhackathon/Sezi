"""Envanter fotoğrafı olmayan eserlere Wikimedia Commons fotoğrafı ekler (Wikidata'nın temsil görseli, P18).

Akış (veritabanına bir kez yazılır; uygulamalar Wikimedia'ya hiç istek atmaz):
  1. Veritabanından Wikidata kimliği olan (`works.external_ids.wikidata`) ve envanter fotoğrafı olmayan eserler alınır.
  2. Wikidata'dan P18 dosya adı, Commons'tan lisans / yazar / dosya sayfası okunur.
     Yalnız serbest lisanslar girer: CC0, kamu malı, CC BY, CC BY-SA (NC / ND / bilinmeyen lisans atlanır).
  3. Dosya Commons'un 1600 px küçüğünden indirilir; 1600 px ve 480 px WebP üretilir (`data/out/commons/`).
  4. `supabase/seed_media_commons.sql` üretilir: satırlar `draft` girer. Yayın admin işidir ve veritabanı
     tetikleyicisi eserin Wikidata eşleşmesi eşleştirme masasında kabul edilmeden yayına izin vermez.

Yeniden çalıştırılabilir: kaynak dosyaya (`source_file = commons:<dosya>`) göre günceller; admin kararlarını
(eser, onay, sıra, alt metin) ezmez. Eşleştirme masasında yeni Wikidata eşleşmesi kabul edilince yeniden çalıştırın.

İstek kuralı: saniyede en çok 1 istek, `User-Agent` başlığıyla. Yanıtlar `data/raw/commons_cache.json` içinde.

Gereksinim (izole ortam): pip install pillow
Kullanım:
  python -I data/commons_photos.py [--upload] [--refresh]
  npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_media_commons.sql
"""

import hashlib
import html
import io
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PROJECT_REF = "jejsvycpzulpleftkssj"
USER_AGENT = "Sezi/0.1 (https://sezi.info; edizkeskin@gmail.com)"
OUT = ROOT / "data/out/commons"
CACHE = ROOT / "data/raw/commons_cache.json"
LARGE_PX = 1600
THUMB_PX = 480
CREDIT = "Wikimedia Commons"
# Serbest lisanslar (Commons `LicenseShortName`): ticari kullanım ve değiştirme serbest, atıf yeter.
FREE = re.compile(r"^(CC0|Public domain|PD.*|CC BY(-SA)? \d\.\d( [A-Za-z-]+)?)$", re.I)

_last = 0.0


def get_json(url: str) -> dict:
    """Saniyede en çok bir istek; Wikimedia `User-Agent` ister."""
    global _last
    wait = 1.0 - (time.monotonic() - _last)
    if wait > 0:
        time.sleep(wait)
    _last = time.monotonic()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def get_bytes(url: str) -> bytes:
    global _last
    wait = 1.0 - (time.monotonic() - _last)
    if wait > 0:
        time.sleep(wait)
    _last = time.monotonic()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def db(query: str) -> list[dict]:
    """Supabase CLI ile salt okuma sorgusu (JSON); CLI çıktısının başındaki uyarılar atlanır.

    Windows kabuğu çok satırlı argümanı bölebilir: sorgu tek satıra indirilir.
    """
    cmd = ["npx", "-y", "supabase@latest", "db", "query", "--linked", "--project-ref", PROJECT_REF, " ".join(query.split()), "-o", "json"]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", shell=sys.platform == "win32")
    if out.returncode != 0:
        sys.exit(f"Veritabanı sorgusu başarısız: {out.stderr.strip()[-400:]}")
    text = out.stdout
    return json.JSONDecoder().raw_decode(text[text.index("{"):])[0]["rows"]


def sql(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def plain(s: str | None) -> str | None:
    """Commons alanları HTML gelir (bağlantılı yazar adı): etiketsiz, tek satır metin."""
    if not s:
        return None
    t = html.unescape(re.sub(r"<[^>]+>", " ", s))
    t = re.sub(r"\s+", " ", t).strip()
    return t or None


def p18(entity: dict) -> str | None:
    """Tercih edilen sıradaki görsel, yoksa ilk normal sıradaki; geçersiz (deprecated) atlanır."""
    claims = [c for c in entity.get("claims", {}).get("P18", []) if c.get("rank") != "deprecated"]
    claims.sort(key=lambda c: c.get("rank") != "preferred")
    for c in claims:
        v = c["mainsnak"].get("datavalue", {}).get("value")
        if isinstance(v, str):
            return v
    return None


def main():
    refresh = "--refresh" in sys.argv
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() and not refresh else {}
    cache.setdefault("entities", {})
    cache.setdefault("files", {})

    works = db(
        """select w.slug, w.name->>'tr' as name_tr, coalesce(w.name->>'en', w.name->>'tr') as name_en,
                  w.external_ids->>'wikidata' as qid
           from public.works w
           where w.external_ids ? 'wikidata'
             and not exists (select 1 from public.media m where m.work_id = w.id and m.origin = 'inventory')"""
    )
    print(f"{len(works)} eser: Wikidata kimliği var, envanter fotoğrafı yok", file=sys.stderr)

    qids = sorted({w["qid"] for w in works} - set(cache["entities"]))
    for i in range(0, len(qids), 50):
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "claims", "format": "json"})
        for q, e in get_json(url).get("entities", {}).items():
            cache["entities"][q] = p18(e)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    titles = sorted({cache["entities"].get(w["qid"]) for w in works} - {None} - set(cache["files"]))
    for i in range(0, len(titles), 50):
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "titles": "|".join("File:" + t for t in titles[i:i + 50]), "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata", "iiurlwidth": LARGE_PX,
            "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit", "format": "json"})
        q = get_json(url)["query"]
        # Commons dosya adını normalleştirir (alt çizgi → boşluk); önbellek P18'deki adla tutulur.
        norm = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for page in q["pages"].values():
            name = norm.get(page["title"], page["title"])[5:]
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                cache["files"][name] = None
                continue
            em = info.get("extmetadata", {})
            cache["files"][name] = {
                "page": info["descriptionurl"],
                "thumb": info.get("thumburl") or info["url"],
                "width": info["width"],
                "height": info["height"],
                "mime": info["mime"],
                "license": plain(em.get("LicenseShortName", {}).get("value")),
                "license_url": em.get("LicenseUrl", {}).get("value") or None,
                "author": plain(em.get("Artist", {}).get("value")),
            }
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    OUT.mkdir(parents=True, exist_ok=True)
    rows, skipped = [], {"görsel yok": 0, "lisans serbest değil": 0, "biçim": 0}
    for w in works:
        name = cache["entities"].get(w["qid"])
        f = cache["files"].get(name) if name else None
        if not f:
            skipped["görsel yok"] += 1
            continue
        if not f["license"] or not FREE.match(f["license"]):
            skipped["lisans serbest değil"] += 1
            print(f"  atlandı ({f['license']}): {w['slug']} ← {name}", file=sys.stderr)
            continue
        if f["mime"] not in ("image/jpeg", "image/png", "image/webp"):
            skipped["biçim"] += 1
            continue
        fid = hashlib.sha1(name.encode("utf-8")).hexdigest()[:16]
        large_p, thumb_p = OUT / f"{fid}.webp", OUT / f"{fid}_t.webp"
        if not large_p.exists() or refresh:
            img = Image.open(io.BytesIO(get_bytes(f["thumb"])))
            img = img.convert("RGB")
            large = img.copy()
            large.thumbnail((LARGE_PX, LARGE_PX), Image.Resampling.LANCZOS)
            large.save(large_p, "WEBP", quality=80, method=6)
            thumb = img.copy()
            thumb.thumbnail((THUMB_PX, THUMB_PX), Image.Resampling.LANCZOS)
            thumb.save(thumb_p, "WEBP", quality=76, method=6)
        with Image.open(large_p) as lg:
            width, height = lg.size
        resized = max(f["width"], f["height"]) > LARGE_PX
        mods = (
            {"tr": f"Uzun kenarı {LARGE_PX} px'e küçültüldü, WebP'ye çevrildi", "en": f"Resized to {LARGE_PX} px on the long edge, converted to WebP"}
            if resized else {"tr": "WebP'ye çevrildi", "en": "Converted to WebP"}
        )
        rows.append({
            "slug": w["slug"], "path": f"commons/{fid}.webp", "thumb": f"commons/{fid}_t.webp",
            "alt": {"tr": w["name_tr"], "en": w["name_en"]}, "width": width, "height": height,
            # Aynı Commons dosyası birden çok esere P18 olabilir (ör. Koza Hanı ve Koza Han Mescidi): anahtar esere göre.
            "file": f"commons:{w['slug']}:{name}", "author": f["author"], "license": f["license"], "license_url": f["license_url"],
            "source_url": f["page"], "mods": mods, "qid": w["qid"],
        })

    values = ",\n".join(
        f"({sql(r['slug'])}, {sql(r['path'])}, {sql(r['thumb'])}, {sql(json.dumps(r['alt'], ensure_ascii=False))}::jsonb, "
        f"{r['width']}, {r['height']}, {sql(r['file'])}, {sql(r['author'])}, {sql(r['license'])}, {sql(r['license_url'])}, "
        f"{sql(r['source_url'])}, {sql(json.dumps(r['mods'], ensure_ascii=False))}::jsonb, {sql(r['qid'])})"
        for r in rows
    )
    out = ROOT / "supabase/seed_media_commons.sql"
    out.write_text(
        f"""-- Otomatik üretildi: data/commons_photos.py. Elle düzenlemeyin.
-- Kaynak: Wikimedia Commons (Wikidata P18). Lisans ve yazar her satırda; satırlar taslak girer, yayın admin onayıyla.
begin;
insert into public.media (work_id, storage_path, thumb_path, alt_text, credit, sort_order, status, kind, width, height,
                          source_file, origin, author, license, license_url, source_url, modifications, wikidata_id)
select w.id, v.path, v.thumb, v.alt, {sql(CREDIT)}, 10, 'draft'::public.content_status, 'photo', v.width, v.height,
       v.file, 'commons', v.author, v.license, v.license_url, v.source_url, v.mods, v.qid
from (values
{values}
) as v(slug, path, thumb, alt, width, height, file, author, license, license_url, source_url, mods, qid)
join public.works w on w.slug = v.slug
-- Var olan satırda dosya ve atıf bilgileri güncellenir (Commons'ta düzeltilmiş olabilir); eser, onay, sıra ve alt metin admin kararıdır.
on conflict (source_file) where source_file is not null do update set
  storage_path = excluded.storage_path, thumb_path = excluded.thumb_path, width = excluded.width, height = excluded.height,
  author = excluded.author, license = excluded.license, license_url = excluded.license_url,
  source_url = excluded.source_url, modifications = excluded.modifications;
commit;
""",
        encoding="utf-8",
    )
    print(f"{len(rows)} Commons fotoğrafı → {out.relative_to(ROOT)}; atlanan: {skipped}", file=sys.stderr)

    if "--upload" in sys.argv:
        stage = OUT / "_stage" / "commons"
        stage.mkdir(parents=True, exist_ok=True)
        for r in rows:
            for key in ("path", "thumb"):
                n = Path(r[key]).name
                (stage / n).write_bytes((OUT / n).read_bytes())
        # CLI, Windows'taki "C:\..." mutlak yolunu uzak adres sanıyor: göreli yolla, aşama klasöründen çalıştırılır.
        cmd = ["npx", "-y", "supabase@latest", "storage", "cp", "-r", "-j", "4", "commons", "ss:///media",
               "--linked", "--project-ref", PROJECT_REF, "--experimental"]
        if subprocess.run(cmd, cwd=stage.parent, shell=sys.platform == "win32").returncode != 0:
            print("Yükleme alt süreçte başarısız oldu; şu komutu kabukta çalıştırın: " + " ".join(cmd), file=sys.stderr)
        else:
            print(f"{len(rows) * 2} dosya yüklendi → media/commons/", file=sys.stderr)


if __name__ == "__main__":
    main()
