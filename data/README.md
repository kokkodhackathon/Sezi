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

## 2. Envanter fotoğraf arşivi

Organizasyon 14 Ekim'de Bursa örnekleminin yüksek çözünürlüklü arşivini paylaştı (yerelde `docs/drive/`, git'e girmez). Dosya adları eseri söylemez ("ERD03201 kopya.jpg"); aynı fotoğraflar yayımlanmış kitapta da var.

```bash
# izole ortam: pip install pillow pymupdf
python -I data/inventory_photos.py docs/drive bursa data/raw/books/bursa-envanteri-cilt-{1,2,3}.pdf
python -I data/inventory_media_import.py bursa --upload
npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_media_bursa.sql
```

**`inventory_photos.py`**
1. Her fotoğrafı 1600 px ve 480 px WebP'ye küçültür (`data/out/photos/<il>/`).
2. Kitap PDF'lerindeki her görselin algısal özetini (dHash) çıkarır; sayfa numarası çift sayfa yayılımının üst köşesinden okunur. Özetler `book_hashes.json` dosyasında önbelleğe alınır.
3. Fotoğrafı, kitaptaki karenin en-boy oranına kırparak en yakın görsele eşler; eşleşen sayfa, veritabanındaki cilt/sayfa bilgisiyle esere bağlanır.
4. Klasör adındaki ilçeyle çelişen eşleşme reddedilir ("4-İnegöl Klasörü" → İnegöl).

**`inventory_media_import.py`**: eşleşme uzaklığı ≤ 30 olan fotoğraf `verified`, 31–48 arası `draft` girer (admin gözle onaylar). Dosyaları Storage `media/<il>/` altına yükler.

**Sonuç (Bursa):** 97 fotoğraftan 51'i 47 esere bağlandı (46 doğrulanmış, 5 taslak). Eşleşmeyenler kitapta farklı kırpılmış ya da basılmamış kareler; admin panelinden elle bağlanacak.

**Yeni il:** kitap PDF'leri + arşiv klasörü + il slug'ı; kod değişmez.

## 3. Pilot alan navigasyon grafiği (OSM)

**1. OSM yaya ağını indirin.** Merkez ve yarıçap `build_nav_graph.py › AREAS` sözlüğünde. Bursa Hanlar: 40.18415, 29.06135, 650 m (Heykel ve Tophane dahil; ana caddeler de ağda).

```bash
Q='[out:json][timeout:60];(way(around:650,40.18415,29.06135)["highway"~"^(footway|pedestrian|steps|path|living_street|residential|service|unclassified|tertiary|secondary|primary|corridor)$"]["access"!~"^(private|no)$"];);out body;>;out skel qt;'
curl -s -A "sezi-hackathon/1.0" --data-urlencode "data=$Q" https://overpass.kumi.systems/api/interpreter -o data/raw/osm_bursa_hanlar_650.json
```

**2. Grafiği üretin.** Landmark'lar `works_view` içinden gelir: ilin `exact` konumlu eserleri, alanın yarıçapı içinde.

```bash
python -I data/build_nav_graph.py bursa-hanlar   # → apps/mobile/assets/pilot/bursa-hanlar-nav.json
```

**Lynch noktaları (`data/lynch/<alan>.json`):** grafik yalnızca kavşaklardan oluşmaz. Ekip, insanların **buluştuğu ya da indiği** yerleri (Heykel, tramvay durakları, Koza Parkı, Tophane…) ve eser dışı **yer işaretlerini** (saat kulesi, çarşı, müze binası) bu dosyada seçer. Her noktanın OSM kimliği, rolü (`gathering` / `landmark`), görsel–yapısal–anlamsal belirginlik puanı (1–3), varsa ortam sesi ve gerekçesi vardır. `verified: false` olanlar saha gözlemiyle doğrulanır. Grafik üretici noktaları en yakın yaya düğümüne bağlar; buluşma noktaları uygulamada başlangıç seçenekleri olur.

**Altın rotalar (`data/lynch/routes/<id>.json`):** ekibin kafasındaki tarif, düğüm düğüm (`nodeIds`: OSM düğüm kimlikleri) ve manevra manevra yazılır: dönüş, girilen yol (`path`), bölge (`district`), anılan yer işareti, tehlike, ipucu türüne göre TR/EN metin (`generic` zorunlu; `sound` / `visual` / `tactile` yalnız sahada gözlenmişse). `status: verified` olan rota uygulamada motorun yerine geçer; `fieldChecked: false` manevralar saha gezisinde doğrulanır. Grafik değişmeden yalnız rotaları gömmek için: `python -I data/build_nav_graph.py --routes-only` (güzergâh grafikte kopuksa hata verir).

**3. Doğrulayın:** `pnpm test` (`pilot-graph.test.ts`) her landmark çifti arasında rota olduğunu ve tekerlekli sandalye rotasının basamaksız olduğunu kontrol eder.

**Değerlerin kaynağı**
- Basamak, zemin ve genişlik OSM etiketlerinden gelir.
- Gürültü yol sınıfından tahmin edilir.
- Landmark görünürlüğü: landmark'a 40 m'den yakın segmentler.

Bunlar tahmindir; saha ölçümü gelince güncellenir (ROADMAP #6). Yol verisinin lisansı © OpenStreetMap katkıcıları (ODbL).

**Yeni pilot alan eklemek:** `AREAS` sözlüğüne bir girdi ekleyin, Overpass çıktısını `data/raw/osm_<alan>.json` olarak indirin ve script'i alan adıyla çalıştırın.

## 4. Eski: İstanbul Wikidata pilotu

`wikidata_pilot.py` ve `supabase/seed_wikidata_pilot.sql` ilk prototipin Süleymaniye verisidir. Kayıtlar veritabanında `archived` durumunda; yeni işte kullanmayın.
