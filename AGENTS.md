# AGENTS.md — Sezi'de çalışan her oturum ve ajan için

Bu dosyayı işe başlamadan önce okuyun. Son durum ve sıradaki işler: [HANDOFF.md](HANDOFF.md). Ayrıntılar: [ARCHITECTURE.md](ARCHITECTURE.md) (sistem), [ROADMAP.md](ROADMAP.md) (ne yapılacak, kim yapıyor), [ENVANTER.md](ENVANTER.md) (veri kaynağı ve telif), [PRODUCT.md](PRODUCT.md) (ürün ilkeleri).

## Proje bir bakışta

- **Sezi:** vakıf eserlerine Kevin Lynch'in bilişsel haritalama yaklaşımıyla (landmark / node / path / district) yön tarif eden, çok duyulu ve erişilebilir keşif uygulaması.
- **Bağlam:** 42 Türkiye x Vakıf Katılım KÖK&KOD Hackathon, takım LAHMACUN. Final ve canlı demo 7–8 Kasım 2026.
- **Ekip:** Ediz (backend), Eda (frontend), İnci (tasarım), Zehra (veri).
- **Kapsam:** Hatay, Konya ve Bursa. Veri, Vakıf Katılım'ın vakıf eserleri envanter kitaplarından geliyor.
- **Pilot alan:** Bursa, Ulu Cami ve Hanlar Bölgesi. Sesli rehberlik ve rota yalnızca burada var.
- **Dil:** Arayüz TR + EN. Kod tanımlayıcıları İngilizce; yorumlar, belgeler ve commit mesajları Türkçe.

## Komutlar

```bash
pnpm install
pnpm test                         # packages/shared (Vitest): rota, rehberlik, tema kontrastı, pilot grafiği
pnpm typecheck                    # tüm paketler
pnpm dev:web                      # web sitesi (apps/web, Next.js) http://localhost:3001
cd apps/mobile && npx expo start --dev-client   # Metro (dev build telefonda/emülatörde kurulu olmalı)
cd apps/mobile && npx expo run:android          # native modül eklendiyse yeniden build (~9 dk)
```

**İş bitti demeden önce:**
1. `pnpm typecheck` ve `pnpm test` temiz geçmeli.
2. Ekran değiştiyse cihazda bakılmalı. Bakılamadıysa bunu açıkça yazın.

## Değiştirilemez kurallar

1. **Commit'e yapay zekâ imzası eklenmez.** `Co-Authored-By`, "Generated with …" gibi satırlar yasak. Commit'i ekip üyesinin kimliği atar.
2. **`docs/`, `data/raw/`, `data/out/` ve `.env*` asla commit'lenmez** (gitignore'da). `docs/` yarışma belgeleri ve moodboard içindir, yalnızca yerel referanstır.
3. **Kaynaksız bilgi uydurulmaz.**
   - Tarihçe, mimari, tarih, kitabe gibi metinler ancak kaynağıyla girer.
   - Doğrulanmamış içerik `draft` kalır. Anonim kullanıcı yalnızca `verified` içeriği görür (RLS).
4. **Telif.** Envanter kitapları "Tüm hakları saklıdır" ibaresi taşıyor; organizasyon hackathon kapsamında veri seti olarak paylaştı (kullanıcı kararı, 18 Ekim).
   - Ad, il, ilçe, tür, cilt/sayfa doğrudan girer.
   - Kitap metinleri (adres, tarihçe) yalnız `text_drafts` taslağı olarak girer; admin kitap sayfasıyla karşılaştırıp **Eser metinleri** sayfasından yayınlar. Otomatik yayın yok, kitap atfı korunur. Ayrıntı: ENVANTER.md §5.
5. **Erişilebilirlik çekirdektir, sonradan eklenmez.**
   - Her etkileşimli öğede `accessibilityRole` ve etiket olur. Dokunma alanı en az 48 dp.
   - Renk tek başına anlam taşımaz. Reduce motion'a uyulur.
   - **Her ses ipucunun görsel ve haptik karşılığı olur** (işitme profili `deaf` / `hard`).
6. **Yeni il veya eser için kod yazılmaz.** Veri eklenir: `cities` satırı, pipeline girdisi, admin paneli.
7. **`impeccable` skill'i ve `.impeccable/` klasörü kullanılmaz** (kullanıcı kararı). Tasarım kuralları [DESIGN.md](DESIGN.md) dosyasında.

## Geliştirme alışkanlıkları

Ekibin ve önceki oturumların çalışma biçimi. Bunlara uyulmazsa süreç bozulur.

**İletişim**
- Kullanıcıya her zaman **Türkçe** yanıt verilir. Kısa, önce yapılacak iş, sonra açıklama.
- Kullanıcı "devam et, sonra test ederim" dediyse soru sormadan ilerlenir; cihazda bakılamayanlar sonunda açıkça listelenir.
- Geri dönüşü zor işlerde (silme, force push, migration) önce sorulur.

**Commit ve push**
- Yazar: `Ediz Keskin <edizkeskin@gmail.com>` (git config'te tanımlı). Yapay zekâ imzası yok (kural 1).
- Mesaj Türkçe, tek satır başlık, işin özü: `Admin: rol sonradan verilince oturum anahtarı yenilenir`. Alan öneki kullanılabilir (`Admin:`, `Mobil:`, `ROADMAP:`).
- Bir iş = bir commit. Typecheck ve test geçmeden commit atılmaz.
- Push öncesi: `git log --format='%an %ae%n%B' origin/main..HEAD | grep -i -E 'co-authored|claude|generated'` boş dönmeli (CLAUDE.md dosya adı hariç). `git status` ile `.env`, `docs/`, `data/raw/` girmediği kontrol edilir.
- Remote: `origin` = `https://github.com/kokkodhackathon/Sezi.git`, dal `main`.

**Test ve doğrulama sırası**
1. Motor değişikliği (`packages/shared`) önce testle: yeni davranış için Vitest testi yazılır. Testler grafiğin o anki şekline bağlanmaz (ör. merdiven testi kendi küçük grafiğini kurar), çünkü pilot grafik yeniden üretilebilir.
2. `pnpm typecheck` ve `pnpm test` (39+ test). Mobil lint: `cd apps/mobile && npx expo lint`.
3. Veritabanı değişikliğinden sonra MCP `get_advisors` (security). SQL/REST ile uçtan uca deneme yapılır, deneme satırları silinir.
4. Ekran değiştiyse telefonda bakılır (`adb exec-out screencap -p > scratchpad/x.png`). Xiaomi, güvenlik ayarı açılmadan `adb input tap` kabul etmiyor; dokunma testini kullanıcı yapar.
5. Admin paneli: `.claude/launch.json` içindeki "admin" ile tarayıcı panelinde açılır; konsol hataları okunur.

**Kodlarken dikkat edilenler**
- Metin önce `messages-app.ts`'e TR + EN; ekranda sabit metin yok.
- Simülasyon ve geliştirici araçları `settings.devSimulation` arkasında; normal kullanıcı görmez.
- Az yazı, önce fotoğraf (DESIGN.md "Çini 2"). Yeni renk değil token; kartlar gölgesiz, yalnız yüzen öğelerde `sweetShadow()`, yüksek kontrastta `outline()`.
- Rota grafiği değişince: `python -I data/build_nav_graph.py` → `assets/pilot/*.json` yeniden üretilir → `pnpm test` (pilot-graph testleri).
- Sabit yönlendirme cümlesi (`shared/guidance.ts` dönüş/uyarı kalıpları, `navigation/texts.ts`) değişince: `cd apps/mobile && npx tsx scripts/gen-voice-bundle.mts` → `assets/voice/tr` ve `voice/bundled.ts` yeniden üretilir (Chirp sesleri uygulamaya gömülü).
- Başlangıç noktası, yer işareti, anlatım ve eser varış bilgisi kod değil veridir: admin panelinde **Noktalar** (`nav_points`). Kodda sabit nokta ya da rota yazılmaz.
- Sunucu yazmaları security-definer RPC ile değil **RLS + trigger** ile yapılır (advisor uyarısı vermemesi için).
- Uygulama sunucudan gelen veriyi kv-store'da önbelleğe alır; internet yokken son bilinen hâlle çalışmalı.
- Git Bash'te kaçış karakterleri (`\n`, `\u…`, kesme işareti) heredoc'ta bozulabiliyor: çok satırlı içerik Write/Edit aracıyla ya da script dosyasıyla yazılır.
- Uzun işler (Gradle build, geocoder, Overpass) arka planda çalıştırılır, çıktı log dosyasından okunur.

## Mobil uygulama kuralları (apps/mobile)

- **Ekranlar:**
  - Ekranlar `src/app/` altında (Expo Router). Yeni stack ekranı `src/app/_layout.tsx` içinde `<Stack.Screen>` olarak kaydedilir.
  - Typed routes, Metro çalışırken `.expo/types/router.d.ts` dosyasına üretilir. Yeni rota için tip hatası alırsanız Metro'yu bir kez başlatın.
- **Metinler:** `src/lib/messages-app.ts` dosyasına **TR ve EN birlikte** eklenir; EN tipi tüm anahtarları zorunlu kılar. Çekirdek anahtarlar `src/lib/i18n.ts` içinde. Kullanım: `const { t: tr, lang } = useT()`.
- **Tema:**
  - Renkler yalnızca `useSweetTheme()` token'larından alınır (kaynak: `packages/shared/src/sweet-theme.ts`, kontrastı `sweet-theme.test.ts` korur). Dolgu üstünde `primary.ink`, zemin üstünde `primaryText`.
  - Eser türü renkleri tür tonundan (`design/sweet/tones.ts`, `toneForType`). Sabit renk kodu yazmayın.
- **Tipografi:** `design/type.ts` (`type.*`, `space`, `radius`). Büyük harf için `upper(text, lang)` kullanın (Türkçe i/İ).
- **UI parçaları:**
  - `components/ui.tsx`: Button, Card, ListRow, Badge, Note, Chip, Segmented, ToggleRow, EmptyState, Field, SectionTitle, Eyebrow. `design/sweet/components.tsx`: SoftPressable, IconBubble, TypeTile, FadeInItem, Skeleton, SweetSheet. Eser kartı `components/photo-card.tsx` (PhotoCard), detay başlığı `components/floating-header.tsx`, rota/durak hattı `components/lynch-line.tsx`.
  - Yeni ekran bunlarla kurulur. Hareket token'ları `design/sweet/motion.ts`, ikonlar `design/icons.tsx` içinde.
- **Harita:**
  - Ekranlar Mapbox'ı doğrudan kullanmaz: harita, rota, nokta ve konum çizimleri `components/map` (`SeziMap`, `RouteLine`, `PointsLayer`…) üzerinden yapılır; kütüphaneye ait kod yalnızca orada.
  - Token: `EXPO_PUBLIC_MAPBOX_TOKEN` (mobil), `VITE_MAPBOX_TOKEN` (admin). Stil Mapbox Standard (düz, dükkân etiketleri kapalı); eklenen katmanlar `slot` ile (rota `middle`, noktalar `top`).
- **Veri:** `src/lib/works.ts` (TanStack Query + `works_view`).
  - `lng/lat` null olabilir: önce `hasLocation(w)` ile kontrol edin.
  - Konum kesinliği (`location_precision`) arayüzde gösterilir.
- **Rota ve rehberlik:**
  - Pilot grafiği `assets/pilot/bursa-hanlar-nav.json` dosyasında, uygulamaya gömülü olduğu için internetsiz çalışır.
  - Planlayıcı (`createPlanner`), sanal yürüyüşçü (`walker`) ve rota takibi adımı (`followRoute`) `packages/shared` içinde; mobil `src/lib/nav.ts` gömülü grafikle kurar, oturum `src/lib/navigation/session.ts`, turlar `src/lib/tours.ts`.
  - Rota ve simülasyon telefonsuz denenebilir: admin → **Rota testi** aynı motoru çalıştırır. Rota davranışı değişince önce orada bakılır.
- **Kullanıcı durumu:** Profil (`lib/profile.tsx`: görme, hareket, işitme, duyular, dil) ve ayarlar (`lib/settings.tsx`) cihazda `expo-sqlite/kv-store` ile tutulur.

## Veritabanı (Supabase Cloud)

- **Proje:** `sezi-eu`, ref `jejsvycpzulpleftkssj` (Frankfurt, free tier).
  - `supabase/.temp/project-ref` silinmiş eski projeyi gösteriyor; CLI komutlarında ref'i açıkça verin.
  - PostGIS ve pgvector `extensions` şemasında; fonksiyonları `extensions.st_*` diye çağırın.
- **Şema değişikliği:**
  1. `supabase/migrations/<YYYYMMDDHHMMSS>_ad.sql` dosyası ekleyin.
  2. Uygulayın: Supabase MCP `apply_migration`, ya da `npx supabase db push`.
  3. Sonra güvenlik uyarılarını kontrol edin (MCP `get_advisors`); hedef 0 uyarı.
  4. Her yeni tabloda RLS açık olur: anonim kullanıcı `verified` okur, admin yazar.
- **Büyük seed:** MCP'ye sığmaz. Şöyle uygulanır:
  ```bash
  npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/seed_inventory.sql
  ```
- **Admin rolü:** JWT'de `app_metadata.role = 'admin'` (README'de SQL'i var).
- **Okuma arayüzü:** `works_view` (security_invoker): il, tür, kaynaklar (`kind`, `volume`, `page`, `section`) ve sergiler tek satırda gelir.

## Veri pipeline'ı (data/)

- Python her zaman izole modda çalışır: `python -I data/<script>.py`. İndirilen dosyalar `data/raw/` altında kalır.
- **PDF:** Windows'ta `pdftotext -enc UTF-8` şart, yoksa Türkçe karakterler bozulur. Bursa PDF'inde "İ" harfi "%" olarak geliyor (`fix_glyphs` bunu düzeltiyor).
- **Nominatim:** saniyede en fazla 1 istek ve `User-Agent` başlığı gerekli. Önbellek `data/raw/geo_cache.json`.
- **Overpass:** `overpass.kumi.systems` aynası daha az yoğun. Ana sunucu `User-Agent` olmadan 406 döndürür.
- **Elle doğrulanmış konumlar** `data/geo_overrides.json` dosyasına OSM kimliğiyle yazılır. Otomatik eşleşmeden önce gelir.
- Akışın tamamı: [data/README.md](data/README.md).

## Windows / Android ortam notları

- **Repo yolu ASCII olmalı** (`C:\Projeler\sezi`); Türkçe karakterli yolda Gradle kırılır.
- **İki cihaz bağlıysa** `ANDROID_SERIAL` verin: emülatör `emulator-5554`, test telefonu Xiaomi `BYWKBEQOZD8XB6NB`.
- **Metro bağlantısı:** `adb reverse tcp:8081 tcp:8081`, sonra uygulamayı şu derin bağlantıyla açın:
  `exp+sezi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`
- **Git Bash'te `adb shell` yolları** bozulur: `MSYS_NO_PATHCONV=1` verin.
- **Emülatör depolaması dolu** (%93). Kurulumdan önce `adb uninstall com.lahmacun.sezi` çalıştırın.
- **Hazır APK'lar:**
  - Dev build (Metro ister): `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
  - Release (bağımsız, telefona normal uygulama gibi kurulur): `.../apk/release/app-release.apk`. Üretimi (~11 dk, yalnız arm64):
    ```bash
    cd apps/mobile/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
    ```
    Debug anahtarıyla imzalı (Play Store için ayrı anahtar gerekir). Dev build ile aynı paket adını taşır, birbirinin yerine kurulur.
- **Native modül eklenirse** (`npx expo install …`) yeniden `expo run:android` gerekir. Eski build'de "Can't find ViewManager" hatası alırsınız.

## Görev alırken

1. [ROADMAP.md](ROADMAP.md) içindeki **Backlog** tablosundan görevi seçin; kabul ölçütleri orada.
2. Bitince görevin durumunu ROADMAP.md'de güncelleyin.
3. Mimariyi değiştirdiyseniz ARCHITECTURE.md'yi de güncelleyin.
