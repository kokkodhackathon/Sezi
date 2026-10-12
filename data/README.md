# Veri pipeline'ı

Vakıf Katılım veri seti (60–80 eser, yarı yapılandırılmış) → `packages/shared/src/schemas.ts` modeline dönüşüm.

1. Ham dosyalar `data/raw/` klasörüne konur (git'e girmez).
2. Çıkarma: alanlar ayrıştırılır. LLM ile çıkarılan her alan `status = draft` olarak girer.
3. Doğrulama: pydantic şeması + kaynak zorunluluğu (kaynaksız tarihî metin reddedilir).
4. Çıktı: `data/out/*.json` → seed SQL veya admin paneli üzerinden içe aktarma.

Veri seti gelene kadar geçici veri Wikidata/OSM'den alınır. Bu veri de `draft` olarak girer.

## Geçici pilot verisi: Wikidata

```bash
python -I data/wikidata_pilot.py > supabase/seed_wikidata_pilot.sql
```

- Süleymaniye Camii'nin 400 m çevresindeki vakıf eseri türlerini (cami, medrese, türbe, çeşme, sebil, imaret, hamam, kütüphane) çeker.
- Yalnızca ad (tr/en), tür ve konum alınır; her eserin kaynağı Wikidata öğesidir.
- Külliye üyeleri `verified`, çevredeki diğer eserler `draft` girer, çünkü Wikidata'daki tür bilgisi hatalı olabilir. Taslaklar admin panelinden onaylanır.
- Üretilen SQL yeniden çalıştırılabilir: slug ve kaynak URL'ye göre günceller.

## Pilot navigasyon grafiği (OSM)

1. OSM yaya ağını indir (Overpass; ana sunucu yoğunsa `overpass.kumi.systems` kullanılabilir):
   ```bash
   Q='[out:json][timeout:60];(way(around:330,41.01611,28.96389)["highway"~"^(footway|pedestrian|steps|path|living_street|residential|service|unclassified|tertiary|secondary|corridor)$"]["access"!~"^(private|no)$"];);out body;>;out skel qt;'
   curl -s --data-urlencode "data=$Q" https://overpass.kumi.systems/api/interpreter -o data/raw/osm_suleymaniye.json
   ```
2. Grafiği üret: `python -I data/build_nav_graph.py` → `apps/mobile/assets/pilot/suleymaniye-nav.json` (uygulamaya gömülü, internetsiz çalışır).

- Basamak, yüzey, genişlik: OSM etiketleri. Gürültü: yol sınıfından tahmin. Landmark görünürlüğü: landmark'a 40 m'den yakın segmentler.
- Bu değerler tahmindir; Zehra'nın saha ölçümü geldiğinde segment özellikleri güncellenir.
- Yol verisi © OpenStreetMap katkıcıları (ODbL); uygulamada kaynak olarak gösterilir.
