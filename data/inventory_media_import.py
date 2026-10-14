"""Eşleşmiş envanter fotoğraflarını Storage'a yükler ve `media` satırlarını üretir.

Girdi:  data/out/photos/<il>/manifest.json  (data/inventory_photos.py çıktısı)
Çıktı:  supabase/seed_media_<il>.sql         (yeniden çalıştırılabilir; kaynak dosyaya göre günceller)
Yükleme: Supabase CLI ile `media/<il>/<id>.webp` ve `media/<il>/<id>_t.webp`

Doğrulama kuralı: eşleşme uzaklığı ≤ 30 olan fotoğraf `verified` girer; 31–48 arası `draft` kalır
ve admin panelinde gözle onaylanır (doğrulanmamış içerik gerçek bilgi gibi gösterilmez).
Kitapta eşleşmeyen fotoğraflar esersiz taslak olarak "fotoğraf kutusu"na girer; admin panelinde esere bağlanır.
Yeniden çalıştırmak admin kararlarını (bağlanan eser, onay, sıra, alt metin) ezmez; yalnızca dosya bilgileri güncellenir.

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


def upload(city: str, staging: Path):
    """`staging/<il>` klasörünü `media/` altına kopyalar → media/<il>/<dosya>.

    Hedefte klasör zaten varsa CLI kaynağı içine koyar; bu yüzden kaynak klasörün adı il adıyla aynıdır.
    Windows'ta alt süreçten çalıştırma güvenilir değil: başarısız olursa komut yazdırılır, elle çalıştırılır.
    """
    cmd = ["npx", "-y", "supabase@latest", "storage", "cp", "-r", str(staging / city), "ss:///media",
           "--linked", "--project-ref", PROJECT_REF, "--experimental"]
    if subprocess.run(cmd, shell=sys.platform == "win32").returncode != 0:
        command = " ".join(f'"{c}"' if " " in c else c for c in cmd)
        print(f"Yükleme alt süreçte başarısız oldu; şu komutu kabukta çalıştırın: {command}", file=sys.stderr)


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
    # Kitapta eşleşmeyenler: esersiz taslak, admin panelinin fotoğraf kutusunda bekler.
    unmatched = [m for m in manifest if not m["work"]]
    for m in unmatched:
        rows.append({
            "work": None,
            "path": f"{city}/{m['id']}.webp",
            "thumb": f"{city}/{m['id']}_t.webp",
            "alt": {"tr": "Envanter arşivi fotoğrafı", "en": "Inventory archive photo"},
            "kind": m["kind"],
            "width": m["width"],
            "height": m["height"],
            "file": m["file"],
            "volume": None,
            "page": None,
            "order": 99,
            "status": "draft",
        })
    folder_of = {m["file"]: m.get("folder") for m in manifest}

    values = ",\n".join(
        f"({sql(r['work'])}, {sql(r['path'])}, {sql(r['thumb'])}, {sql(json.dumps(r['alt'], ensure_ascii=False))}::jsonb, "
        f"{sql(CREDIT)}, {r['order']}, {sql(r['status'])}::public.content_status, {sql(r['kind'])}, {r['width']}, {r['height']}, "
        f"{sql(r['file'])}, {sql(r['volume'])}, {sql(r['page'])}, {sql(folder_of.get(r['file']))})"
        for r in rows
    )
    out = ROOT / f"supabase/seed_media_{city}.sql"
    out.write_text(
        f"""-- Otomatik üretildi: data/inventory_media_import.py. Elle düzenlemeyin.
-- Kaynak: {CREDIT} fotoğraf arşivi ({city}); organizasyonun hackathon için paylaşımı.
begin;
insert into public.media (work_id, storage_path, thumb_path, alt_text, credit, sort_order, status, kind, width, height,
                          source_file, source_volume, source_page, folder)
select w.id, v.path, v.thumb, v.alt, v.credit, v.sort_order, v.status, v.kind, v.width, v.height, v.file, v.volume, v.page, v.folder
from (values
{values}
) as v(slug, path, thumb, alt, credit, sort_order, status, kind, width, height, file, volume, page, folder)
left join public.works w on w.slug = v.slug
-- Var olan satırda yalnızca dosya bilgileri güncellenir: eser, onay, sıra ve alt metin admin kararıdır.
on conflict (source_file) where source_file is not null do update set
  storage_path = excluded.storage_path, thumb_path = excluded.thumb_path, kind = excluded.kind,
  width = excluded.width, height = excluded.height, folder = excluded.folder,
  source_volume = coalesce(public.media.source_volume, excluded.source_volume),
  source_page = coalesce(public.media.source_page, excluded.source_page);
commit;
""",
        encoding="utf-8",
    )
    verified = sum(1 for r in rows if r["status"] == "verified")
    drafts = len(rows) - verified - len(unmatched)
    print(f"{len(rows)} fotoğraf ({verified} doğrulanmış, {drafts} taslak, {len(unmatched)} fotoğraf kutusunda), {len(by_work)} eser → {out.relative_to(ROOT)}", file=sys.stderr)

    if "--upload" in sys.argv:
        # Fotoğraflar geçici klasöre kopyalanıp tek seferde gönderilir.
        staging = folder / "_stage"
        (staging / city).mkdir(parents=True, exist_ok=True)
        for r in rows:
            for key in ("path", "thumb"):
                name = Path(r[key]).name
                (staging / city / name).write_bytes((folder / name).read_bytes())
        upload(city, staging)
        print(f"{len(rows) * 2} dosya yüklendi → media/{city}/", file=sys.stderr)


if __name__ == "__main__":
    main()
