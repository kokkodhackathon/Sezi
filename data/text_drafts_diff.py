"""Yeniden üretilen metin taslaklarını uzaktaki mevcut taslaklarla karşılaştırır; seed uygulanmadan önce bakılır.

Rapor: data/out/text_drafts_diff.md (gitignore'da) ve özet stdout'a.
  - Değişecek bekleyen taslaklar (alan alan uzunluk farkı, eklenen/kalkan uyarılar, sayfa aralığı)
  - Korunacaklar: yayınlanmış ya da elle düzenlenmiş (edited_at) taslaklar; yeni çıktı bunlara uygulanmaz
  - Silinecek bekleyen taslaklar (artık üretilmeyen) ve yeni eklenecekler
  - Kitaptaki başlığı uygulamadaki addan farklı eserler (ad düzeltme önerisi)

Kullanım:  python -I data/inventory_texts.py && python -I data/text_drafts_diff.py
Gerekli: Supabase CLI oturumu (npx supabase … db query --linked).
"""

import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
REF = "jejsvycpzulpleftkssj"
OUT = ROOT / "data/out/text_drafts_diff.md"

QUERY = """
select w.slug, s.url as book_url, d.page, d.page_end, d.status, d.edited_at is not null as edited,
  d.address, d.history, d.warnings, w.name as work_name
from public.text_drafts d
join public.works w on w.id = d.work_id
join public.sources s on s.id = d.source_id
"""


def fetch_current() -> list[dict]:
    res = subprocess.run(
        f'npx supabase@latest db query --linked --project-ref {REF} "{" ".join(QUERY.split())}" -o json',
        shell=True, capture_output=True, text=True, encoding="utf-8", cwd=ROOT,
    )
    text = res.stdout
    start = text.find("{")
    if start < 0:
        raise SystemExit(f"sorgu başarısız: {res.stderr[-500:]}")
    data, _ = json.JSONDecoder().raw_decode(text[start:])
    return data["rows"]


def generated() -> list[dict]:
    rows = []
    for f in sorted((ROOT / "supabase").glob("seed_text_drafts_[0-9]*.sql")):
        m = re.search(r"\$json\$(.*?)\$json\$", f.read_text(encoding="utf-8"), re.S)
        rows += json.loads(m.group(1))
    return rows


def text_len(v, lang="tr") -> int:
    return len((v or {}).get(lang) or "")


def main():
    cur = {(r["slug"], r["book_url"], r["page"]): r for r in fetch_current()}
    gen = {(r["slug"], r["book_url"], r["page"]): r for r in generated()}

    changed, kept, removed, added, names = [], [], [], [], []
    for key, g in gen.items():
        c = cur.get(key)
        if c is None:
            added.append(g)
            continue
        title = (g.get("book_title") or {}).get("tr")
        current_name = (c["work_name"] or {}).get("tr")
        if title and current_name and re.sub(r"\W", "", title.lower()) != re.sub(r"\W", "", current_name.lower()):
            names.append((g["slug"], current_name, title, (g.get("book_title") or {}).get("en"), (c["work_name"] or {}).get("en")))
        if c["status"] != "pending" or c["edited"]:
            if (g["history"] or {}) != (c["history"] or {}) or (g["address"] or {}) != (c["address"] or {}):
                kept.append((g, c))
            continue
        diff = []
        for field in ("address", "history"):
            for lang in ("tr", "en"):
                a, b = text_len(c[field], lang), text_len(g[field], lang)
                if (c[field] or {}).get(lang) != (g[field] or {}).get(lang):
                    diff.append(f"{field}.{lang} {a}→{b}")
        if (c["page_end"] or c["page"]) != (g["page_end"] or g["page"]):
            diff.append(f"sayfa {c['page']}–{c['page_end'] or c['page']} → {g['page']}–{g['page_end'] or g['page']}")
        w_old, w_new = set(c["warnings"] or []), set(g["warnings"])
        if w_old != w_new:
            diff.append("uyarı " + " ".join([f"+{w}" for w in sorted(w_new - w_old)] + [f"-{w}" for w in sorted(w_old - w_new)]))
        if diff:
            changed.append((g, diff))
    gen_urls = {k[1] for k in gen}
    for key, c in cur.items():
        if key not in gen and key[1] in gen_urls and c["status"] == "pending" and not c["edited"]:
            removed.append(c)

    lines = ["# Metin taslakları: yeniden üretim farkı", ""]
    lines.append(f"- Değişecek bekleyen taslak: **{len(changed)}**")
    lines.append(f"- Korunacak (yayınlanmış ya da elle düzenlenmiş; yeni çıktı uygulanmaz): **{len(kept)}**")
    lines.append(f"- Silinecek bekleyen taslak (artık üretilmiyor): **{len(removed)}**")
    lines.append(f"- Yeni eklenecek taslak: **{len(added)}**")
    lines.append(f"- Kitaptaki başlığı uygulamadaki addan farklı eser: **{len(names)}**")
    lines += ["", "## Ad farkları (kitaptaki başlık)", "", "| Eser | Uygulamadaki ad | Kitaptaki başlık | EN (kitap) | EN (uygulama) |", "|---|---|---|---|---|"]
    lines += [f"| {s} | {a} | {b} | {e or ''} | {f or ''} |" for s, a, b, e, f in names]
    lines += ["", "## Korunacak taslaklar", ""]
    lines += [f"- {g['slug']} ({c['status']}{', elle düzenlenmiş' if c['edited'] else ''}): tarihçe TR {text_len(c['history'])} → yeni çıktı {text_len(g['history'])} karakter" for g, c in kept]
    lines += ["", "## Silinecek bekleyen taslaklar", ""]
    lines += [f"- {c['slug']} s. {c['page']}" for c in removed]
    lines += ["", "## Yeni taslaklar", ""]
    lines += [f"- {g['slug']} s. {g['page']}" for g in added]
    lines += ["", "## Değişecek bekleyen taslaklar", ""]
    lines += [f"- **{g['slug']}** s. {g['page']}: " + "; ".join(d) for g, d in changed]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:8]))
    print(f"rapor: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
