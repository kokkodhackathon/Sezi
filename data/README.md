# Veri pipeline'ı

Ham kaynakları Sezi'nin veri modeline (`packages/shared/src/schemas.ts`, `supabase/migrations`) dönüştürür.

Ham dosyalar `data/raw/` altında, ara çıktılar `data/out/` altında durur; ikisi de git'e girmez. Script'ler izole modda çalışır: `python -I`.

Telif ve veri politikası için bkz. [ENVANTER.md](../ENVANTER.md) §5. Kısaca: kitaplardan yalnızca olgular alınır, metin ve fotoğraf alınmaz.

## 1. Vakıf eserleri envanteri (Hatay, Konya, Bursa)

**Girdi:** Kitap PDF'leri `data/raw/books/` klasörüne konur. URL'ler ENVANTER.md'de; sunucu HEAD isteğine 404 döner, GET ile iner.

```bash
python -I data/inventory_toc.py       # içindekiler → data/out/inventory_toc.json
python -I data/inventory_geocode.py   # konum → data/out/inventory_geo.json (~50 dk, Nominatim önbellekli)
python -I data/inventory_import.py    # → supabase/seed_inventory.sql
npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_inventory.sql
```

**`inventory_toc.py`**
- İçindekiler sayfalarını bulur: sayfa numarası yoğunluğundan.
- Her satırdan ad (TR/EN), il, ilçe, bölüm, cilt ve sayfa çıkarır.
- Gerekli araç: `pdftotext -enc UTF-8` (poppler). Parametre olmadan Türkçe karakterler bozulur.
- İlçe adları `DISTRICTS` beyaz listesiyle doğrulanır. Şüpheli satırlar `needs_review` ile işaretlenir ve `draft` olarak girer.

**`inventory_geocode.py`**
1. Wikidata'da ilin (P131) koordinatlı öğeleriyle ad ve tür eşleştirmesi yapar; eşik 0.72.
2. Bulamazsa Nominatim'e sorar: saniyede 1 istek, önbellek `data/raw/geo_cache.json`.
- Yapı değil de yer eşleşmesi (`wikidata-area`) düşük güvenle işaretlenir.

**`inventory_import.py`** — kesinliği, türü ve durumu belirler; çıktı yeniden çalıştırılabilir (slug ve kaynak URL'ye göre günceller).
- **Konum kesinliği:**
  - `geo_overrides.json` ya da güveni ≥0.9 olan bir Wikidata yapı eşleşmesi → `exact`
  - diğer eşleşmeler → `approximate`
  - eşleşme yok → `unknown`
- **Tür:** Addan çıkarılır (`TYPE_RULES`). Türkçe tamlamada baş isim sondadır: "Koza Han Mescidi" bir mescittir. "X Camii ve Türbesi" adında ilk parça esas alınır.
- **Durum:** `needs_review` işaretli kayıt `draft`, diğerleri `verified` olarak girer.
- **Kaynak:** Her eser, envanter kitabına cilt, sayfa ve bölüm bilgisiyle bağlanır.

### Elle konum düzeltme

`data/geo_overrides.json`: anahtar eser slug'ı, değer OSM kimliğiyle koordinat.
- `"lng": null` yanlış otomatik eşleşmeyi kaldırır.
- `"type"` türü elle düzeltir.
- Düzeltmeden sonra `inventory_import.py` ve seed adımlarını yeniden çalıştırın.

## 2. Pilot alan navigasyon grafiği (OSM)

**1. OSM yaya ağını indirin.** Merkez ve yarıçap `build_nav_graph.py › AREAS` sözlüğünde. Bursa Hanlar: 40.18415, 29.06135, 450 m.

```bash
Q='[out:json][timeout:60];(way(around:450,40.18415,29.06135)["highway"~"^(footway|pedestrian|steps|path|living_street|residential|service|unclassified|tertiary|secondary|corridor)$"]["access"!~"^(private|no)$"];);out body;>;out skel qt;'
curl -s -A "sezi-hackathon/1.0" --data-urlencode "data=$Q" https://overpass.kumi.systems/api/interpreter -o data/raw/osm_bursa_hanlar.json
```

**2. Grafiği üretin.** Landmark'lar `works_view` içinden gelir: ilin `exact` konumlu eserleri, alanın yarıçapı içinde.

```bash
python -I data/build_nav_graph.py bursa-hanlar   # → apps/mobile/assets/pilot/bursa-hanlar-nav.json
```

**3. Doğrulayın:** `pnpm test` (`pilot-graph.test.ts`) her landmark çifti arasında rota olduğunu ve tekerlekli sandalye rotasının basamaksız olduğunu kontrol eder.

**Değerlerin kaynağı**
- Basamak, zemin ve genişlik OSM etiketlerinden gelir.
- Gürültü yol sınıfından tahmin edilir.
- Landmark görünürlüğü: landmark'a 40 m'den yakın segmentler.

Bunlar tahmindir; saha ölçümü gelince güncellenir (ROADMAP #6). Yol verisinin lisansı © OpenStreetMap katkıcıları (ODbL).

**Yeni pilot alan eklemek:** `AREAS` sözlüğüne bir girdi ekleyin, Overpass çıktısını `data/raw/osm_<alan>.json` olarak indirin ve script'i alan adıyla çalıştırın.

## 3. Eski: İstanbul Wikidata pilotu

`wikidata_pilot.py` ve `supabase/seed_wikidata_pilot.sql` ilk prototipin Süleymaniye verisidir. Kayıtlar veritabanında `archived` durumunda; yeni işte kullanmayın.
