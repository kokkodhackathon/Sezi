# Mimari

Durum: 13 Ekim 2026. Bu belge **bugün çalışan** sistemi anlatır. Hedefler ve yapılacaklar [ROADMAP.md](ROADMAP.md) dosyasında.

## Bileşenler

```
┌──────────────── apps/mobile (Expo SDK 57, RN 0.86 Fabric, Android dev build) ───────────────┐
│ Expo Router ekranları ─ TanStack Query ─ supabase-js (anon) ──────────────► Supabase Cloud │
│        │                                                                    (Postgres+RLS,  │
│        ├─ lib/nav.ts ─ assets/pilot/bursa-hanlar-nav.json (gömülü, internetsiz)  PostGIS,   │
│        │        └─ @sezi/shared: createPlanner · findRoute · buildGuidance       pgvector)  │
│        └─ lib/navigation/session.ts ─ @sezi/shared: followRoute · walker ─ ses/haptik ▲    │
└────────────────────────────────────────────────────────────────────────────────────│────────┘
apps/admin (Vite + React) ─ Rota testi: aynı planlayıcı + sanal yürüyüş ── authenticated + admin ┘
data/ (Python) ─ PDF/Wikidata/Nominatim/OSM ─► supabase/seed_*.sql, assets/pilot/*-nav.json
```

| Paket | Görev | Durum |
|---|---|---|
| `apps/mobile` | Kullanıcı uygulaması | Tüm final ekranları var, bir kısmı mock (aşağıda) |
| `apps/admin` | İçerik girişi, onay, moderasyon | Eserler, yeni eser, fotoğraf kutusu, bildirimler, iller (apps/admin/README.md) |
| `packages/shared` | zod şemaları, geo, rota ve yönlendirme motoru, tema token'ları | Testli (19 test) |
| `supabase` | Migration'lar, seed'ler | 3 migration uygulandı; güvenlik uyarısı yok |
| `data` | Ham veri → model dönüşümü | Envanter pipeline'ı ve nav grafiği üretici |

## Veri modeli (Postgres, `public`)

**Coğrafya ve sınıflandırma**
- `regions`
- `cities`: `slug`, `is_active`, `sort_order`, `inventory_year`, `inventory_works`, `inventory_photos`, `inventory_status`, `inventory_note`
- `work_types`: cami, medrese, türbe, han, hamam, çeşme, kilise, sinagog, tekke, konak, diğer…

**Eser**
- `works` (`location` null olabilir) ve şu alanlar:
  - konum: `district`, `address`, `location_precision` (exact / approximate / unknown)
  - içerik: `period`, `history`, `architecture`, `condition`, `condition_note`, `unesco`
  - yönetim: `external_ids`, `needs_review`, `status` (draft / verified / archived)
  - ses: `audio_tr_id`, `audio_en_id` (`audio_assets`; admin eser sayfasından yüklenir, uygulamada metin okuması yerine çalar)
- Bağlı tablolar: `complexes`, `work_events` (zaman çizelgesi), `inscriptions` (kitabeler), `media`, `glossary_terms`

**Kaynak**
- `sources`: `kind` = inventory / wikidata / osm / …, `city_id`, `volume`
- `work_sources`: `page`, `section`
- `exhibitions` ve `work_exhibitions`: envanter fotoğraf sergileri

**Navigasyon**
- `nav_nodes`, `nav_segments`, `instructions`, `audio_assets`
- Şu an kullanılmıyor: uygulama gömülü JSON grafiği okuyor (aşağıda).

**Admin ↔ uygulama bağı**
- `a11y_reports`: hesapsız eklenebilir (yalnızca `pending`, pilot grafiği anahtarı `area` + `segment_key`); okuma yalnızca admin. Ekleme tetikleyicisi notu temizler, cihaz başına saatte 10 bildirim sınırı koyar.
- `segment_overrides`: admin onayında tetikleyiciyle dolar (geri alınınca silinir); herkes okur. Uygulama açılışta ve öne gelince çeker, rota grafiğine uygular (`nav.ts › setOverrides`), cihazda saklar.
- `media.work_id` boş olabilir: eşleşmeyen arşiv fotoğrafı taslak olarak "fotoğraf kutusu"nda bekler.

**Topluluk ve yapay zekâ**
- `a11y_reports`: pending → approved / rejected
- `doc_chunks`: RAG için embedding'ler; henüz boş.

**Eşleştirme masası** (veri hattının önerileri; yalnız admin okur/yazar, uygulama okumaz)
- `location_candidates`: eser başına konum adayları (`wikidata` / `osm` / `nominatim` / `override` / `current`), puan, gerekçe (`reasons`: ad benzerliği, tür, ilçe, uyuşan kaynaklar), `vetoed` (tür ya da ilçe çelişkisi), `status` (pending / accepted / rejected). Üretici `data/location_candidates.py`. Admin kabul edince eserin `location`, `location_precision` (yapı düzeyi → exact) ve `external_ids` alanları yazılır; `seed_inventory.sql` kabul edilmiş konumu ezmez.
- `text_drafts`: envanter kitabından çıkarılan TR/EN adres ve tarihçe taslağı (kitap, basılı sayfa aralığı, PDF sayfası, uyarılar). Üretici `data/inventory_texts.py`. Admin "Esere yayınla" deyince eserin `address` / `history` / `architecture` alanlarına yazılır.
- Kararlar tek işlemde: istemci yalnız karar satırının `status`'unu günceller; eser değişikliğini aynı transaction'da tetikleyici yapar (`apply_candidate_decision`, `apply_text_publish`; security invoker, RLS geçerli). Eser yazılamazsa karar da yazılmaz. Bir eserin en çok bir kabul edilmiş adayı olur (kısmi tekil dizin); yeni kabul öncekini reddeder. Karar zamanı ve karar veren (`decided_at`, `decided_by`) de tetikleyiciyle yazılır (`stamp_decision`).

**Seslendirme (Chirp 3 HD)**
- Edge function `tts` (`supabase/functions/tts`, JWT doğrulaması kapalı): Türkçe metni Google Chirp 3 HD ile MP3'e çevirir, `tts` bucket'ına `chirp3/<ses>/<sha256>.mp3` olarak yazar. Aynı metin ikinci kez Google'a gitmez.
- `tts_usage` + `tts_reserve`: yeni üretilen karakterlerin günlük toplamı; sınır `TTS_DAILY_CHAR_LIMIT` (30.000). Aşılınca 429, uygulama cihaz sesine düşer. Google anahtarı `GOOGLE_TTS_API_KEY` secret'ı.

**Okuma arayüzü**
- `works_view` (security_invoker): eser, il, tür, külliye, `lng/lat`, kaynaklar, sergiler, fotoğraflar ve ses kaydı yolları (`audio_tr`, `audio_en`) tek satırda.
- Mobil uygulama yalnızca bu view'u ve `cities`, `sources`, `exhibitions` tablolarını okur.

**RLS**
- Anonim kullanıcı yalnızca `verified` içeriği okur.
- Admin (`app_metadata.role = 'admin'`) her şeyi yazar.
- Giriş yapmış kullanıcı yalnızca kendi bildirimini ekler.

**Veri durumu (13 Ekim)**

| İl | Kayıt | Konumlu | Kesin konum |
|---|---|---|---|
| Bursa | 341 | 129 | 71 |
| Konya | 271 | 73 | 28 |
| Hatay | 74 | 29 | 16 |

- İstanbul'daki eski pilotun 85 kaydı `archived` durumunda.

## Rota ve rehberlik

1. **Grafik**
   - `data/build_nav_graph.py <alan>`, OSM yaya ağını ve `works_view` içindeki kesin konumlu eserleri birleştirir.
   - Çıktı: `nodes` (eserlerde `workSlug`) ve `segments` (uzunluk, basamak, eğim, zemin, gürültü).
   - Bursa Hanlar (650 m): 892 düğüm, 1215 segment, 20 eser.
2. **Noktalar** (`nav_points`, admin panelinde "Noktalar"; kodda sabit nokta ya da rota yok)
   - Roller: `start` (başlangıç/buluşma, `sort_order` ile sıralı; ilki varsayılan), `landmark` (yer işareti, belirginlik 1–3, ortam sesi), `story` (anlatım: metin + ses, yarıçap), `arrival` (eser varış bilgisi, `work_id` zorunlu). Bir yer birden çok rol taşır. Her rol isteğe bağlı olarak bir esere bağlanabilir (`work_id`): yürüyüşte nokta açılınca kartta eserin fotoğrafı, türü, yeri ve dönemi görünür, dokununca eser sayfası açılır (`components/point-popup.tsx` + `work-preview.tsx`). Bir esere yayında tek varış noktası olur. Noktalara bağlı eserlerin satırı ve kapak küçüğü eşitlemede cihaza alınır (`works.ts › prefetchWorks`, kv `sezi.work.v1:<slug>`); `useWork` önce bu son bilinen satırı gösterir, ağ hatasında ona düşer: kart ve eser sayfası internetsiz de açılır.
   - Uygulama `nav_points_view`'u çeker, kv'de saklar, sesleri `Paths.cache/point-audio`'ya indirir (`lib/points.ts`) ve grafiğe çalışırken uygular (`nav.ts › setNavPoints`): yer işareti en yakın düğüme (≤ 60 m) bağlanıp talimatta anılır; 40 m içindeki segmentlerin görünürlüğü belirginliğe göre artar; anlatım/varış noktaları uğrama adayı olur (≤ 40 m).
   - Onaylı erişilebilirlik bildirimleri (`segment_overrides`) aynı çalışma grafiğine uygulanır; nokta ya da bildirim değişince `useNavVersion` artar ve ekranlar yeniden hesaplar.
3. **Maliyet** (`shared/routing.ts › segmentCost`)
   - Profile göre değişir: tekerlekli sandalye basamağı hiç kullanmaz; görme kısıtlı kullanıcı gürültü ve kaldırımdan kaçınır.
   - Yer işareti görünürlüğü maliyeti düşürür.
   - Arama algoritması Dijkstra (`findRoute`).
4. **Rota** (`shared/planner.ts › createPlanner`; mobilde `nav.ts` gömülü grafikle kurar, adminde `lib/pilot.ts`)
   - `planRoute(eser, profil, başlangıç)`: `shared/via.ts › routeVia` rotayı yakındaki anlatım/varış noktalarına uğratır (açgözlü ekleme, en çok %25 ve +300 m). Haritada seçilen başlangıç ya da yeniden rotada `withLeadIn` kullanıcının tam konumundan bağlar.
   - `planStroll` (hedefsiz gezinti): en yakın açılmamış noktaya, oradan bir sonrakine; en çok 5 nokta, bacak ≤ 500 m, toplam ≤ 1,2 km.
   - Turlar (`lib/tours.ts`): eser türüne göre havuz, en yakın komşu sırası; "Başla" durakları sırayla aynı navigasyon ekranında yürütür.
5. **Yönlendirme** (`shared/guidance.ts › buildGuidance`)
   - Dönüş açısı ve en yakın yer işaretinden Lynch tarzı talimat; merdiven, zemin, cadde uyarısı; uzun düzlükte teyit.
   - İpucu türü profile göre seçilir (`cuePreference`): duymayan kullanıcıya sesli ipucu verilmez.
6. **Navigasyon oturumu** (`mobile/lib/navigation/session.ts`)
   - Aşamalar: plan → yürüyüş → varış. Konum kaynağı GPS (`expo-location`, ön planda; ekran `expo-keep-awake` ile açık) ya da geliştirici simülasyon modunda sanal yürüyüşçü (`shared/walker.ts`, başlangıç "Konumum" değilse). İkisi de aynı takip adımından geçer (`shared/follow.ts › followRoute`: `trackFix`, `dueStep`, rotadaki uğrama noktaları).
   - Yarıçapa girilen anlatım/varış noktası yürüyüş başına bir kez açılır (`shared/points.ts › duePoints`, doğruluk > 50 m ise tetiklemez); sanal yürüyüş nokta okunurken bekler.
   - Ses sırası (`pointVoice`): kendi dilinde kayıt → kendi dilinde metin (TTS) → TR kayıt → TR metin. Kayıt çalarken talimatlar bekler, bitince okunur.
   - Metin okuması (`lib/voice/speech.ts`, kuyruk + `interrupt`): Türkçe metin Chirp 3 HD (`tr-TR-Chirp3-HD-Laomedeia`) ile çalar; cihazda hazır değilse talimatta 1,5 sn, anlatımda 8 sn beklenir, gelmezse `expo-speech`. İngilizce her zaman `expo-speech`.
   - Hazır sesler üç yerden gelir (`lib/voice/chirp.ts › readyChirp`): (1) uygulamaya gömülü sabit cümleler: adsız dönüşler uyarılarıyla, "Vardınız.", kalabalık ve rota bulunamadı uyarıları (`shared/guidance.ts › staticGuidanceTexts`, `navigation/texts.ts › NAV_STATIC_TR`; `assets/voice/tr`, `voice/bundled.ts`). Kalıp değişince `cd apps/mobile && npx tsx scripts/gen-voice-bundle.mts`. (2) Daha önce indirilenler (`Paths.document/tts`). (3) Yoksa edge function. Rota hesaplanınca talimatlar, nokta eşitlemesinde kaydı olmayan anlatımlar önceden indirilir; böylece sahada internetsiz çalar.
   - Sapma, yol kapatma ve yanlış dönüşte bulunulan yerden yeniden rota (açılmış noktalar atlanır). Varışta eser kartı ve varış bilgisinin sesi.
   - Duymayan kullanıcıda ses yerine `CueFlash` (ekran kenarı parlaması) ve titreşim.
7. **Harita** (Mapbox): mobilde `@rnmapbox/maps` yalnızca `components/map` içinde (ekranlar `SeziMap`, `RouteLine`, `PointsLayer`, `WorkClusters`… kullanır); adminde `mapbox-gl` yalnızca `lib/mapbox.ts` üzerinden. Stil Mapbox Standard: düz, dükkân etiketleri kapalı, Çini zemin renkleri; koyu temada gece, az gören profilinde tek renkli.
8. **Admin rota testi** (`admin/pages/RouteTest.tsx`, `lib/route-test.ts`): telefona gerek kalmadan aynı planlayıcı, aynı sanal yürüyüşçü ve aynı takip adımı. Profil (yürüyen, tekerlekli sandalye, görme engelli, duymayan) ve talimat dili seçilir; rota, talimat listesi, uğrama sırası, yol kapatma ve yanlış dönüş senaryoları, açılan nokta kartı ve zaman damgalı kayıt panelde görünür. İstenirse taslak noktalar da rotaya katılır (uygulama yalnızca yayındakileri görür).
   - **Profil karşılaştırması:** aynı başlangıç ve hedef için dört profilin rotası aynı haritada (renk yanında kalınlık ve kesiklikle ayrışır) ve tabloda: uzunluk, süre, en kısaya fark, basamak, ana cadde ve arnavut kaldırımı, uğrama, talimat sayısı, profilin rotayı neden değiştirdiği, aynı çıkan rotalar. Seçilen profil simülasyonun profili olur. Duymayan profil rota maliyetinde yürüyenle aynıdır; fark ipucundadır.

## Mobil ekranlar

| Rota | İçerik | Veri |
|---|---|---|
| `onboarding` | Algısal profil: görme, hareket, işitme, duyular, dil | cihaz |
| `(tabs)/index` Keşfet | İl seçici, kümelenmiş harita, tür ve ilçe filtresi, liste | `works_view` |
| `(tabs)/tours`, `tour/[id]` | Pilot alan turları; durak sırası grafikten hesaplanır | gömülü grafik |
| `(tabs)/ask` | Sezi'ye Sor: **yerel anahtar kelime eşleştirme** (LLM yok) | `works_view` |
| `(tabs)/profile` | Profil, ayarlar, bildirimler, sergiler, hakkında | cihaz |
| `work/[slug]` | Eser: envanter atfı (cilt/sayfa + PDF), durum, UNESCO, konum kesinliği, anlatım metni | `works_view` |
| `city/[slug]` | İl: envanter istatistikleri, kitaplar, sergiler, ilçeler | `cities`, `sources`, `exhibitions` |
| `navigate` | Tek navigasyon ekranı: nereden (konumum / başlangıç noktası / haritada seçilen yer) → nereye (eser, tur ya da gezinti) → yol üstündeki noktalara uğrayan rota → canlı rehberlik (GPS ya da simülasyon) → varış kartı ve sesi | `nav_points_view`, gömülü grafik |
| `compare/[slug]` | Aynı başlangıç ve hedef için üç profilin rotası; başlangıç ve hedef seçilebilir | gömülü grafik |
| `exhibitions` | Envanter fotoğraf sergileri | `exhibitions` |
| `search` | Ad, tür, ilçe ve il araması | `works_view` |
| `report/new`, `reports` | Erişilebilirlik bildirimi: cihazda kuyruk → sunucu (hesapsız, RLS); onaylanınca "onaylandı" | `a11y_reports`, `segment_overrides` |
| `sign-in` | Magic link (Supabase OTP); oturum kalıcı değil | Supabase Auth |
| `complex/[slug]` | Külliye ekranı; Bursa verisinde külliye bağlantısı henüz yok | `works_view` |
| `settings`, `about`, `lab` | Ayarlar, proje ve envanter bilgisi, cihaz testleri (ses, pusula, haptik) | – |

**Mock ya da eksik kalanlar**
- Ask'te LLM yok.
- Galeri yer tutucu.
- Tarihçe metni yok (kitap sayfasına yönlendiriyor).
- Eser listesi için çevrimdışı önbellek yok; yalnızca rota internetsiz çalışıyor.
- Gerçek GPS takibi yok.

## Kararlar ve gerekçeleri

| Karar | Gerekçe |
|---|---|
| Supabase Cloud free tier (Frankfurt) | Ekip küçük; Auth, RLS ve Storage hazır. Duraklama riski keep-alive workflow'u ile önleniyor |
| Pilot grafiği uygulamaya gömülü | Demo internetsiz çalışmalı |
| `GeoJSONSource` + `Layer`, `Marker` yok | `Marker`, RN 0.86 Fabric ile çöküyor (`pullTransaction`) |
| Metinler `{tr, en}` jsonb | Tek satırda iki dil; yeni dil eklemek şema değişikliği gerektirmez |
| Kitaplardan yalnızca olgular | Telif; metin ve foto resmî paylaşımla gelecek |
| Konum kesinliği ayrı alan | Yaklaşık eşleşmeler gerçek konum gibi gösterilmemeli |
| LLM sağlayıcısı kararsız | `LLMProvider` arayüzüyle bağımsız kalınacak; karar ROADMAP'te açık |
| Türkçe seslendirme Chirp 3 HD, önbellekli; İngilizce cihaz sesi | Cihazdaki Türkçe ses zayıf. Aynı metin bir kez üretilir (Storage + cihaz), günlük 30k karakter sınırı aylık ücretsiz 1M içinde kalır; ayrı sunucu gerekmez |
| Kendi i18n katmanı (i18next değil) | Tipli anahtarlar; eksik EN çevirisi derleme hatası verir |
