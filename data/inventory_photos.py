"""Envanter fotoğraf arşivini eserlere bağlar.

Organizasyonun paylaştığı yüksek çözünürlüklü arşivde dosya adları eseri söylemez
("ERD03201 kopya.jpg"). Aynı fotoğraflar yayımlanmış envanter kitabında da var:
her fotoğraf, kitaptaki görsellerle algısal özet (dHash) üzerinden eşlenir; eşleşen
kitap sayfası, veritabanındaki eserin cilt/sayfa bilgisiyle esere bağlanır.
Yöntem şehirden bağımsızdır: yeni il = yeni kitap PDF'i + yeni fotoğraf arşivi.

Gereksinim (izole ortam): pip install pillow pymupdf

Kullanım:
  python -I data/inventory_photos.py <arşiv klasörü> <il slug> <kitap1.pdf> [kitap2.pdf ...]
  örn: python -I data/inventory_photos.py docs/drive bursa data/raw/books/bursa-envanteri-cilt-{1,2,3}.pdf

Çıktı:
  data/out/photos/<il>/<id>.webp        en fazla 1600 px (uygulama, detay)
  data/out/photos/<il>/<id>_t.webp      480 px (liste kartı)
  data/out/photos/<il>/manifest.json    fotoğraf → eser, cilt, sayfa, eşleşme uzaklığı
"""

import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import pymupdf
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "apps/mobile/.env"
HASH_SIZE = 16  # 16x16 = 256 bit
MAX_DISTANCE = 48  # 256 bitten en fazla bu kadar farklı bit: aynı fotoğraf sayılır
LARGE_PX = 1600
THUMB_PX = 480
Image.MAX_IMAGE_PIXELS = None  # arşivde 100 MP'ye yakın dron fotoğrafları var


def dhash(img: Image.Image) -> int:
    g = img.convert("L").resize((HASH_SIZE + 1, HASH_SIZE), Image.Resampling.LANCZOS)
    px = list(g.get_flattened_data()) if hasattr(g, "get_flattened_data") else list(g.getdata())
    bits = 0
    for y in range(HASH_SIZE):
        row = px[y * (HASH_SIZE + 1) : (y + 1) * (HASH_SIZE + 1)]
        for x in range(HASH_SIZE):
            bits = (bits << 1) | (row[x] > row[x + 1])
    return bits


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def read_env():
    env = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


def fetch_works(city: str):
    """Eserler ve envanter kaynakları (cilt, sayfa): sayfa → eser eşlemesinin tek kaynağı veritabanı."""
    env = read_env()
    q = urllib.parse.urlencode({"select": "slug,name,district,type_slug,sources", "city_slug": f"eq.{city}"})
    req = urllib.request.Request(f"{env['EXPO_PUBLIC_SUPABASE_URL']}/rest/v1/works_view?{q}", headers={"apikey": env["EXPO_PUBLIC_SUPABASE_KEY"]})
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.load(r)
    out = []
    for w in rows:
        for s in w["sources"]:
            if s.get("kind") == "inventory" and s.get("page") and str(s["page"]).isdigit():
                out.append({"slug": w["slug"], "name": w["name"]["tr"], "type": w["type_slug"], "district": w["district"], "volume": s.get("volume") or 1, "page": int(s["page"])})
    return out


def page_numbers(page) -> tuple[int | None, int | None]:
    """Çift sayfa yayılımında sol ve sağ sayfanın basılı numarası (üst köşelerde)."""
    w = page.rect.width
    left = right = None
    for x0, y0, _x1, _y1, text, *_ in page.get_text("words"):
        if y0 > 80 or not re.fullmatch(r"\d{1,3}", text):
            continue
        if x0 < w * 0.25:
            left = int(text)
        elif x0 > w * 0.75:
            right = int(text)
    if left is None and right is not None:
        left = right - 1
    if right is None and left is not None:
        right = left + 1
    return left, right


def book_images(pdf: Path, volume: int):
    """Kitaptaki her büyük görselin özeti ve basılı sayfa numarası."""
    doc = pymupdf.open(pdf)
    out = []
    for page in doc:
        left, right = page_numbers(page)
        mid = page.rect.width / 2
        for info in page.get_images(full=True):
            xref, w, h = info[0], info[2], info[3]
            if w < 200 or h < 150:
                continue
            rects = page.get_image_rects(xref)
            if not rects:
                continue
            r = rects[0]
            printed = left if (r.x0 + r.x1) / 2 < mid else right
            try:
                pix = pymupdf.Pixmap(doc, xref)
                if pix.n - pix.alpha >= 4:
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                img = Image.frombytes("RGB" if pix.n >= 3 else "L", (pix.width, pix.height), pix.samples)
            except Exception:
                continue
            out.append({"volume": volume, "page": printed, "hash": dhash(img), "aspect": round(w / h, 2)})
    return out


def crop_to_aspect(img: Image.Image, aspect: float) -> Image.Image:
    """Fotoğrafı kitaptaki karenin en-boy oranına ortadan kırpar (kitap çoğu fotoğrafı kırparak basar)."""
    w, h = img.size
    if w / h > aspect:
        nw = int(h * aspect)
        return img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = int(w / aspect)
    return img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))


def best_match(img: Image.Image, book):
    """En yakın kitap görseli: her en-boy oranı için fotoğraf o orana kırpılıp özetlenir."""
    small = img.copy()
    small.thumbnail((192, 192), Image.Resampling.LANCZOS)
    by_aspect = {}
    best, best_d = None, 999
    for b in book:
        h = by_aspect.get(b["aspect"])
        if h is None:
            h = by_aspect[b["aspect"]] = dhash(crop_to_aspect(small, b["aspect"]))
        d = hamming(h, b["hash"])
        if d < best_d:
            best, best_d = b, d
    return best, best_d


def expected_district(rel: Path) -> str | None:
    """Arşiv klasör adından ilçe: "4-İnegöl Klasörü" → İnegöl, "I. ve II. Cilt - Osmangazi" → Osmangazi."""
    for part in rel.parts:
        m = re.match(r"^\d+-(.+?) Klasörü$", part)
        if m:
            return m.group(1)
    m = re.search(r"Cilt - (.+)$", rel.parts[0])
    return m.group(1) if m and "Diğer" not in m.group(1) else None


def work_for_page(works, volume: int, page: int | None):
    """Sayfayı içeren eser: aynı ciltte başlangıç sayfası bu sayfadan küçük ya da eşit olan son eser."""
    if page is None:
        return None
    cands = [w for w in works if w["volume"] == volume and w["page"] <= page]
    return max(cands, key=lambda w: w["page"]) if cands else None


def kind_of(name: str) -> str:
    low = name.lower()
    if "dji" in low:
        return "aerial"
    if "kitabe" in low:
        return "inscription"
    return "photo"


def main():
    if len(sys.argv) < 4:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    archive, city, pdfs = Path(sys.argv[1]), sys.argv[2], [Path(p) for p in sys.argv[3:]]
    out_dir = ROOT / "data/out/photos" / city
    out_dir.mkdir(parents=True, exist_ok=True)

    works = fetch_works(city)
    print(f"{len(works)} eser-kaynak kaydı", file=sys.stderr)
    # Kitap görsel özetleri önbelleğe alınır: PDF'leri taramak dakikalar sürer.
    cache = out_dir / "book_hashes.json"
    book = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else []
    if not book:
        for pdf in pdfs:
            m = re.search(r"cilt-(\d+)", pdf.name)
            vol = int(m.group(1)) if m else 1
            imgs = book_images(pdf, vol)
            print(f"{pdf.name}: {len(imgs)} görsel", file=sys.stderr)
            book += imgs
        cache.write_text(json.dumps(book), encoding="utf-8")

    files = sorted(p for p in archive.rglob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
    manifest = []
    for i, f in enumerate(files, 1):
        img = ImageOps.exif_transpose(Image.open(f))
        img = img.convert("RGB")
        best, dist = best_match(img, book) if book else (None, 999)
        match = best if dist <= MAX_DISTANCE else None
        work = work_for_page(works, match["volume"], match["page"]) if match else None
        # İlçe denetimi: klasörün söylediği ilçeyle çelişen eşleşme reddedilir.
        district = expected_district(f.relative_to(archive))
        if work and district and work["district"] and work["district"] != district:
            print(f"  ilçe çelişkisi: {work['name']} ({work['district']} ≠ {district})", file=sys.stderr)
            work = None

        pid = hashlib.sha1(f.read_bytes()).hexdigest()[:12]
        large = img.copy()
        large.thumbnail((LARGE_PX, LARGE_PX), Image.Resampling.LANCZOS)
        large.save(out_dir / f"{pid}.webp", "WEBP", quality=80, method=6)
        thumb = img.copy()
        thumb.thumbnail((THUMB_PX, THUMB_PX), Image.Resampling.LANCZOS)
        thumb.save(out_dir / f"{pid}_t.webp", "WEBP", quality=76, method=6)

        manifest.append({
            "id": pid,
            "file": str(f.relative_to(archive)).replace("\\", "/"),
            "folder": f.parent.parent.name if f.parent.name == "Links" else f.parent.name,
            "kind": kind_of(f.name),
            "width": large.width,
            "height": large.height,
            "distance": dist,
            "district": district,
            "volume": match["volume"] if match else None,
            "page": match["page"] if match else None,
            "work": work["slug"] if work else None,
            "work_name": work["name"] if work else None,
        })
        status = f"{work['name']} (c{match['volume']} s{match['page']}, d={dist})" if work else f"eşleşmedi (d={dist})"
        print(f"[{i}/{len(files)}] {f.name} → {status}", file=sys.stderr)

    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    ok = sum(1 for m in manifest if m["work"])
    print(f"{ok}/{len(manifest)} fotoğraf bir esere bağlandı → {out_dir.relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
