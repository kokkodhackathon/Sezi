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

### Konum adayları (eşleştirme masası)

```bash
python -I data/location_candidates.py            # → supabase/seed_location_candidates.sql (ham yanıtlar data/raw/lc_*.json'dan; ilk çalıştırma ~10 dk)
python -I data/location_candidates.py --refresh  # önbelleği yok sayıp Overpass/Wikidata'dan yeniden çeker
npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_location_candidates.sql
```

Her eser için birden çok kaynaktan konum **adayı** üretilir; karar admin panelindedir. Önbellek varken ağa gidilmez, çıktı her çalıştırmada aynıdır.
- **Kaynaklar:** OSM yapı kayıtları (Overpass, il bbox'ı; ibadethane, `historic`, hamam, çeşme), Wikidata (il içi koordinatlı öğeler, P31 sınıfı, TR/EN etiket), `geo_overrides.json` (`override`, puan 1.0) ve `inventory_geo.json`'daki mevcut sonuç (`current`/`nominatim`; Wikidata ise ilgili adaya `reasons.current` işareti).
- **Aday seçimi:** ad benzerliği ≥ 0.6 olan, kaynak başına en iyi 3 aday. Benzerlik tür sözcükleri atılarak çekirdek sözcüklerle ölçülür (0.6 örtüşme + 0.4 SequenceMatcher); parantezli alternatif adlar ve İngilizce ad da denenir.
- **Veto** (`vetoed = true`, puan ≤ 0.3): tür çelişkisi (eser türü ile adayın türü uyumsuz; uyumlu gruplar cami↔külliye, türbe↔hazire, çeşme↔sebil, han↔kervansaray) ya da adayın eserin ilçesinin dışında kalması (OSM `admin_level=6` sınırları, nokta-çokgen testi; Hatay'da ve sınırı bulunamayan ilçede veto yok). Aday türü önce adın baş isminden, yoksa OSM etiketlerinden / Wikidata P31 sınıfından çıkar.
- **Uyuşma:** vetosuz başka bir kaynaktan aday 100 m içindeyse `reasons.agree` (OSM ve Nominatim aynı veri sayıldığından birbirini onaylamaz).
- **Puan:** 0.55 ad benzerliği + 0.15 tür + 0.10 ilçe + 0.20 uyuşma (tür/ilçe bilinmiyorsa yarım puan); alan düzeyindeki (`current` `wikidata-area`) en çok 0.3.
- **Kararların korunması:** yalnız `status = 'pending'` adaylar güncellenir; yeni sette olmayan pending adaylar silinir, kabul/ret kararlarına dokunulmaz. `inventory_import.py` de adayı kabul edilmiş eserin `location`, `location_precision` ve `external_ids` alanlarını ezmez.

### Metin taslakları (eşleştirme masası)

```bash
python -I data/inventory_texts.py   # → supabase/seed_text_drafts_01…08.sql + seed_text_drafts_cleanup.sql (PDF ayrıştırması data/raw/texts_cache/'e önbelleğe alınır; ilk çalıştırma ~4 dk)
for f in supabase/seed_text_drafts_0*.sql supabase/seed_text_drafts_cleanup.sql; do npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f $f; done
```

Envanter kitaplarının (`data/raw/books/`) eser metinleri `text_drafts` tablosuna **taslak** (`status = 'pending'`) olarak yazılır. Metinler hackathon kapsamında organizasyonca paylaşılmış veri setidir; yine de hiçbir şey otomatik yayınlanmaz, yayına alma admin panelindeki **Eser metinleri** sayfasındadır. Her taslak `source_id` (kitap + cilt) ve `page` (basılı sayfa) ile atfedilir; yayınlanan metinde kitap kaynak olarak gösterilmelidir. Seed dosyaları kitabın tam metnini içerdiği için git'e girmez (`supabase/.gitignore`); her makinede PDF'lerden yeniden üretilir.
- **Sayfa eşlemesi:** PDF çift sayfa yayılımıdır; basılı sol sayfa = 2 × PDF dizini + sabit (Bursa/Hatay 0, Konya −2; sabit, köşe numaralarının çoğunluğundan bulunur). Konya'da eserin başlığı TOC sayfasının solundaki sayfadaysa metin orada başlar. Eser aralığı kendi sayfasından sonraki eserin sayfasının öncesine kadardır, en çok 8 sayfa (`range_capped`).
- **`pdf_page`:** metnin başladığı PDF sayfası (1 tabanlı, tarayıcıda `#page=`); `(basılı sayfa − sabit) // 2 + 1`.
- **Ayıklama:** yalnız gövde yazı boyutundaki bloklar alınır (başlık, altyazı, sayfa numarası, dikey ilçe harfleri atılır); satır sonu tirelemesi birleştirilir. Bursa'nın bozuk glifleri düzeltilir (`!` → ş, `%` → Ş/İ ya da ff).
- **TR/EN:** bloklar Türkçe harf ve sık sözcük puanıyla sınıflanır; sütun düzeni gözetilerek okuma sırası korunur. `history = {tr, en}`; mimari ayrımı güvenilir yapılamadığından `architecture` boştur.
- **Adres:** TR metnin ilk cümlesi konum bildiriyorsa (…Mahallesi, …Sokak’ta bulunmaktadır) `address` olur ve gövdeden çıkarılır; EN karşılığı eşlenir. Yüklemi konum bildirmeyen ama adres öğeleri taşıyan cümle `address_loose` uyarısıyla alınır; bulunamazsa `no_address` ve alan boş.
- **Uyarılar (`warnings`):** `range_capped`, `shared_page` (aynı sayfada birden çok eser), `no_address`, `address_loose`, `tr_en_unbalanced` (EN uzunluğu TR'nin %50'sinden az / %200'ünden çok), `unclassified_blocks` (dil puanı eşit, atılan blok), `needs_review_entry` (TOC kaydı şüpheli).
- **Kararların korunması:** yalnız `status = 'pending'` taslaklar güncellenir; artık üretilmeyen pending taslaklar silinir (`cleanup` dosyası, en son uygulanır), yayınlanmış/reddedilmiş taslaklara dokunulmaz. Çıktı, uzak sorgu boyut sınırı (413) yüzünden ≤ 500 KB'lık parçalara bölünür.

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

### Wikimedia Commons fotoğrafları

Envanter fotoğrafı olmayan, Wikidata kimliği olan eserlere Wikidata P18 görselini ekler. Uygulamalar Wikimedia'ya istek atmaz; dosya ve atıf bilgisi bir kez veritabanına ve Storage'a yazılır.

```bash
# izole ortam: python -m venv data/.venv && data/.venv/Scripts/pip install pillow
data/.venv/Scripts/python -I data/commons_photos.py --upload
npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_media_commons.sql
```

- Lisans süzgeci: CC0, kamu malı, CC BY, CC BY-SA (NC / ND / bilinmeyen atlanır). Yazar, lisans, lisans bağlantısı, dosya sayfası ve yaptığımız değişiklik (`modifications`) satırda tutulur.
- 1600 px ve 480 px WebP → `media/commons/`. İstekler saniyede en çok 1, `User-Agent` ile; yanıt önbelleği `data/raw/commons_cache.json`.
- Satırlar `draft` girer. Yayın için eserin Wikidata eşleşmesi eşleştirme masasında kabul edilmiş olmalı (tetikleyici `media_commons_guard`). Yeni eşleşme kabul edilince betik yeniden çalıştırılır; admin kararlarını ezmez.
- **Sonuç (21 Ekim):** 141 aday eserden 59'unda P18 görseli var; 59 taslak fotoğraf yüklendi. Eşleşmesi kabul edilmiş eser yok, bu yüzden henüz hiçbiri yayında değil.

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

**Başlangıç noktaları, yer işaretleri, anlatım ve eser varış noktaları** grafikte değil, admin panelinde (**Noktalar**, `nav_points`) girilir. Uygulama onları çalışırken en yakın yaya düğümüne bağlar; grafiği yeniden üretmek gerekmez. Rotalar her zaman motorca hesaplanır; elle yazılmış rota yoktur.

**3. Doğrulayın:** `pnpm test` (`pilot-graph.test.ts`) her landmark çifti arasında rota olduğunu ve tekerlekli sandalye rotasının basamaksız olduğunu kontrol eder.

**Değerlerin kaynağı**
- Basamak, zemin ve genişlik OSM etiketlerinden gelir.
- Gürültü yol sınıfından tahmin edilir.
- Landmark görünürlüğü: landmark'a 40 m'den yakın segmentler.

Bunlar tahmindir; saha ölçümü gelince güncellenir (ROADMAP #6). Yol verisinin lisansı © OpenStreetMap katkıcıları (ODbL).

**Yeni pilot alan eklemek:** `AREAS` sözlüğüne bir girdi ekleyin, Overpass çıktısını `data/raw/osm_<alan>.json` olarak indirin ve script'i alan adıyla çalıştırın.

## 4. Eski: İstanbul Wikidata pilotu

`wikidata_pilot.py` ve `supabase/seed_wikidata_pilot.sql` ilk prototipin Süleymaniye verisidir. Kayıtlar veritabanında `archived` durumunda; yeni işte kullanmayın.
