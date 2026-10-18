"""Her eser için birden çok kaynaktan konum ADAYI üretir, puanlar, çelişkiyi veto eder. Karar admin panelindedir.

Kaynaklar (ham yanıtlar data/raw/lc_*.json altında önbelleğe alınır; yeniden çalıştırmada ağa gidilmez):
  - osm       OpenStreetMap yapı kayıtları (Overpass, il başına bbox)
  - wikidata  ilin koordinatlı öğeleri (SPARQL: P131*, P31 sınıfları, TR/EN etiket)
  - override  data/geo_overrides.json koordinatlı girdileri (masa başı OSM doğrulaması)
  - nominatim / current  inventory_geo.json'daki mevcut sonuç (Wikidata ise ilgili wikidata adayına `current` işareti)
İlçe sınırları (OSM admin_level=6) yalnız ilçe vetosu içindir.

Adaylık: eserin adıyla ad benzerliği ≥ 0.6 olan, ilin OSM ve Wikidata havuzundan en iyi 3'er aday.
Veto: tür çelişkisi (cami ↔ çeşme…) ya da adayın eserin ilçesinin dışında kalması.
Puan (0–1): 0.55 ad benzerliği + 0.15 tür + 0.10 ilçe + 0.20 uyuşma; vetolu aday en çok 0.3; override 1.0.

Girdi:  data/out/inventory_geo.json, data/geo_overrides.json
Çıktı:  supabase/seed_location_candidates.sql (yeniden çalıştırılabilir; `pending` dışı kararlara dokunmaz)
Kullanım:  python -I data/location_candidates.py [--refresh]
"""

import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from inventory_geocode import PROVINCES, TYPE_WORDS, norm  # noqa: E402
from inventory_import import slugify, type_of  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / "data/out/inventory_geo.json"
OVERRIDES = ROOT / "data/geo_overrides.json"
RAW = ROOT / "data/raw"
OUT = ROOT / "supabase/seed_location_candidates.sql"
UA = "sezi-hackathon/1.0 (edizkeskin@gmail.com)"
OVERPASS = "https://overpass-api.de/api/interpreter"
SPARQL = "https://query.wikidata.org/sparql"

# il bbox'ı: güney,batı,kuzey,doğu (il geneli area[...] sorguları 500/502 verdi)
BBOX = {"Bursa": "39.55,28.10,40.70,30.05", "Konya": "36.70,31.20,39.40,34.60", "Hatay": "35.80,35.75,37.10,36.70"}
DISTRICT_CITIES = {"Bursa", "Konya"}  # Hatay envanterinde ilçe yok

MIN_SIM = 0.6  # ad benzerliği eşiği
TOP_N = 3  # kaynak başına en iyi aday sayısı
AGREE_M = 100  # uyuşma yarıçapı (metre)
# Puan ağırlıkları (toplam 1.0)
W_NAME, W_TYPE, W_DISTRICT, W_AGREE = 0.55, 0.15, 0.10, 0.20
VETO_CAP = 0.3
NEUTRAL_TYPE, NEUTRAL_DISTRICT = 0.07, 0.05  # tür/ilçe bilinmiyorsa yarım puan

# Eşleştirmede ayırt edici olmayan ek tür sözcükleri (geocode'daki TYPE_WORDS'e eklenir)
EXTRA_TYPE_WORDS = {
    "sebil", "sarnici", "sarnic", "bedesten", "bedesteni", "arastasi", "carsisi", "tekke", "zaviye", "kervansaray",
    "darussifasi", "darulhadis", "darulhadisi", "kilise", "sinagog", "kopru", "hankah", "hanikah", "mezarlik",
    "sadirvani", "sadirvan", "maksemi", "camisi", "mektep", "okulu", "kulliye", "imaret", "bath", "hammam", "hamami",
    "caravanserai", "bridge", "bazaar", "fountain", "tomb", "mausoleum", "turbe", "kumbet", "cesmesi", "cesme",
}
ALL_TYPE_WORDS = TYPE_WORDS | EXTRA_TYPE_WORDS

# Uyumlu tür grupları: gruptaki türler birbirini veto etmez.
COMPAT = [{"cami", "kulliye"}, {"turbe", "hazire"}, {"cesme", "sebil"}, {"han", "kervansaray"}]

# Wikidata P31 → work_types.slug (QID'ler SPARQL ile etiketleriyle doğrulandı, bkz. README)
CLASS_KIND = {
    "Q32815": "cami",  # mosque
    "Q1238457": "cami",  # masjid (mescit)
    "Q838159": "turbe",  # türbe
    "Q483453": "cesme",  # fountain
    "Q28077": "hamam",  # hammam
    "Q12280": "kopru",  # bridge
    "Q16970": "kilise",  # church building
    "Q44613": "kilise",  # monastery
    "Q34627": "sinagog",  # synagogue
    "Q186347": "kervansaray",  # caravanserai
    "Q132834": "medrese",  # madrasa
    "Q833913": "tekke",  # Sufi lodge
    "Q2302791": "imaret",  # imaret
    "Q71974": "kulliye",  # külliye
    "Q829896": "carsi",  # Bedesten
    "Q838858": "sarnic",  # cistern
    "Q522124": "konak",  # konak
    "Q39614": "hazire",  # cemetery
    "Q7075": "kutuphane",  # library
}

# Yapı olmayan sınıflar (mahalle, tepe, dağ, akarsu, ilçe…): türü bilinmiyorsa Wikidata havuzuna alınmaz.
NON_STRUCTURE = {
    "Q17051044", "Q54050", "Q8502", "Q755017", "Q1147395", "Q3957", "Q4022", "Q55075651", "Q8050526", "Q75520", "Q47521",
    "Q160091", "Q2231510", "Q486972", "Q46831", "Q35509", "Q23397", "Q23442", "Q532", "Q1400565", "Q515", "Q12357920",
    "Q124714", "Q811534", "Q718893", "Q1584134", "Q15661340",
}


def fold_key(s: str) -> str:
    return " ".join(norm(s).split())


# ---------------------------------------------------------------- ağ + önbellek


def http(url: str, data: bytes | None, headers: dict) -> bytes:
    """502/bağlantı kopması/aşırı yük: 20 sn bekleyip en çok 3 deneme."""
    last = None
    for attempt in range(3):
        req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **headers})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            last = e
        print(f"  yeniden denenecek ({last}); 20 sn bekleniyor", file=sys.stderr)
        time.sleep(20)
    raise RuntimeError(f"istek başarısız: {last}")


def cached(name: str, fetch, refresh: bool):
    path = RAW / name
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))
    print(f"ağdan alınıyor: {name}", file=sys.stderr)
    data = fetch()
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    return json.loads(http(OVERPASS, body, {"Content-Type": "application/x-www-form-urlencoded"}))


def osm_query(city: str) -> dict:
    b = BBOX[city]
    return overpass(
        f"""[out:json][timeout:240];(
nwr["name"]["amenity"="place_of_worship"]({b});
nwr["name"]["historic"]({b});
nwr["name"]["amenity"="public_bath"]({b});
nwr["name"]["amenity"="fountain"]({b});
);out center tags;"""
    )


def district_query(city: str) -> dict:
    return overpass(f"""[out:json][timeout:240];rel["boundary"="administrative"]["admin_level"="6"]({BBOX[city]});out geom;""")


def wikidata_query(city: str) -> list:
    q = f"""
SELECT ?item (SAMPLE(?tr) AS ?trL) (SAMPLE(?en) AS ?enL) (SAMPLE(?co) AS ?coord)
       (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cls), "entity/"); separator=",") AS ?classes)
       (SAMPLE(?admL) AS ?adm) WHERE {{
  ?item wdt:P131+ wd:{PROVINCES[city]} ; wdt:P625 ?co .
  OPTIONAL {{ ?item wdt:P31 ?cls }}
  OPTIONAL {{ ?item rdfs:label ?tr FILTER(lang(?tr)="tr") }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(lang(?en)="en") }}
  OPTIONAL {{ ?item wdt:P131 ?a . ?a rdfs:label ?admL FILTER(lang(?admL)="tr") }}
}} GROUP BY ?item"""
    url = SPARQL + "?" + urllib.parse.urlencode({"query": q})
    rows = json.loads(http(url, None, {"Accept": "application/sparql-results+json"}))["results"]["bindings"]
    out = []
    for b in rows:
        m = re.match(r"^Point\(([-\d.]+) ([-\d.]+)\)$", b["coord"]["value"])
        names = [b[k]["value"] for k in ("trL", "enL") if k in b]
        if not m or not names:
            continue  # başka gök cismi / bozuk koordinat / etiketsiz
        out.append(
            {
                "qid": b["item"]["value"].rsplit("/", 1)[-1],
                "names": names,
                "lng": float(m.group(1)),
                "lat": float(m.group(2)),
                "classes": [c for c in b.get("classes", {}).get("value", "").split(",") if c],
                "adm": b.get("adm", {}).get("value"),
            }
        )
    return out


# ---------------------------------------------------------------- coğrafya


def haversine_m(a, b) -> float:
    (lo1, la1), (lo2, la2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 12742000 * math.asin(math.sqrt(h))


def assemble_rings(ways: list) -> list:
    """Yolları uç uca ekleyip kapalı halkalar kurar; kapanmayanlar atılır."""
    ways = [w for w in ways if len(w) > 1]
    rings = []
    while ways:
        cur = list(ways.pop())
        while cur[0] != cur[-1]:
            for i, w in enumerate(ways):
                if w[0] == cur[-1]:
                    cur = cur + w[1:]
                elif w[-1] == cur[-1]:
                    cur = cur + w[::-1][1:]
                elif w[-1] == cur[0]:
                    cur = w[:-1] + cur
                elif w[0] == cur[0]:
                    cur = w[::-1][:-1] + cur
                else:
                    continue
                ways.pop(i)
                break
            else:
                break
        if cur[0] == cur[-1] and len(cur) >= 4:
            rings.append(cur)
    return rings


def in_ring(x: float, y: float, ring: list) -> bool:
    """Işın atma (ray casting)."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class District:
    def __init__(self, rel: dict):
        outer, inner = [], []
        for m in rel.get("members", []):
            if m.get("type") != "way" or not m.get("geometry"):
                continue
            (inner if m.get("role") == "inner" else outer).append([(p["lon"], p["lat"]) for p in m["geometry"]])
        self.outer = [(r, self._bbox(r)) for r in assemble_rings(outer)]
        self.inner = [(r, self._bbox(r)) for r in assemble_rings(inner)]

    @staticmethod
    def _bbox(ring):
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        return min(xs), min(ys), max(xs), max(ys)

    @staticmethod
    def _in(rings, x, y):
        return any(b[0] <= x <= b[2] and b[1] <= y <= b[3] and in_ring(x, y, r) for r, b in rings)

    def contains(self, lng: float, lat: float) -> bool:
        return self._in(self.outer, lng, lat) and not self._in(self.inner, lng, lat)


def load_districts(city: str, refresh: bool) -> dict[str, list[District]]:
    data = cached(f"lc_districts_{city.lower()}.json", lambda: district_query(city), refresh)
    out = defaultdict(list)
    for el in data["elements"]:
        if el.get("type") != "relation":
            continue
        d = District(el)
        if not d.outer:
            continue
        tags = el.get("tags", {})
        for n in {tags.get("name"), tags.get("name:tr")} - {None}:
            out[fold_key(n)].append(d)
    return out


# ---------------------------------------------------------------- ad ve tür


def core(s: str) -> frozenset:
    return frozenset(w for w in norm(s).split() if w not in ALL_TYPE_WORDS and len(w) > 1)


def name_variants(name: str) -> list[str]:
    """"Affan (Ertuğrul) Camii" → "Affan Camii", "Ertuğrul Camii"."""
    out = [name]
    m = re.search(r"\(([^)]*)\)", name)
    if m:
        pre, alt, post = name[: m.start()].strip(), m.group(1).strip(), name[m.end() :].strip()
        without = " ".join(f"{pre} {post}".split())
        out += [without, " ".join(f"{alt} {post}".split())]
    return [v for v in dict.fromkeys(out) if v]


def work_cores(entry: dict) -> list[frozenset]:
    names = name_variants(entry["name_tr"]) + name_variants(entry.get("name_en") or "")
    return list({c for c in map(core, names) if c})


def similarity(a: frozenset, b: frozenset) -> float:
    ov = len(a & b) / max(len(a), len(b))
    if ov < 0.5:  # 0.6·ov + 0.4·seq ≥ 0.6 için ov ≥ 0.5 şart
        return 0.6 * ov
    seq = SequenceMatcher(None, " ".join(sorted(a)), " ".join(sorted(b))).ratio()
    return 0.6 * ov + 0.4 * seq


def best_sim(work: list[frozenset], cand: list[frozenset]) -> float:
    return max((similarity(a, b) for a in work for b in cand), default=0.0)


def osm_kind(tags: dict) -> str | None:
    kind = type_of(tags["name"])
    if kind != "diger":
        return kind
    amenity, hist, religion = tags.get("amenity"), tags.get("historic"), tags.get("religion")
    if amenity == "place_of_worship":
        return {"muslim": "cami", "christian": "kilise", "jewish": "sinagog"}.get(religion)
    if amenity == "public_bath":
        return "hamam"
    if amenity == "fountain" or hist == "fountain":
        return "cesme"
    if hist == "tomb":
        return "turbe"
    if hist == "caravanserai":
        return "kervansaray"
    return None


def wikidata_kind(item: dict) -> str | None:
    for c in item["classes"]:
        k = CLASS_KIND.get(c)
        if k and k != "diger":
            return k
    k = type_of(item["names"][0])
    return None if k == "diger" else k


def types_compatible(a: str, b: str) -> bool:
    return a == b or any(a in g and b in g for g in COMPAT)


# ---------------------------------------------------------------- havuz


def osm_pool(city: str, refresh: bool) -> list[dict]:
    data = cached(f"lc_osm_{city.lower()}.json", lambda: osm_query(city), refresh)
    pool = []
    for el in data["elements"]:
        tags = el.get("tags", {})
        c = el if "lat" in el else el.get("center")
        if not c or "name" not in tags:
            continue
        names = [tags[k] for k in ("name", "name:tr", "alt_name", "old_name", "official_name", "name:en") if tags.get(k)]
        names = [v for n in dict.fromkeys(names) for v in name_variants(n)]
        pool.append(
            {
                "source": "osm",
                "ref": f"{el['type']}/{el['id']}",
                "label": tags["name"],
                "lng": c["lon"],
                "lat": c["lat"],
                "cores": [x for x in {core(n) for n in names} if x],
                "kind": osm_kind(tags),
            }
        )
    return pool


def wikidata_pool(city: str, refresh: bool) -> list[dict]:
    data = cached(f"lc_wikidata_{city.lower()}.json", lambda: wikidata_query(city), refresh)
    pool = []
    for it in data:
        kind = wikidata_kind(it)
        if kind is None and NON_STRUCTURE & set(it["classes"]):
            continue
        names = [v for n in it["names"] for v in name_variants(n)]
        pool.append(
            {
                "source": "wikidata",
                "ref": it["qid"],
                "label": it["names"][0],
                "lng": it["lng"],
                "lat": it["lat"],
                "cores": [x for x in {core(n) for n in names} if x],
                "kind": kind,
                "classes": it["classes"],
            }
        )
    return pool


class Index:
    """Çekirdek sözcük → havuz kayıtları (aday taramasını hızlandırır)."""

    def __init__(self, pool: list[dict]):
        self.pool = pool
        self.by_token = defaultdict(set)
        for i, p in enumerate(pool):
            for c in p["cores"]:
                for t in c:
                    self.by_token[t].add(i)

    def near(self, work: list[frozenset]) -> list[dict]:
        ids = set()
        for c in work:
            for t in c:
                ids |= self.by_token.get(t, set())
        return [self.pool[i] for i in sorted(ids)]


# ---------------------------------------------------------------- aday üretimi


def main():
    refresh = "--refresh" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    rows = json.loads(IN.read_text(encoding="utf-8"))
    overrides = {k: v for k, v in json.loads(OVERRIDES.read_text(encoding="utf-8")).items() if not k.startswith("_")}

    # slug üretimi inventory_import.main ile aynı döngü
    entries, slugs = [], set()
    for r in rows:
        base = slugify(f"{r['city']}-{r['name_tr']}")
        slug, n = base, 2
        while slug in slugs:
            slug = f"{base}-{n}"
            n += 1
        slugs.add(slug)
        entries.append({**r, "slug": slug})

    indexes, districts = {}, {}
    for city in BBOX:
        indexes[city] = (Index(osm_pool(city, refresh)), Index(wikidata_pool(city, refresh)))
        if city in DISTRICT_CITIES:
            districts[city] = load_districts(city, refresh)

    out = []
    stats = defaultdict(lambda: defaultdict(int))
    for e in entries:
        city, slug = e["city"], e["slug"]
        fix = overrides.get(slug)
        work_type = (fix or {}).get("type") or type_of(e["name_tr"])
        work_type = None if work_type == "diger" else work_type
        wcores = work_cores(e)
        polys = None
        if e.get("district") and city in districts:
            polys = districts[city].get(fold_key(e["district"]))

        def judge(c: dict) -> dict:
            """Veto kararı ve puan bileşenleri."""
            reasons, veto = {}, False
            if work_type and c.get("kind"):
                ok = types_compatible(work_type, c["kind"])
                reasons["type"] = {"work": work_type, "candidate": c["kind"], "ok": ok}
                veto |= not ok
            if e.get("district") and city in districts:
                if polys:
                    inside = any(p.contains(c["lng"], c["lat"]) for p in polys)
                    reasons["district"] = {"name": e["district"], "inside": inside}
                    veto |= not inside
                else:
                    reasons["district"] = None  # ilçe sınırı bulunamadı: veto yok
            return {"reasons": reasons, "vetoed": veto}

        cands = []
        for pool in indexes[city]:
            scored = []
            for p in pool.near(wcores):
                sim = best_sim(wcores, p["cores"])
                if sim >= MIN_SIM:
                    j = judge(p)
                    rank = (round(sim, 2), not j["vetoed"], sim)
                    scored.append((rank, sim, p, j))
            scored.sort(key=lambda t: t[0], reverse=True)
            for _, sim, p, j in scored[:TOP_N]:
                cands.append({**{k: p[k] for k in ("source", "ref", "label", "kind", "lng", "lat")}, "level": "building", "sim": sim, **j})

        # mevcut sonuç (current)
        geo = e.get("geo")
        removed = bool(fix) and fix.get("lng") is None
        if geo and not removed:
            method = geo["method"]
            if method == "wikidata":
                hit = next((c for c in cands if c["source"] == "wikidata" and c["ref"] == geo.get("qid")), None)
                if hit is None:
                    label = geo.get("match") or geo.get("label") or e["name_tr"]
                    kc = type_of(label)
                    c = {"source": "wikidata", "ref": geo["qid"], "label": label, "kind": None if kc == "diger" else kc,
                         "lng": geo["lng"], "lat": geo["lat"], "level": "building",
                         "sim": best_sim(wcores, [x for x in map(core, name_variants(label)) if x])}
                    c.update(judge(c))
                    cands.append(c)
                    hit = c
                hit["reasons"]["current"] = True
            elif method == "nominatim":
                label = geo.get("label") or e["name_tr"]
                kc = type_of(label.split(",")[0])
                c = {"source": "nominatim", "ref": geo.get("osm") or "nominatim", "label": label,
                     "kind": None if kc == "diger" else kc, "lng": geo["lng"], "lat": geo["lat"], "level": "building",
                     "sim": best_sim(wcores, [x for x in map(core, name_variants(label.split(",")[0])) if x])}
                c.update(judge(c))
                c["reasons"].update({"current": True, "unverified": True})
                cands.append(c)
            elif method == "wikidata-area":
                c = {"source": "current", "ref": "wikidata-area", "label": geo.get("label") or geo.get("match"), "kind": None,
                     "lng": geo["lng"], "lat": geo["lat"], "level": "village", "sim": 0.0}
                c.update(judge(c))
                c["reasons"].update({"current": True, "area": True})
                cands.append(c)

        # override
        if fix and fix.get("lng") is not None:
            cands.append({"source": "override", "ref": fix.get("osm") or "curated", "label": e["name_tr"],
                          "kind": work_type, "lng": fix["lng"], "lat": fix["lat"], "level": "building", "sim": 1.0,
                          "reasons": {"curated": True, "note": "masa başı OSM doğrulaması"}, "vetoed": False})

        # uyuşma: vetosuz, bağımsız kaynaktan 100 m içindeki adaylar
        for c in cands:
            if c["vetoed"]:
                continue
            agree = set()
            for o in cands:
                if o is c or o["vetoed"] or o["source"] == c["source"]:
                    continue
                if {c["source"], o["source"]} <= {"osm", "nominatim"}:
                    continue  # ikisi de OSM verisi: bağımsız doğrulama değil
                if "override" in (c["source"], o["source"]) and c["ref"] == o["ref"]:
                    continue
                if haversine_m((c["lng"], c["lat"]), (o["lng"], o["lat"])) <= AGREE_M:
                    agree.add(o["source"])
            if agree:
                c["reasons"]["agree"] = sorted(agree)

        # puan
        for c in cands:
            r = c["reasons"]
            if c["source"] == "override":
                c["score"] = 1.0
            else:
                t = r.get("type")
                d = r.get("district")
                s = W_NAME * c["sim"]
                s += (W_TYPE if t["ok"] else 0) if t else NEUTRAL_TYPE
                s += (W_DISTRICT if d["inside"] else 0) if d else NEUTRAL_DISTRICT
                s += W_AGREE if r.get("agree") else 0
                if c["level"] != "building":
                    s = min(s, 0.3)  # alan düzeyinde konum yapı konumu değildir
                c["score"] = min(s, VETO_CAP) if c["vetoed"] else s
            c["score"] = round(max(0.0, min(1.0, c["score"])), 3)
            c["reasons"] = {"name": round(c.pop("sim"), 3), **r}

        for c in cands:
            out.append({"slug": slug, "source": c["source"], "ref": c["ref"], "label": c["label"], "kind": c["kind"],
                        "lng": round(c["lng"], 7), "lat": round(c["lat"], 7), "level": c["level"], "score": c["score"],
                        "reasons": c["reasons"], "vetoed": c["vetoed"]})
        st = stats[city]
        st["works"] += 1
        if cands:
            st["with_candidates"] += 1
            st["candidates"] += len(cands)
            st["vetoed"] += sum(c["vetoed"] for c in cands)
            best = max(cands, key=lambda c: c["score"])
            if not best["vetoed"] and best["reasons"].get("agree"):
                st["best_clean_agreed"] += 1

    out.sort(key=lambda r: (r["slug"], r["source"], r["ref"]))
    data = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    all_slugs = json.dumps(sorted(slugs), ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        f"""-- Otomatik üretildi: data/location_candidates.py. Elle düzenlemeyin.
-- Konum adayları: OpenStreetMap (ODbL), Wikidata (CC0), geo_overrides.json ve önceki eşleşme. Karar admin panelindedir.
-- Yalnız status = 'pending' adaylar güncellenir/silinir; kabul/ret kararlarına dokunulmaz.
begin;
create temp table lc on commit drop as
select * from jsonb_to_recordset($json${data}$json$::jsonb) as d(
  slug text, source text, ref text, label text, kind text, lng float8, lat float8, level text, score real,
  reasons jsonb, vetoed boolean);
create temp table lc_slugs on commit drop as
select jsonb_array_elements_text($json${all_slugs}$json$::jsonb) as slug;

-- Arşivdeki ya da veritabanında bulunmayan eserler atlanır.
create temp table lc_w on commit drop as
select lc.*, w.id as work_id from lc join public.works w on w.slug = lc.slug and w.status <> 'archived';

delete from public.location_candidates c
using public.works w
where w.id = c.work_id and w.status <> 'archived' and w.slug in (select slug from lc_slugs)
  and c.status = 'pending'
  and not exists (select 1 from lc_w n where n.work_id = c.work_id and n.source = c.source and n.ref = c.ref);

insert into public.location_candidates (work_id, source, ref, label, kind, lng, lat, level, score, reasons, vetoed)
select work_id, source, ref, label, kind, lng, lat, level, score, reasons, vetoed from lc_w
on conflict (work_id, source, ref) do update set label = excluded.label, kind = excluded.kind, lng = excluded.lng,
  lat = excluded.lat, level = excluded.level, score = excluded.score, reasons = excluded.reasons,
  vetoed = excluded.vetoed, updated_at = now()
where public.location_candidates.status = 'pending';
commit;
""",
        encoding="utf-8",
    )
    print(f"{len(out)} aday → {OUT.relative_to(ROOT)}", file=sys.stderr)
    for city, st in stats.items():
        print(city, dict(st), file=sys.stderr)


if __name__ == "__main__":
    main()
