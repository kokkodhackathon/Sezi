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
apps/web (Next.js, sezi.info) ─ sunucu sayfaları + ISR (anon, verified) ─ rota/tur/bildirim: aynı planlayıcı ┘
data/ (Python) ─ PDF/Wikidata/Nominatim/OSM ─► supabase/seed_*.sql, assets/pilot/*-nav.json
```

| Paket | Görev | Durum |
|---|---|---|
| `apps/mobile` | Kullanıcı uygulaması | Tüm final ekranları var, bir kısmı mock (aşağıda) |
| `apps/admin` | İçerik girişi, onay, moderasyon | shadcn/ui + Tailwind v4 (Çini 2 token'ları). Pano (veri kapsamı, bekleyen işler), eserler, yeni eser, eser metinleri, fotoğraf kutusu, konum eşleştirme, noktalar, rota testi, bildirimler, iller (apps/admin/README.md) |
| `apps/web` | Halka açık web sitesi (`sezi.info`) | Next.js 16 App Router, `/tr` ve `/en`. Eser sayfaları sunucuda üretilir, 10 dk'da bir yenilenir (ISR, SEO, JSON-LD). Keşfet (arama + filtre + harita), eser / il / külliye, sergiler, hakkında; pilot alanda rota planlama (önizleme, talimat listesi, profil karşılaştırması), turlar, hesapsız erişilebilirlik bildirimi; isteğe bağlı hesap (mobille aynı). Saf mantık `@sezi/shared`'den; harita kütüphanesi yalnız `src/components/map` |
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
- `text_drafts`: envanter kitabından çıkarılan TR/EN adres ve tarihçe taslağı (kitap, basılı sayfa aralığı, PDF sayfası, uyarılar, kitaptaki başlık `book_title`). Üretici `data/inventory_texts.py` (Bursa: yazı tipine göre; fark raporu `data/text_drafts_diff.py`). Admin kitap sayfasından ayrıca yapım yılı, bani, dönem ve sade dil özeti (`summary`) girer. Yayınlanınca (ya da yayındaki taslak düzeltilince) bunlar esere yazılır; bilgi kartı/özet varsa kaynağı da (`works.facts_source_id`, `facts_page`, `facts_pdf_page`). Admin metni değiştirince `edited_at` yazılır (`text_drafts_mark_edited`); veri hattı yalnız bekleyen ve düzenlenmemiş taslakları günceller.
- **Eser metinleri sayfası:** kitap sayfası PDF.js ile editörün yanında çizilir. Yayıncının PDF'i iframe'e izin vermiyor (`X-Frame-Options`) ve parça indirmeyi desteklemiyor; dosya ilk açılışta bir kez indirilir, tarayıcının Cache Storage'ında (`sezi-books`) URL anahtarıyla saklanır. Bekleyen liste: pilot alan eserleri → fotoğraflı eserler → diğerleri. Tek düğme ya da Ctrl+Enter ile yayınlanır, sıradaki taslağa geçilir.
- **Metin önerileri** (`shared/text-suggest.ts`, admin `components/text-suggestions.tsx`): formdaki o anki metinden hesaplanır, veritabanında tutulmaz (elle düzenlenmiş metinde de doğru kalır, her ilde çalışır). Mimari bölüm: paragraf puanıyla (mimari sözcükler artı; tarih, onarım, yıl eksi) en olası ardışık blok işaretli gelir, admin düzeltip Mimari alanına taşır; Mimari zaten doluysa gösterilmez. Yapım yılı: yapım fiili ve miladi yıl geçen, onarım/vefat anlatmayan cümleler (en çok 3), cümlesiyle; seçilince alana yazılır. Hiçbiri kaydetmeden yayına girmez.
- Ziyaret bilgisi (`works.visit_*`: basamak, rampa, açık saat, gezme süresi, not) yalnız kaynağı (`visit_source`) ve kontrol tarihiyle girer (check `works_visit_sourced`); admin **Eserler** düzenleme sayfasında.
- `media.origin`: `inventory` (arşiv), `commons` (Wikidata P18), `upload` (admin'in **Fotoğraf kutusu → Yükle** ile eklediği; fotoğrafçı ve kullanım izni zorunlu, check `media_upload_attribution`). Yüklenen dosya tarayıcıda 1600/480 px WebP'ye çevrilir, `media/uploads/<eser>/`.
- Kararlar tek işlemde: istemci yalnız karar satırının `status`'unu günceller; eser değişikliğini aynı transaction'da tetikleyici yapar (`apply_candidate_decision`, `apply_text_publish`; security invoker, RLS geçerli). Eser yazılamazsa karar da yazılmaz. Bir eserin en çok bir kabul edilmiş adayı olur (kısmi tekil dizin); yeni kabul öncekini reddeder. Karar zamanı ve karar veren (`decided_at`, `decided_by`) de tetikleyiciyle yazılır (`stamp_decision`).

**Hesap (isteğe bağlı)**
- Uygulama hesapsız tam çalışır; hesap açılışta sorulmaz (Profil → Hesap). İleride hesaplılara açılacak özelliklerin sahibi bu yapıdır.
- Kimlik: Supabase Auth, e-posta + şifre (en az 8 karakter, harf ve rakam). Doğrulama, şifre sıfırlama ve girişliyken şifre değişimi e-postaya gelen 6 haneli kodla; derin bağlantı yok. Şifre değişimini sunucu zorlar (`secure_password_change`: `reauthenticate` kodu `nonce` olarak). E-posta değiştirme yok: çift onay kod akışında çalışmıyor (supabase/supabase#32909) ve kapatılması güvenli değil.
- `accounts` (RLS: yalnız sahibi okur/ekler/günceller; anon erişemez): `prefs` (erişilebilirlik profili + taşınan ayarlar, ≤ 8 KB), `prefs_updated_at`. Satırı istemci ilk girişte ekler; auth.users üzerinde tetikleyici yok.
- `profiles` (kimlik, `lib/identity.ts`): `display_name`, `username` (benzersiz, `^[a-z0-9_]{3,20}$`, isteğe bağlı), `avatar_path` (yalnız `avatars/<uid>/…`), `avatar_tone` (Çini 2 tonu), `visibility` (`private` / `public`). RLS: sahibi yazar; girişli kullanıcı kendisini ve `public` profilleri okur, anon hiçbirini. Arkadaş ekleme ve kişisel galeri bu tabloya bağlanacak. Tercihler bu tabloda değil; açık profilde e-posta ve tercih görünmez. Satırı istemci ilk girişte kayıttaki adla açar.
- Profil fotoğrafı: özel `avatars` kovası (yalnız JPEG, ≤ 1 MB). Uygulama seçilen kareyi 512 px'e küçültür, her yüklemede yeni dosya adı (önbellek dosyaya bağlı), eskisini siler. Okuma oturum anahtarıyla `storage/v1/object/authenticated/…` (`lib/supabase.ts › privateObject`); sahibi ve açık profilde girişli kullanıcılar okur.
- Tercih eşitleme (`lib/account.tsx`): cihaz kaynaktır. Yeni girişte hesaptaki tercih cihaza gelir; sonra en yeni değişiklik kazanır (`prefs_updated_at`). İnternetsiz değişiklik bekler, öne gelince gider. E-posta şablonu dili `user_metadata.lang`'dan.
- Hesap silme: edge function `delete-account` (oturum anahtarını Auth sunucusunda doğrular, `reports/<uid>/` ve `avatars/<uid>/` dosyalarını ve kullanıcıyı siler). `accounts` ve `profiles` cascade ile gider; `a11y_reports.user_id` ve `reviewed_by` boşalır (bildirim ve onay kalır).
- Çıkış: `signOut({ scope: 'local' })`. İnternet yokken geçerli oturum yine yerelde silinir (sunucu hatası yok sayılır); süresi dolmuş oturum yenilenemediği için supabase-js onu yerinde bırakır. Başarı yalnız cihazdaki oturum anahtarı (`lib/supabase.ts › SESSION_KEY`) gerçekten silindiyse bildirilir: o zaman hesap ve kimlik önbelleği temizlenir, Profil'e dönülür; değilse kullanıcı girişli kalır ve "bağlantı gelince tekrar deneyin" görür.
- E-posta: Resend SMTP (`config.toml [auth.email.smtp]`, gönderici `no-reply@sezi.info`, anahtar `supabase/.env › RESEND_API_KEY`); şablonlar `supabase/templates/` (TR/EN, Çini 2 renkleri). Ücretsiz planda şablon değişikliği özel SMTP ister. Gönderim: `set -a; . supabase/.env; set +a; npx supabase@latest config push --project-ref jejsvycpzulpleftkssj` (yalnız auth'a "y"). Auth her şablonu ilk kullanımda önbelleğe alır (`TemplateMaxAge`, varsayılan 10 dk): değişiklikten sonraki ilk dakikalarda eski şablon gidebilir; gerçek içerik Resend `GET /emails/{id}` ile denetlenir.

**Seslendirme (Chirp 3 HD)**
- Edge function `tts` (`supabase/functions/tts`, JWT doğrulaması kapalı): Türkçe metni Google Chirp 3 HD ile MP3'e çevirir, `tts` bucket'ına `chirp3/<ses>/<sha256>.mp3` olarak yazar. Aynı metin ikinci kez Google'a gitmez.
- `tts_usage` + `tts_reserve`: yeni üretilen karakterlerin günlük toplamı; sınır `TTS_DAILY_CHAR_LIMIT` (30.000). Aşılınca 429, uygulama cihaz sesine düşer. Google anahtarı `GOOGLE_TTS_API_KEY` secret'ı.

**Okuma arayüzü**
- `works_view` (security_invoker): eser, il, tür, külliye, `lng/lat`, kaynaklar, sergiler, fotoğraflar (envanter → yüklenen → Commons), ses kaydı yolları (`audio_tr`, `audio_en`), bilgi kartı kaynağı (`facts_source`) ve ziyaret bilgisi tek satırda.
- Mobil uygulama yalnızca bu view'u ve `cities`, `sources`, `exhibitions` tablolarını okur; içerik sorguları `status = 'verified'` süzer (admin hesabıyla giriş yapılsa da taslak görünmez).

**RLS**
- Anonim kullanıcı yalnızca `verified` içeriği okur.
- Admin (`app_metadata.role = 'admin'`) her şeyi yazar.
- Giriş yapmış kullanıcı yalnızca kendi bildirimini ve kendi `accounts` satırını görür.

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
   - Turlar: tanımlar `shared/tours.ts › TOURS` (eser türüne göre havuz; mobil `lib/tours.ts` en yakın komşu sırasıyla planlar, admin panosu aynı tanımla tur kapsamını sayar); "Başla" durakları sırayla aynı navigasyon ekranında yürütür.
5. **Yönlendirme** (`shared/guidance.ts › buildGuidance`)
   - Dönüş açısı ve en yakın yer işaretinden Lynch tarzı talimat; merdiven, zemin, cadde uyarısı; uzun düzlükte teyit.
   - İpucu türü profile göre seçilir (`cuePreference`): duymayan kullanıcıya sesli ipucu verilmez.
6. **Navigasyon oturumu** (`mobile/lib/navigation/session.ts`)
   - Aşamalar: plan → yürüyüş → varış. Konum kaynağı GPS (`expo-location`, ön planda; ekran `expo-keep-awake` ile açık) ya da geliştirici simülasyon modunda sanal yürüyüşçü (`shared/walker.ts`, başlangıç "Konumum" değilse). İkisi de aynı takip adımından geçer (`shared/follow.ts › followRoute`: `trackFix`, `dueStep`, rotadaki uğrama noktaları).
   - Yarıçapa girilen anlatım/varış noktası yürüyüş başına bir kez açılır (`shared/points.ts › duePoints`, doğruluk > 50 m ise tetiklemez); sanal yürüyüş nokta okunurken bekler.
   - Eser anlatımları: yayınlanmış metni (`summary` ya da `history`) ve kesin konumu olan pilot alan eserleri sanal anlatım noktası olur (`shared/points.ts › workPoint`, kimlik `work:<slug>`, yarıçap 20 m, metin `excerpt` ile ilk paragraflardan ≤ 420 karakter, son tam cümlede kesilir). Planlayıcıya girmez, yani rota bunlara sapmaz; yalnız yanından geçilince açılır (`passingWorkPoints`: admin'de esere bağlı anlatım/varış noktası varsa o kullanılır, hedef ve turdaki eserler yolda açılmaz). Varılan eser sonraki duraklarda yeniden açılmaz. Admin'de varış noktası olmayan hedefte varış kartı ve sesi bu noktadan gelir. Liste `lib/points.ts` içinde eşitlenir, kv'de saklanır (`sezi.workpoints.v1`), TR metni Chirp ile önceden indirilir.
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
| `work/[slug]` | Eser: bölümlere hızlı geçiş (çip; ekran okuyucu odağı başlığa geçer), kısaca (sade özet), kaynak numaralı bilgi kartı, gitmeden önce (giriş, saat, süre, pilotta yürüme), tarihçe/mimari (her bölüm ayrı dinlenir, okunan cümle vurgulanır: `lib/voice/read-along.ts` + `shared/sentences.ts`; konuşma kuyruğu `shared/speech-queue.ts`, `onDone` içinden başlayan sonraki cümle araya giren talimatla kesilmez), konum, kaynaklar | `works_view` |
| `city/[slug]` | İl: envanter istatistikleri, kitaplar, sergiler, ilçeler | `cities`, `sources`, `exhibitions` |
| `navigate` | Tek navigasyon ekranı: nereden (konumum / başlangıç noktası / haritada seçilen yer) → nereye (eser, tur ya da gezinti) → yol üstündeki noktalara uğrayan rota → canlı rehberlik (GPS ya da simülasyon) → varış kartı ve sesi | `nav_points_view`, gömülü grafik |
| `compare/[slug]` | Aynı başlangıç ve hedef için üç profilin rotası; başlangıç ve hedef seçilebilir | gömülü grafik |
| `exhibitions` | Envanter fotoğraf sergileri | `exhibitions` |
| `search` | Ad, tür, ilçe ve il araması | `works_view` |
| `report/new`, `reports` | Erişilebilirlik bildirimi: cihazda kuyruk → sunucu (hesapsız, RLS); onaylanınca "onaylandı" | `a11y_reports`, `segment_overrides` |
| `account/*` | İsteğe bağlı hesap: `index` (girişsiz tanıtım / girişli profil kartı, eşitleme, çıkış), `sign-up`, `sign-in`, `verify` (kayıt kodu), `reset-code` (sıfırlama kodu; ikisi `components/code-verify.tsx`, başlıklar `_layout.tsx`'te sabit), `forgot`, `password` (sıfırlama sonrası ya da kodla değişim), `edit` (fotoğraf, ad, @kullanıcı adı, renk, görünürlük), `delete` | Supabase Auth, `accounts`, `profiles`, `avatars`, `delete-account` |
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
