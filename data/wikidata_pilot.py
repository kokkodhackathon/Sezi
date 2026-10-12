"""Pilot (Süleymaniye) eserlerini Wikidata'dan çekip seed SQL üretir.

Gerçek veri seti gelene kadar geçici kaynak. Yalnızca ad (tr/en), tür ve konum alınır;
tarihî metin üretilmez. Her eser, Wikidata öğesi kaynak olarak bağlanır.
Külliye üyeleri (elle gözden geçirilmiş kural) `verified`, çevredeki diğer eserler `draft` girer:
Wikidata tür bilgisi hatalı olabilir (ör. bir medrese "türbe" etiketli), admin onayı gerekir.

Kullanım:  python -I data/wikidata_pilot.py > supabase/seed_wikidata_pilot.sql
"""

import json
import sys
import unicodedata
import urllib.parse
import urllib.request

CENTER_QID = "Q178643"  # Süleymaniye Camii
RADIUS_KM = "0.4"
COMPLEX_SLUG = "suleymaniye"
USER_AGENT = "SeziHackathon/0.1 (edizkeskin@gmail.com)"

# Wikidata tür etiketi (en) → work_types.slug. Listede olmayan türler (dükkan, otel, sarnıç...) alınmaz.
TYPE_MAP = {
    "mosque": "cami",
    "madrasa": "medrese",
    "türbe": "turbe",
    "mausoleum": "turbe",
    "fountain": "cesme",
    "sebil": "sebil",
    "imaret": "imaret",
    "hammam": "hamam",
    "library": "kutuphane",
}
# Wikidata'da sebil sınıfı etiketsiz döndüğü için QID ile eşlenir.
TYPE_QID_MAP = {"Q2914485": "sebil"}

# Adında "Süleymaniye" geçmeyen ama külliyenin parçası olan yapılar.
EXTRA_COMPLEX_MEMBERS = {"Q55698717", "Q55698753", "Q749094"}  # Kanuni ve Hürrem türbeleri, Süleymaniye Hamamı

QUERY = f"""
SELECT ?item ?trLabel ?enLabel ?type ?typeLabel ?coord ?dist WHERE {{
  wd:{CENTER_QID} wdt:P625 ?center .
  SERVICE wikibase:around {{ ?item wdt:P625 ?coord . bd:serviceParam wikibase:center ?center ;
    wikibase:radius "{RADIUS_KM}" ; wikibase:distance ?dist . }}
  ?item wdt:P31 ?type .
  OPTIONAL {{ ?item rdfs:label ?trLabel FILTER(lang(?trLabel)="tr") }}
  OPTIONAL {{ ?item rdfs:label ?enLabel FILTER(lang(?enLabel)="en") }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". ?type rdfs:label ?typeLabel . }}
}} ORDER BY ?dist
"""


def fetch():
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": QUERY})
    req = urllib.request.Request(url, headers={"Accept": "application/sparql-results+json", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["results"]["bindings"]


def slugify(text):
    text = text.replace("ı", "i").replace("İ", "i")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    out = "".join(c if c.isalnum() else "-" for c in text)
    return "-".join(p for p in out.split("-") if p)


def parse_point(wkt):
    lng, lat = wkt.removeprefix("Point(").removesuffix(")").split()
    return float(lng), float(lat)


def collect(rows):
    works = {}
    for b in rows:
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        if qid in works:
            continue
        type_qid = b["type"]["value"].rsplit("/", 1)[-1]
        type_slug = TYPE_QID_MAP.get(type_qid) or TYPE_MAP.get(b["typeLabel"]["value"])
        tr = b.get("trLabel", {}).get("value")
        if not type_slug or not tr:
            continue
        en = b.get("enLabel", {}).get("value")
        in_complex = tr.startswith("Süleymaniye") or qid in EXTRA_COMPLEX_MEMBERS
        works[qid] = {
            "qid": qid,
            "slug": slugify(tr),
            "name": {"tr": tr, **({"en": en} if en else {})},
            "type": type_slug,
            "location": parse_point(b["coord"]["value"]),
            "complex": in_complex,
        }
    return list(works.values())


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def to_sql(works):
    rows = [
        {
            "slug": w["slug"],
            "name": w["name"],
            "type": w["type"],
            "lng": w["location"][0],
            "lat": w["location"][1],
            "in_complex": w["complex"],
            "url": f"https://www.wikidata.org/wiki/{w['qid']}",
        }
        for w in works
    ]
    data = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    # Yeniden çalıştırılabilir (idempotent): eser slug'a, kaynak URL'ye göre tekilleşir.
    return f"""-- Otomatik üretildi: data/wikidata_pilot.py. Elle düzenlemeyin.
-- Kaynak: Wikidata (CC0). Yalnızca ad, tür ve konum; tarihî metin yok.
begin;
create temp table wd on commit drop as
select * from jsonb_to_recordset($json${data}$json$::jsonb)
  as d(slug text, name jsonb, type text, lng float8, lat float8, in_complex boolean, url text);

insert into sources (title, publisher, url)
select 'Wikidata: ' || (wd.name ->> 'tr'), 'Wikidata', wd.url from wd
where not exists (select 1 from sources s where s.url = wd.url);

insert into works (slug, name, work_type_id, city_id, complex_id, location, status)
select wd.slug, wd.name,
  (select id from work_types t where t.slug = wd.type),
  (select id from cities c where c.name ->> 'tr' = 'İstanbul'),
  case when wd.in_complex then (select id from complexes x where x.slug = {sql_str(COMPLEX_SLUG)}) end,
  extensions.st_setsrid(extensions.st_makepoint(wd.lng, wd.lat), 4326)::extensions.geography,
  (case when wd.in_complex then 'verified' else 'draft' end)::content_status
from wd
on conflict (slug) do update set name = excluded.name, work_type_id = excluded.work_type_id,
  complex_id = excluded.complex_id, location = excluded.location;

insert into work_sources (work_id, source_id)
select w.id, s.id from wd join works w on w.slug = wd.slug join sources s on s.url = wd.url
on conflict do nothing;

update complexes set status = 'verified' where slug = {sql_str(COMPLEX_SLUG)};
commit;
"""


if __name__ == "__main__":
    works = collect(fetch())
    print(f"{len(works)} eser ({sum(w['complex'] for w in works)} külliye üyesi)", file=sys.stderr)
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(to_sql(works))
