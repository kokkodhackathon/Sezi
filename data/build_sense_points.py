"""Pilot alanda yön bulmaya yardım edebilecek duyu ipucu adaylarını (OSM) taslak nokta olarak üretir.

Aday türleri (nav_points.cue):
  water   amenity=fountain                      su akıyorsa sesi duyulabilir
  bakery  shop=bakery | shop=pastry             açıkken kokusu gelebilir
  prayer  amenity=place_of_worship + religion=muslim (adı olanlar)   ezan okunurken ses gelebilir

Bunlar aday, kesin bilgi değil: çeşme kuru, fırın kapanmış, cami ezan okutmuyor ya da ses binalar
arasında başka yönden geliyor olabilir. Bu yüzden her satır `draft` girer; admin sahada bakıp
(field_checked) yayınlar. Yayındaki nokta yer işareti olarak anılınca uygulama ipucunu
"olabilir" diye söyler; talimat hiçbir zaman yalnız buna dayanmaz.

Girdi:  Overpass (alan merkezi çevresi) -> data/raw/osm_<alan>_sense.json (önbellek)
        apps/mobile/assets/pilot/<alan>-nav.json (yol grafiği: uzak adaylar elenir)
Çıktı:  supabase/seed_sense_points.sql (tekrar uygulanabilir: aynı OSM kimliği ikinci kez girmez)

Uygulama:
  npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_sense_points.sql

Kaynak: OpenStreetMap katkıcıları (ODbL). Kullanım: python -I data/build_sense_points.py [alan] [--refresh]
"""

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_buildings import overpass  # noqa: E402
from build_nav_graph import AREAS, LANDMARK_SNAP_M, fetch_landmarks, haversine  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
# Aday bu mesafede ve uygun türde bir esere yakınsa o esere bağlanır: planlayıcı eser düğümünde ipucunu
# ancak nokta o esere bağlıysa söyler (başka bir eserin adıyla anılmasın).
WORK_LINK_M = 35
WORK_TYPES = {"prayer": {"cami", "mescit"}, "water": {"cesme", "sebil", "sadirvan"}, "bakery": set()}

# Ad yoksa kullanılan genel başlık (TR, EN).
GENERIC = {
    "water": ("Çeşme", "Fountain"),
    "bakery": ("Fırın", "Bakery"),
    "pastry": ("Pastane", "Pastry shop"),
}


def fetch(area_slug: str, area: dict, refresh: bool) -> dict:
    cache = ROOT / f"data/raw/osm_{area_slug}_sense.json"
    if cache.exists() and not refresh:
        return json.loads(cache.read_text(encoding="utf-8"))
    lng, lat = area["center"]
    r = area["radius"]
    q = f"""[out:json][timeout:120];
(
  nwr["amenity"="fountain"](around:{r},{lat},{lng});
  nwr["shop"~"^(bakery|pastry)$"](around:{r},{lat},{lng});
  nwr["amenity"="place_of_worship"]["religion"="muslim"](around:{r},{lat},{lng});
);
out center tags;"""
    data = overpass(q)
    cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def classify(tags: dict) -> str | None:
    if tags.get("amenity") == "fountain":
        return "water"
    if tags.get("shop") in ("bakery", "pastry"):
        return "bakery"
    if tags.get("amenity") == "place_of_worship":
        return "prayer"
    return None


def title_of(cue: str, tags: dict) -> dict | None:
    name = tags.get("name")
    if cue == "prayer":
        # "Bu camiden" diye anılır: adı olmayan ibadet yeri (han içi mescit vb.) aday olmaz.
        return {"tr": name, **({"en": tags["name:en"]} if tags.get("name:en") else {})} if name else None
    tr, en = GENERIC["pastry" if tags.get("shop") == "pastry" else cue]
    return {"tr": name, "en": tags.get("name:en", name)} if name else {"tr": tr, "en": en}


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def build(area_slug: str, refresh: bool):
    area = AREAS[area_slug]
    graph = json.loads((ROOT / f"apps/mobile/assets/pilot/{area_slug}-nav.json").read_text(encoding="utf-8"))
    nodes = [tuple(n["location"]) for n in graph["nodes"]]
    today = date.today().isoformat()
    works = fetch_landmarks(area)

    rows, skipped = [], {"adsız ibadet yeri": 0, "yol grafiğine uzak": 0}
    for el in fetch(area_slug, area, refresh)["elements"]:
        tags = el.get("tags", {})
        cue = classify(tags)
        if not cue:
            continue
        lng, lat = (el["lon"], el["lat"]) if el["type"] == "node" else (el["center"]["lon"], el["center"]["lat"])
        title = title_of(cue, tags)
        if title is None:
            skipped["adsız ibadet yeri"] += 1
            continue
        # Planlayıcı yer işaretini en yakın düğüme bağlar; bu mesafeden uzaksa hiç anılmaz.
        if min(haversine((lng, lat), n) for n in nodes) > LANDMARK_SNAP_M:
            skipped["yol grafiğine uzak"] += 1
            continue
        osm_id = f"{el['type']}/{el['id']}"
        tag = "amenity=fountain" if cue == "water" else f"shop={tags['shop']}" if cue == "bakery" else "amenity=place_of_worship"
        note = (
            f"Ad ve konum: OpenStreetMap {osm_id} (ODbL), {today}; {tag}. "
            "Duyu ipucu adayı (OSM'den otomatik): sahada doğrulanmadan yayınlanmaz "
            "(çeşme akıyor mu, fırın açık mı, ezan bu noktadan duyuluyor mu)."
        )
        # Uygun türde yakın eser varsa nokta ona bağlanır (Ulu Cami'nin ezan ipucu Ulu Cami düğümünde söylenir).
        near = [(haversine((lng, lat), (w["lng"], w["lat"])), w["slug"]) for w in works if w["type_slug"] in WORK_TYPES[cue]]
        work = min(near)[1] if near and min(near)[0] <= WORK_LINK_M else None
        rows.append((cue, title, lng, lat, osm_id, note, work))

    rows.sort(key=lambda r: (r[0], r[1]["tr"]))
    values = ",\n".join(
        f"  ({sql_str(json.dumps(t, ensure_ascii=False))}::jsonb, 'SRID=4326;POINT({lng:.7f} {lat:.7f})', '{cue}', {sql_str(note)}, "
        f"{sql_str('OpenStreetMap ' + osm + ' ')}, {sql_str(work) if work else 'null'})"
        for cue, t, lng, lat, osm, note, work in rows
    )
    out = ROOT / "supabase/seed_sense_points.sql"
    out.write_text(
        "-- Üretildi: data/build_sense_points.py (elle düzenlemeyin). Duyu ipucu adayları, hepsi taslak.\n"
        "-- Aynı OSM kimliği zaten varsa (kaynak notunda) ikinci kez girmez.\n"
        "insert into public.nav_points (city_id, title, roles, location, cue, source_note, status, radius_m, work_id)\n"
        "select c.id, v.title, '{landmark}', v.location::extensions.geography, v.cue::public.sense_cue, v.source_note, 'draft', 25,\n"
        "  (select w.id from public.works w where w.slug = v.work_slug)\n"
        "from public.cities c, (values\n"
        f"{values}\n"
        ") as v(title, location, cue, source_note, osm_key, work_slug)\n"
        f"where c.slug = {sql_str(area['city'])}\n"
        "  and not exists (select 1 from public.nav_points p where p.source_note like '%' || v.osm_key || '%');\n",
        encoding="utf-8",
    )
    by = {k: sum(1 for r in rows if r[0] == k) for k in ("water", "bakery", "prayer")}
    linked = sum(1 for r in rows if r[6])
    print(f"{len(rows)} aday -> {out.relative_to(ROOT)}  ({', '.join(f'{k} {v}' for k, v in by.items())}; esere bağlı {linked})")
    print("  elenen:", ", ".join(f"{k} {v}" for k, v in skipped.items()))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    build(args[0] if args else "bursa-hanlar", "--refresh" in sys.argv)
