"""OSM yaya ağından pilot navigasyon grafiği (Lynch grafiği) üretir.

Girdi:
  data/raw/osm_<alan>.json        Overpass çıktısı (merkez çevresindeki yaya ağı)
  Supabase works_view             doğrulanmış eserler (konumu kesin olanlar landmark olur)
Çıktı:
  apps/mobile/assets/pilot/<alan>-nav.json   uygulamaya gömülü, internetsiz çalışır

Yeni pilot alan eklemek: AREAS sözlüğüne merkez/yarıçap/şehir girip Overpass çıktısını data/raw'a koymak yeter.

Kaynak ve tahminler (saha ölçümüyle güncellenecek):
  - steps:  OSM highway=steps (step_count yoksa 1 = "basamak var")
  - surface, width, incline: OSM etiketleri; etiket yoksa varsayılan (paving, genişlik bilinmiyor, eğim 0)
  - noise:  OSM yol sınıfından tahmin (ana cadde gürültülü, yaya yolu sessiz)
  - landmarkVisibility: bir landmark'a 40 m'den yakın segmentler 0.5, diğerleri 0

Kullanım:  python -I data/build_nav_graph.py [alan]   (varsayılan: bursa-hanlar)
"""

import json
import math
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "apps/mobile/.env"
LANDMARK_SNAP_M = 60

# Pilot alanlar: merkez (lng, lat), yarıçap (m) ve eserlerin geldiği il.
AREAS = {
    "bursa-hanlar": {
        "name": {"tr": "Ulu Cami ve Hanlar Bölgesi", "en": "Grand Mosque and Inns District"},
        "city": "bursa",
        "center": (29.06135, 40.18415),
        "radius": 650,
        "osm": "data/raw/osm_bursa_hanlar_650.json",
        # Ekibin seçtiği Lynch düğümleri (buluşma/varış) ve eser dışı yer işaretleri
        "lynch": "data/lynch/bursa-hanlar.json",
    },
}

SURFACE = {
    "asphalt": "asphalt",
    "paving_stones": "paving",
    "paved": "paving",
    "concrete": "paving",
    "sett": "cobble",
    "cobblestone": "cobble",
    "unhewn_cobblestone": "cobble",
    "stone": "cobble",
    "gravel": "gravel",
    "fine_gravel": "gravel",
    "compacted": "gravel",
    "marble": "marble",
}
NOISE = {"primary": 0.9, "secondary": 0.8, "tertiary": 0.6, "unclassified": 0.4, "residential": 0.3, "service": 0.3, "living_street": 0.2}


def haversine(a, b):
    r = 6371000
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dla, dlo = la2 - la1, math.radians(b[0] - a[0])
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def read_env():
    env = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


def fetch_landmarks(area):
    env = read_env()
    url = env["EXPO_PUBLIC_SUPABASE_URL"] + (
        "/rest/v1/works_view?select=slug,name,type_slug,lng,lat"
        f"&city_slug=eq.{area['city']}&location_precision=eq.exact&lng=not.is.null"
    )
    req = urllib.request.Request(url, headers={"apikey": env["EXPO_PUBLIC_SUPABASE_KEY"]})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.load(r)
    return [w for w in rows if haversine(area["center"], (w["lng"], w["lat"])) <= area["radius"]]


def parse_width_cm(tags):
    w = tags.get("width")
    if not w:
        return None
    try:
        return int(float(w.replace("m", "").strip()) * 100)
    except ValueError:
        return None


def build(area_slug):
    area = AREAS[area_slug]
    out_file = ROOT / f"apps/mobile/assets/pilot/{area_slug}-nav.json"
    osm = json.loads((ROOT / area["osm"]).read_text(encoding="utf-8"))
    coords = {e["id"]: (e["lon"], e["lat"]) for e in osm["elements"] if e["type"] == "node"}
    ways = [e for e in osm["elements"] if e["type"] == "way"]

    # Kavşak, uç ve landmark bağlantı noktaları graf düğümü olur; aradaki noktalar geometri.
    usage = defaultdict(int)
    for w in ways:
        for n in w["nodes"]:
            usage[n] += 1
    key_nodes = {n for n, c in usage.items() if c > 1}
    for w in ways:
        key_nodes.add(w["nodes"][0])
        key_nodes.add(w["nodes"][-1])

    landmarks = fetch_landmarks(area)
    walkable = list(usage.keys())
    snapped = {}  # osm node -> landmark
    for lm in landmarks:
        p = (lm["lng"], lm["lat"])
        # Aynı noktadaki iki eser (ör. Koza Hanı ve mescidi) ayrı düğümlere bağlanır.
        free = [n for n in walkable if n not in snapped]
        best = min(free, key=lambda n: haversine(p, coords[n]))
        d = haversine(p, coords[best])
        if d <= LANDMARK_SNAP_M:
            snapped[best] = lm
            key_nodes.add(best)
        else:
            print(f"  bağlanamadı: {lm['slug']} ({d:.0f} m)", file=sys.stderr)

    # Seçilmiş Lynch noktaları: buluşma/varış düğümleri ve eser dışı yer işaretleri (Heykel, Saat Kulesi…).
    curated = {}  # osm node -> nokta
    points = json.loads((ROOT / area["lynch"]).read_text(encoding="utf-8"))["points"] if area.get("lynch") else []
    for pt in points:
        p = tuple(pt["location"])
        free = [n for n in walkable if n not in snapped and n not in curated]
        best = min(free, key=lambda n: haversine(p, coords[n]))
        d = haversine(p, coords[best])
        if d <= LANDMARK_SNAP_M:
            curated[best] = pt
            key_nodes.add(best)
        else:
            print(f"  nokta bağlanamadı: {pt['id']} ({d:.0f} m)", file=sys.stderr)

    segments = []
    for w in ways:
        tags = w.get("tags", {})
        hw = tags.get("highway")
        start = 0
        for i in range(1, len(w["nodes"])):
            if w["nodes"][i] in key_nodes:
                part = w["nodes"][start : i + 1]
                geom = [coords[n] for n in part]
                length = sum(haversine(geom[k], geom[k + 1]) for k in range(len(geom) - 1))
                if length > 0.5 and part[0] != part[-1]:
                    steps = 0
                    if hw == "steps":
                        try:
                            steps = int(tags.get("step_count", "1"))
                        except ValueError:
                            steps = 1
                    seg = {
                        "id": f"w{w['id']}_{start}",
                        "from": str(part[0]),
                        "to": str(part[-1]),
                        "lengthM": round(length, 1),
                        "steps": steps,
                        "slopePct": 0,
                        "surface": SURFACE.get(tags.get("surface", ""), "paving"),
                        "kerb": False,
                        "noise": NOISE.get(hw, 0.1),
                        "landmarkVisibility": 0,
                        "blocked": False,
                        "geometry": [[round(x, 7), round(y, 7)] for x, y in geom],
                        "osm": {"way": w["id"], "highway": hw, **({"incline": tags["incline"]} if "incline" in tags else {})},
                    }
                    # Sokak adı: Lynch "yol" öğesi ("Uzunçarşı boyunca").
                    if tags.get("name"):
                        seg["name"] = tags["name"]
                    width = parse_width_cm(tags)
                    if width:
                        seg["widthCm"] = width
                    segments.append(seg)
                start = i

    # En büyük bağlı bileşen dışındaki kopuk parçalar atılır.
    adj = defaultdict(set)
    for s in segments:
        adj[s["from"]].add(s["to"])
        adj[s["to"]].add(s["from"])
    seen, best_comp = set(), set()
    for n in adj:
        if n in seen:
            continue
        comp, stack = set(), [n]
        while stack:
            x = stack.pop()
            if x in comp:
                continue
            comp.add(x)
            stack.extend(adj[x] - comp)
        seen |= comp
        if len(comp) > len(best_comp):
            best_comp = comp
    segments = [s for s in segments if s["from"] in best_comp]

    landmark_pts = [coords[n] for n in snapped if str(n) in best_comp]
    landmark_pts += [coords[n] for n, pt in curated.items() if str(n) in best_comp and "landmark" in pt["roles"]]
    for s in segments:
        mid = s["geometry"][len(s["geometry"]) // 2]
        if any(haversine(mid, p) < 40 for p in landmark_pts):
            s["landmarkVisibility"] = 0.5

    nodes = []
    for n in sorted(best_comp, key=int):
        node = {"id": n, "lynchType": "node", "location": [round(coords[int(n)][0], 7), round(coords[int(n)][1], 7)]}
        lm = snapped.get(int(n))
        if lm:
            node.update({"lynchType": "landmark", "name": lm["name"], "workSlug": lm["slug"], "workType": lm["type_slug"]})
        pt = curated.get(int(n))
        if pt:
            node.update({"lynchType": "landmark" if "landmark" in pt["roles"] else "node", "name": pt["name"], "pointId": pt["id"], "roles": pt["roles"]})
            if pt.get("sound"):
                node["sound"] = pt["sound"]
        nodes.append(node)

    # Başlangıç seçenekleri: buluşma/varış noktaları, dosyadaki sırayla ("Neredesiniz?").
    starts = [
        {"id": pt["id"], "nodeId": str(n), "name": pt["name"], "location": [round(coords[n][0], 7), round(coords[n][1], 7)]}
        for n, pt in sorted(curated.items(), key=lambda kv: points.index(kv[1]))
        if "gathering" in pt["roles"] and str(n) in best_comp
    ]

    out = {
        "area": area_slug,
        "name": area["name"],
        "center": list(area["center"]),
        "source": "OpenStreetMap katkıcıları (ODbL); landmark: Sezi works_view + data/lynch",
        "starts": starts,
        "nodes": nodes,
        "segments": segments,
    }
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_lm = sum(1 for n in nodes if n["lynchType"] == "landmark")
    print(f"{len(nodes)} düğüm, {len(segments)} segment, {n_lm} landmark, {len(starts)} başlangıç -> {out_file.relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "bursa-hanlar")
