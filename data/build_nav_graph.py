"""OSM yaya ağından pilot navigasyon grafiği (Lynch grafiği) üretir.

Girdi:
  data/raw/osm_suleymaniye.json   Overpass çıktısı (README'deki sorgu)
  Supabase works_view             doğrulanmış eserler (landmark olarak bağlanır)
Çıktı:
  apps/mobile/assets/pilot/suleymaniye-nav.json   uygulamaya gömülü, internetsiz çalışır

Kaynak ve tahminler (saha ölçümüyle güncellenecek):
  - steps:  OSM highway=steps (step_count yoksa 1 = "basamak var")
  - surface, width, incline: OSM etiketleri; etiket yoksa varsayılan (paving, genişlik bilinmiyor, eğim 0)
  - noise:  OSM yol sınıfından tahmin (ana cadde gürültülü, yaya yolu sessiz)
  - landmarkVisibility: bir landmark'a 40 m'den yakın segmentler 0.5, diğerleri 0

Kullanım:  python -I data/build_nav_graph.py
"""

import json
import math
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OSM_FILE = ROOT / "data/raw/osm_suleymaniye.json"
OUT_FILE = ROOT / "apps/mobile/assets/pilot/suleymaniye-nav.json"
ENV_FILE = ROOT / "apps/mobile/.env"
COMPLEX_SLUG = "suleymaniye"
LANDMARK_SNAP_M = 60

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
NOISE = {"secondary": 0.8, "tertiary": 0.6, "unclassified": 0.4, "residential": 0.3, "service": 0.3, "living_street": 0.2}


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


def fetch_landmarks():
    env = read_env()
    url = env["EXPO_PUBLIC_SUPABASE_URL"] + f"/rest/v1/works_view?select=slug,name,type_slug,lng,lat&complex_slug=eq.{COMPLEX_SLUG}"
    req = urllib.request.Request(url, headers={"apikey": env["EXPO_PUBLIC_SUPABASE_KEY"]})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def parse_width_cm(tags):
    w = tags.get("width")
    if not w:
        return None
    try:
        return int(float(w.replace("m", "").strip()) * 100)
    except ValueError:
        return None


def build():
    osm = json.loads(OSM_FILE.read_text(encoding="utf-8"))
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

    landmarks = fetch_landmarks()
    walkable = list(usage.keys())
    snapped = {}  # osm node -> landmark
    for lm in landmarks:
        p = (lm["lng"], lm["lat"])
        best = min(walkable, key=lambda n: haversine(p, coords[n]))
        d = haversine(p, coords[best])
        if d <= LANDMARK_SNAP_M and best not in snapped:
            snapped[best] = lm
            key_nodes.add(best)
        else:
            print(f"  bağlanamadı: {lm['slug']} ({d:.0f} m)", file=sys.stderr)

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
        nodes.append(node)

    out = {
        "complex": COMPLEX_SLUG,
        "source": "OpenStreetMap katkıcıları (ODbL); landmark: Sezi works_view",
        "nodes": nodes,
        "segments": segments,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_lm = sum(1 for n in nodes if n["lynchType"] == "landmark")
    print(f"{len(nodes)} düğüm, {len(segments)} segment, {n_lm} landmark -> {OUT_FILE.relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    build()
