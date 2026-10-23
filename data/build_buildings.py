"""Pilot alanın bina tabanlarını (OSM) 3B harita katmanı için üretir.

Girdi:
  Overpass (bina way/relation, alan merkezi çevresi) -> data/raw/osm_<alan>_buildings.json (önbellek)
  Supabase works_view: doğrulanmış, konumu kesin eserler (yer işareti binası bunlarla eşlenir)
Çıktı:
  apps/mobile/assets/pilot/<alan>-buildings.json   uygulamaya gömülü GeoJSON (internetsiz çalışır)

Özellikler (kısa anahtar, dosya küçük kalsın):
  h   yükseklik (m): OSM height, yoksa building:levels × 3,2 m, yoksa türe göre görünüm tahmini
  b   taban yüksekliği (m): OSM min_height (yoksa 0)
  e   1 = yükseklik tahminî (OSM'de yok). Yalnız görünüm içindir; uygulamada bilgi olarak gösterilmez.
  w   eser slug'ı (bina bir esere aitse), t = eser türü (work_types.slug)

Yer işareti binası: eserin OSM kimliği (external_ids.osm, ör. way/26434413) varsa o; yoksa eser konumunu
içeren bina; o da yoksa 20 m içindeki en yakın bina. Eşleşmeyen eser rapor edilir, uydurulmaz.

Kaynak: OpenStreetMap katkıcıları (ODbL). Kullanım: python -I data/build_buildings.py [alan] [--refresh]
"""

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_nav_graph import AREAS, haversine, read_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
UA = "Sezi/0.1 (KOK&KOD hackathon; edizkeskin@gmail.com)"
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
LEVEL_M = 3.2
SNAP_M = 20
# OSM'de yüksekliği olmayan binalar için görünüm tahmini (m); kat sayısı ya da yükseklik varsa kullanılmaz.
DEFAULT_H = {"mosque": 12.0, "religious": 10.0, "commercial": 9.0, "retail": 7.0, "apartments": 15.0}
DEFAULT_H_OTHER = 8.0


def overpass(query: str) -> dict:
    last = None
    for url in MIRRORS:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=420) as r:
                return json.load(r)
        except Exception as e:  # sıradaki aynaya geç
            last = e
            time.sleep(2)
    raise RuntimeError(f"Overpass yanıt vermedi: {last}")


def fetch_buildings(area_slug: str, area: dict, refresh: bool) -> dict:
    cache = ROOT / f"data/raw/osm_{area_slug}_buildings.json"
    if cache.exists() and not refresh:
        return json.loads(cache.read_text(encoding="utf-8"))
    lng, lat = area["center"]
    r = area["radius"]
    q = f"""[out:json][timeout:400];
(way["building"](around:{r},{lat},{lng});relation["building"](around:{r},{lat},{lng}););
out body geom;"""
    data = overpass(q)
    cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data

def fetch_works(area: dict) -> list[dict]:
    env = read_env()
    base, key = env["EXPO_PUBLIC_SUPABASE_URL"], env["EXPO_PUBLIC_SUPABASE_KEY"]

    def get(path: str):
        req = urllib.request.Request(base + path, headers={"apikey": key})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)

    rows = get(f"/rest/v1/works_view?select=slug,type_slug,lng,lat&status=eq.verified&city_slug=eq.{area['city']}&location_precision=eq.exact&lng=not.is.null")
    rows = [w for w in rows if haversine(area["center"], (w["lng"], w["lat"])) <= area["radius"]]
    if rows:
        slugs = ",".join(urllib.parse.quote(w["slug"]) for w in rows)
        ids = {r["slug"]: r.get("external_ids") or {} for r in get(f"/rest/v1/works?select=slug,external_ids&slug=in.({slugs})")}
        for w in rows:
            w["external_ids"] = ids.get(w["slug"], {})
    return rows


def _join(segs: list[list[list[float]]]) -> list[list[list[float]]]:
    """Way parçalarını uç uca ekleyip kapalı halkalar kurar (yön fark etmez)."""
    segs = [s[:] for s in segs if len(s) >= 2]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while cur[0] != cur[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if cur[-1] == s[0]:
                    cur += s[1:]
                elif cur[-1] == s[-1]:
                    cur += list(reversed(s))[1:]
                elif cur[0] == s[-1]:
                    cur = s[:-1] + cur
                elif cur[0] == s[0]:
                    cur = list(reversed(s))[:-1] + cur
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(cur) >= 4 and cur[0] == cur[-1]:
            rings.append(cur)
    return rings


def polygons_of(el: dict) -> list[list[list[list[float]]]]:
    """Way: tek halkalı poligon. Relation (multipolygon): dış halkalar ve içlerindeki avlu boşlukları."""
    pt = lambda p: [round(p["lon"], 6), round(p["lat"], 6)]  # noqa: E731
    if el["type"] == "way":
        ring = [pt(p) for p in el.get("geometry", [])]
        return [[ring]] if len(ring) >= 4 and ring[0] == ring[-1] else []
    members = [m for m in el.get("members", []) if m.get("type") == "way" and m.get("geometry")]
    outers = _join([[pt(p) for p in m["geometry"]] for m in members if m.get("role") != "inner"])
    inners = _join([[pt(p) for p in m["geometry"]] for m in members if m.get("role") == "inner"])
    polys = [[o] for o in outers]
    for hole in inners:
        owner = next((p for p in polys if contains(p[0], tuple(hole[0]))), None)
        if owner:
            owner.append(hole)
    return polys


def height_of(tags: dict) -> tuple[float, float, bool]:
    def num(v):
        try:
            return float(str(v).replace("m", "").replace(",", ".").strip())
        except ValueError:
            return None

    base = num(tags.get("min_height")) or 0.0
    h = num(tags.get("height"))
    if h is None and num(tags.get("building:levels")) is not None:
        h = num(tags["building:levels"]) * LEVEL_M + base
    if h is not None and h > base:
        return round(h, 1), round(base, 1), False
    kind = "mosque" if tags.get("building") == "mosque" or tags.get("amenity") == "place_of_worship" else tags.get("building", "")
    return DEFAULT_H.get(kind, DEFAULT_H_OTHER), 0.0, True


def contains(ring: list[list[float]], p: tuple[float, float]) -> bool:
    x, y = p
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def centroid(ring):
    xs = [p[0] for p in ring[:-1]]
    ys = [p[1] for p in ring[:-1]]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _to_m(lat0: float):
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110540.0
    return (lambda p: (p[0] * kx, p[1] * ky)), (lambda q: [round(q[0] / kx, 7), round(q[1] / ky, 7)])


def offset_ring(ring: list[list[float]], d: float) -> list[list[float]]:
    """Halkayı d metre dışa (d<0 içe) kaydırır; köşelerde açıortay yönünde (sivri köşe sınırlı)."""
    fwd, back = _to_m(ring[0][1])
    pts = [fwd(p) for p in ring[:-1]]
    area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1])) / 2
    sign = 1 if area > 0 else -1  # saat yönü tersi (CCW) için dış normal (dy, -dx)
    n = len(pts)
    out = []
    for i in range(n):
        (px, py), (cx, cy), (nx, ny) = pts[i - 1], pts[i], pts[(i + 1) % n]
        def normal(ax, ay, bx, by):
            dx, dy = bx - ax, by - ay
            ln = math.hypot(dx, dy) or 1.0
            return sign * dy / ln, -sign * dx / ln
        n1, n2 = normal(px, py, cx, cy), normal(cx, cy, nx, ny)
        mx, my = n1[0] + n2[0], n1[1] + n2[1]
        ml = math.hypot(mx, my)
        if ml < 1e-9:
            mx, my, ml = n1[0], n1[1], 1.0
        mx, my = mx / ml, my / ml
        cos_half = max(mx * n1[0] + my * n1[1], 0.5)  # sivri köşede en çok 2 kat
        out.append(back((cx + mx * d / cos_half, cy + my * d / cos_half)))
    return out + [out[0]]


def convex_hull(points: list[tuple[float, float]]) -> list[list[float]]:
    pts = sorted(set(points))
    if len(pts) < 3:
        return []
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])  # noqa: E731
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    return [list(p) for p in hull] + [list(hull[0])]


def mapbox_height(token: str, lng: float, lat: float) -> float | None:
    """Mapbox'ın bu noktadaki bina yüksekliği (Standard 3B binalarını bu veri çizer)."""
    url = (f"https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/{lng},{lat}.json"
           f"?layers=building&radius=10&limit=10&access_token={token}")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        feats = json.load(r).get("features", [])
    hs = [f["properties"].get("height") for f in feats if f["properties"].get("height") is not None]
    return max(hs) if hs else None


# Yer işareti tabanı Mapbox binasını tamamen sarar: aynı duvar ve çatı üst üste gelip titreşmesin.
GROW_M = 0.8
RISE_M = 1.0
DISTRICT_PAD_M = 35


def build(area_slug: str, refresh: bool):
    area = AREAS[area_slug]
    raw = fetch_buildings(area_slug, area, refresh)
    elems = {}
    for el in raw["elements"]:
        polys = polygons_of(el)
        if polys:
            elems[f"{el['type']}/{el['id']}"] = {"polys": polys, "tags": el.get("tags", {})}

    token = read_env()["EXPO_PUBLIC_MAPBOX_TOKEN"]
    works = fetch_works(area)
    used, features, missing, estimated = set(), [], [], 0
    for w in works:
        p = (w["lng"], w["lat"])
        osm = (w.get("external_ids") or {}).get("osm")
        key = osm if osm in elems else None
        if key is None:
            key = next((k for k, e in elems.items() if any(contains(poly[0], p) for poly in e["polys"])), None)
        if key is None:
            near = min(elems, key=lambda k: min(haversine(centroid(poly[0]), p) for poly in elems[k]["polys"]), default=None)
            if near and min(haversine(centroid(poly[0]), p) for poly in elems[near]["polys"]) <= SNAP_M:
                key = near
        if key is None or key in used:
            missing.append(w["slug"])
            continue
        used.add(key)
        osm_h, base, est = height_of(elems[key]["tags"])
        mb_h = mapbox_height(token, *p)
        time.sleep(0.2)
        known = [h for h in (None if est else osm_h, mb_h) if h is not None]
        h = (max(known) if known else osm_h) + RISE_M
        estimated += 0 if known else 1
        for poly in elems[key]["polys"]:
            rings = [offset_ring(poly[0], GROW_M)] + [offset_ring(r, -GROW_M) for r in poly[1:]]
            features.append({
                "type": "Feature",
                "properties": {"w": w["slug"], "t": w.get("type_slug") or "diger", "h": round(h, 1), "b": base, **({} if known else {"e": 1})},
                "geometry": {"type": "Polygon", "coordinates": rings},
            })

    # Bölge (Lynch "district"): pilot alandaki yer işareti binalarının dışbükey zarfı, biraz genişletilmiş.
    # Resmî sınır değildir; pilot alanın kapsadığı eserlerden türetilir ve öyle adlandırılır.
    hull = convex_hull([tuple(c) for f in features for c in f["geometry"]["coordinates"][0]])
    district = {"name": area["name"], "polygon": [offset_ring(hull, DISTRICT_PAD_M)]} if hull else None

    out = {
        "source": "OpenStreetMap katkıcıları (ODbL); yükseklik: Mapbox Streets",
        "area": {"slug": area_slug, "center": list(area["center"]), "radius": area["radius"]},
        "district": district,
        "landmarks": {"type": "FeatureCollection", "features": features},
    }
    dest = ROOT / f"apps/mobile/assets/pilot/{area_slug}-buildings.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{area_slug}: {len(used)}/{len(works)} eser binayla eşlendi, {len(features)} poligon ({estimated} yüksekliği tahminî)"
          f" -> {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)")
    if missing:
        print("  binası bulunamayan eserler:", ", ".join(missing))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    build(args[0] if args else "bursa-hanlar", "--refresh" in sys.argv)
