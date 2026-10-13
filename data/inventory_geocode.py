"""Envanter eser listesini (inventory_toc.json) konumla eşleştirir.

1. Wikidata: ildeki koordinatlı tüm yapılar (P131* ile il sınırı içinde) çekilir, adlar normalize edilip eşleştirilir.
2. Eşleşmeyenler için Nominatim (OSM) "ad, ilçe, il" araması yapılır (1 istek/sn, kullanım politikasına uygun).
Eşleşme yöntemi ve güveni her kayıtta saklanır; düşük güvenli konumlar admin panelinde doğrulanır.

Girdi:  data/out/inventory_toc.json
Çıktı:  data/out/inventory_geo.json
Kullanım:  python -I data/inventory_geocode.py [--no-osm]
"""

import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / "data/out/inventory_toc.json"
OUT = ROOT / "data/out/inventory_geo.json"
CACHE = ROOT / "data/raw/geo_cache.json"
UA = "SeziHackathon/0.1 (edizkeskin@gmail.com)"
PROVINCES = {"Bursa": "Q43690", "Konya": "Q81551", "Hatay": "Q83274"}
CITY_CENTER = {"Bursa": (29.06, 40.19), "Konya": (32.49, 37.87), "Hatay": (36.16, 36.20)}

# Tür sözcükleri eşleştirmede ayırt edici değil; ayrı karşılaştırılır.
TYPE_WORDS = {
    "camii", "cami", "camisi", "mescidi", "mescit", "mescid", "medresesi", "medrese", "turbesi", "turbe", "hamami", "hamam",
    "cesmesi", "cesme", "sebili", "hani", "han", "kervansarayi", "koprusu", "kulliyesi", "imareti", "tekkesi", "zaviyesi",
    "dergahi", "kumbeti", "kumbet", "haziresi", "mezarligi", "kilisesi", "konagi", "evi", "mektebi", "kutuphanesi", "ve",
    "mosque", "masjid", "madrasa", "tomb", "bath", "fountain", "inn", "complex", "church", "the", "of", "and",
}


def norm(s: str) -> str:
    s = s.replace("İ", "i").replace("I", "ı").lower().replace("ı", "i")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]", " ", s)


def core_tokens(s: str) -> set[str]:
    return {w for w in norm(s).split() if w not in TYPE_WORDS and len(w) > 1}


def type_tokens(s: str) -> set[str]:
    return {w for w in norm(s).split() if w in TYPE_WORDS and w not in {"ve", "the", "of", "and"}}


def get_json(url: str, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def wikidata_items(qid: str):
    q = f"""
SELECT ?item ?trLabel ?enLabel ?coord WHERE {{
  ?item wdt:P131+ wd:{qid} ; wdt:P625 ?coord .
  OPTIONAL {{ ?item rdfs:label ?trLabel FILTER(lang(?trLabel)="tr") }}
  OPTIONAL {{ ?item rdfs:label ?enLabel FILTER(lang(?enLabel)="en") }}
}}"""
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q})
    rows = get_json(url, {"Accept": "application/sparql-results+json"})["results"]["bindings"]
    out = {}
    for b in rows:
        qid_ = b["item"]["value"].rsplit("/", 1)[-1]
        m = re.match(r"^Point\(([-\d.]+) ([-\d.]+)\)$", b["coord"]["value"])
        if not m:
            continue  # başka gök cismi / bozuk koordinat
        lng, lat = m.groups()
        names = [x["value"] for x in (b.get("trLabel"), b.get("enLabel")) if x]
        if names:
            out[qid_] = {"qid": qid_, "names": names, "lng": float(lng), "lat": float(lat)}
    return list(out.values())


def score(entry, cand) -> float:
    a_core = core_tokens(entry["name_tr"]) | core_tokens(entry.get("name_en") or "")
    best = 0.0
    for n in cand["names"]:
        b_core = core_tokens(n)
        if not a_core or not b_core:
            continue
        overlap = len(a_core & b_core) / max(len(a_core), len(b_core))
        seq = SequenceMatcher(None, " ".join(sorted(a_core)), " ".join(sorted(b_core))).ratio()
        s = 0.6 * overlap + 0.4 * seq
        # Tür uyumu: "Orhan Camii" ile "Orhan Hamamı" aynı yer değildir.
        ta, tb = type_tokens(entry["name_tr"]), type_tokens(n)
        if ta and tb and not (ta & tb):
            s -= 0.35
        best = max(best, s)
    return best


def nominatim(entry, cache):
    query = f"{entry['name_tr']}, {entry['district'] + ', ' if entry['district'] else ''}{entry['city']}, Türkiye"
    if query in cache:
        return cache[query]
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "tr"})
    try:
        res = get_json(url)
    except Exception as e:  # ağ hatası: sonraki çalıştırmada tekrar denenir
        print(f"  nominatim hata: {e}", file=sys.stderr)
        return None
    time.sleep(1.1)
    hit = None
    if res:
        r = res[0]
        hit = {"lng": float(r["lon"]), "lat": float(r["lat"]), "osm": f"{r['osm_type']}/{r['osm_id']}", "label": r.get("name") or r["display_name"][:80]}
    cache[query] = hit
    if len(cache) % 20 == 0:  # yarıda kesilirse kaldığı yerden devam eder
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        print(f"  … {len(cache)} sorgu", file=sys.stderr, flush=True)
    return hit


def hit_is_building(hit) -> bool:
    return bool(type_tokens(hit.get("label") or ""))


def main():
    use_osm = "--no-osm" not in sys.argv
    rows = json.loads(IN.read_text(encoding="utf-8"))
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    stats = {}
    for city, qid in PROVINCES.items():
        cands = wikidata_items(qid)
        print(f"{city}: Wikidata'da {len(cands)} koordinatlı öğe", file=sys.stderr)
        for e in (r for r in rows if r["city"] == city):
            best, best_s = None, 0.0
            for c in cands:
                s = score(e, c)
                if s > best_s:
                    best, best_s = c, s
            e["geo"] = None
            if best and best_s >= 0.72:
                # Eser adı tür içeriyor ama eşleşen öğe içermiyorsa (köy/mahalle), konum yalnızca yaklaşıktır.
                area = bool(type_tokens(e["name_tr"])) and not any(type_tokens(n) for n in best["names"])
                e["geo"] = {
                    "lng": best["lng"], "lat": best["lat"],
                    "method": "wikidata-area" if area else "wikidata",
                    "qid": best["qid"], "match": best["names"][0],
                    "confidence": round(best_s * (0.5 if area else 1), 2),
                }
            if use_osm and (not e["geo"] or e["geo"]["method"] == "wikidata-area"):
                hit = nominatim(e, cache)
                if hit and (not e["geo"] or hit_is_building(hit)):
                    e["geo"] = {**hit, "method": "nominatim", "confidence": 0.6 if hit_is_building(hit) else 0.4}
            k = e["geo"]["method"] if e["geo"] else "yok"
            stats.setdefault(city, {}).setdefault(k, 0)
            stats[city][k] += 1
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    main()
