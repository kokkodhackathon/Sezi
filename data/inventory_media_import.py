"""Eşleşmiş envanter fotoğraflarını Storage'a yükler ve `media` satırlarını üretir.

Girdi:  data/out/photos/<il>/manifest.json  (data/inventory_photos.py çıktısı)
Çıktı:  supabase/seed_media_<il>.sql         (yeniden çalıştırılabilir; kaynak dosyaya göre günceller)
Yükleme: Supabase CLI ile `media/<il>/<id>.webp` ve `media/<il>/<id>_t.webp`

Doğrulama kuralı: eşleşme uzaklığı ≤ 30 olan fotoğraf `verified` girer; 31–48 arası `draft` kalır
ve admin panelinde gözle onaylanır (doğrulanmamış içerik gerçek bilgi gibi gösterilmez).

Kullanım:
  python -I data/inventory_media_import.py bursa [--upload]
  npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_media_bursa.sql
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT_REF = "jejsvycpzulpleftkssj"
VERIFIED_MAX_DISTANCE = 30
CREDIT = "Vakıf Katılım, Vakıf Eserleri Envanteri"
KIND_ORDER = {"photo": 0, "aerial": 1, "inscription": 2}
ALT = {
    "photo": ("{name}", "{name}"),
    "aerial": ("{name}, havadan görünüm", "{name}, aerial view"),
    "inscription": ("{name}, kitabe", "{name}, inscription"),
}


def sql(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def upload(city: str, folder: Path):
    # CLI dizini tek seferde, yinelemeli kopyalar.
    cmd = ["npx", "-y", "supabase@latest", "storage", "cp", "-r", str(folder), f"ss:///media/{city}",
           "--linked", "--project-ref", PROJECT_REF, "--experimental"]
    # Ağ kesintisinde bir kez daha denenir; aynı dosyanın yeniden yüklenmesi zararsızdır.
    if subprocess.run(cmd, shell=sys.platform == "win32").returncode != 0:
        subprocess.run(cmd, check=True, shell=sys.platform == "win32")


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    city = sys.argv[1]
    folder = ROOT / "data/out/photos" / city
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    matched = [m for m in manifest if m["work"]]

    # Aynı eserin fotoğrafları: önce normal fotoğraf, sonra havadan, sonra kitabe; her grupta en güçlü eşleşme önce.
    by_work: dict[str, list] = {}
    for m in matched:
        by_work.setdefault(m["work"], []).append(m)
    rows = []
    for work, items in by_work.items():
        items.sort(key=lambda m: (KIND_ORDER[m["kind"]], m["distance"]))
        for order, m in enumerate(items):
            tr, en = ALT[m["kind"]]
            rows.append({
                "work": work,
                "path": f"{city}/{m['id']}.webp",
                "thumb": f"{city}/{m['id']}_t.webp",
                "alt": {"tr": tr.format(name=m["work_name"]), "en": en.format(name=m["work_name"])},
                "kind": m["kind"],
                "width": m["width"],
                "height": m["height"],
                "file": m["file"],
                "volume": m["volume"],
                "page": m["page"],
                "order": order,
                "status": "verified" if m["distance"] <= VERIFIED_MAX_DISTANCE else "draft",
            })

    values = ",\n".join(
        f"({sql(r['work'])}, {sql(r['path'])}, {sql(r['thumb'])}, {sql(json.dumps(r['alt'], ensure_ascii=False))}::jsonb, "
        f"{sql(CREDIT)}, {r['order']}, {sql(r['status'])}::public.content_status, {sql(r['kind'])}, {r['width']}, {r['height']}, "
        f"{sql(r['file'])}, {sql(r['volume'])}, {sql(r['page'])})"
        for r in rows
    )
    out = ROOT / f"supabase/seed_media_{city}.sql"
    out.write_text(
        f"""-- Otomatik üretildi: data/inventory_media_import.py. Elle düzenlemeyin.
-- Kaynak: {CREDIT} fotoğraf arşivi ({city}); organizasyonun hackathon için paylaşımı.
begin;
insert into public.media (work_id, storage_path, thumb_path, alt_text, credit, sort_order, status, kind, width, height,
                          source_file, source_volume, source_page)
select w.id, v.path, v.thumb, v.alt, v.credit, v.sort_order, v.status, v.kind, v.width, v.height, v.file, v.volume, v.page
from (values
{values}
) as v(slug, path, thumb, alt, credit, sort_order, status, kind, width, height, file, volume, page)
join public.works w on w.slug = v.slug
on conflict (source_file) where source_file is not null do update set
  work_id = excluded.work_id, storage_path = excluded.storage_path, thumb_path = excluded.thumb_path,
  alt_text = excluded.alt_text, sort_order = excluded.sort_order, status = excluded.status, kind = excluded.kind,
  width = excluded.width, height = excluded.height, source_volume = excluded.source_volume, source_page = excluded.source_page;
commit;
""",
        encoding="utf-8",
    )
    verified = sum(1 for r in rows if r["status"] == "verified")
    print(f"{len(rows)} fotoğraf ({verified} doğrulanmış, {len(rows) - verified} taslak), {len(by_work)} eser → {out.relative_to(ROOT)}", file=sys.stderr)

    if "--upload" in sys.argv:
        # Yalnızca eşleşen fotoğraflar yüklenir: geçici klasöre kopyalanıp tek seferde gönderilir.
        staging = folder / "_upload"
        staging.mkdir(exist_ok=True)
        for r in rows:
            for key in ("path", "thumb"):
                name = Path(r[key]).name
                (staging / name).write_bytes((folder / name).read_bytes())
        upload(city, staging)
        print(f"{len(rows) * 2} dosya yüklendi → media/{city}/", file=sys.stderr)


if __name__ == "__main__":
    main()
