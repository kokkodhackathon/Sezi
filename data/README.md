# Veri pipeline'ı

Vakıf Katılım veri seti (60–80 eser, yarı yapılandırılmış) → `packages/shared/src/schemas.ts` modeline dönüşüm.

1. Ham dosyalar `data/raw/` klasörüne konur (git'e girmez).
2. Çıkarma: alanlar ayrıştırılır. LLM ile çıkarılan her alan `status = draft` olarak girer.
3. Doğrulama: pydantic şeması + kaynak zorunluluğu (kaynaksız tarihî metin reddedilir).
4. Çıktı: `data/out/*.json` → seed SQL veya admin paneli üzerinden içe aktarma.

Veri seti gelene kadar geçici veri Wikidata/OSM'den alınır. Bu veri de `draft` olarak girer.
