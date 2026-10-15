# HANDOFF — oturum devri

Son güncelleme: 15 Ekim 2026 (Ediz + Claude oturumu). Yeni oturum önce [AGENTS.md](AGENTS.md)'yi, sonra bu dosyayı okur.

## Şu an neredeyiz

- **Dal:** `main`, temiz. GitHub: `https://github.com/kokkodhackathon/Sezi` (remote `origin`). Son commit `2150913`.
- **Testler:** `pnpm test` → 6 dosya, 39 test geçiyor. `pnpm typecheck` temiz.
- **Release APK hazır** ama telefona **kurulmadı** (telefon bağlı değildi):
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (arm64-v8a, ~72 MB, debug anahtarıyla imzalı, JS gömülü, Metro gerektirmez).
  ```bash
  adb -s BYWKBEQOZD8XB6NB install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
  ```
  Aynı paket adı ve imza: telefondaki dev build'in yerine geçer. Metro ile geliştirmeye dönülecekse dev build yeniden kurulur.
- **Cihazda denenmemiş özellikler:** simülasyon başlangıç seçimi, Lynch noktaları, admin bağlantısı (bildirim → onay → rota), pull-to-refresh. İlk iş bunları telefonda gezmek.

## Bu oturumda ne yapıldı (14–15 Ekim)

1. **Belgeler:** AGENTS / CLAUDE / ARCHITECTURE / ROADMAP / DESIGN yazıldı; PLAN.md kaldırıldı. `.impeccable/` silindi ve yasaklandı.
2. **Simülasyon motoru** (`packages/shared`): `tracking` (fix → rotaya izdüşüm, sapma, talimat zamanlaması), `scenarios` (yol kapandı, yanlış dönüş, yeniden rota), `soundscape`, zengin Lynch dili (`guidance`: merdiven/arnavut kaldırımı/trafik uyarısı, "X yakınında", 90 m'de teyit).
   Mobilde: konuşma kuyruğu, tek nav oturumu (`lib/sim/session.ts`), jüri paneli, ses altyazısı, profil karşılaştırması.
3. **Çini tasarım dili:** açık tema birincil, önce fotoğraf, az yazı. Simülasyon ve profil karşılaştırması **Ayarlar → Geliştirici seçenekleri** arkasında.
4. **Bursa fotoğraf arşivi:** kitap sayfalarıyla dHash eşleme (`data/inventory_photos.py`), Storage `media/bursa/…`, 51 fotoğraf / 47 eser. Eşleşmeyenler admin'deki "Fotoğraf kutusu"nda. Başka il için aynı script, klasör adı = il.
5. **Admin paneli** (`apps/admin`, `pnpm dev:admin` → http://localhost:3000): giriş (sihirli bağlantı + parola), eser listesi/düzenleme/yeni eser, haritada konum, fotoğraf kutusu, bildirim moderasyonu, iller.
6. **Uygulama ↔ admin:** bildirimler hesapsız `a11y_reports`'a gider (cihaz başına saatte 10), onay → `segment_overrides` → uygulama rotası (çevrimdışı son bilinen hâl, `useServerSync`).
7. **Lynch noktaları:** `data/lynch/bursa-hanlar.json` — 12 nokta (buluşma + yer işareti, salience 1–3). Grafik 650 m yarıçapla yeniden üretildi: 897 düğüm, 1220 segment, 28 landmark, 8 başlangıç. Simülasyonda başlangıç seçilebiliyor (`settings.simStart`).
8. **Release APK** ve GitHub push.

## Bilinen sorunlar

- **Rotalar fazla dönüşlü** (ör. Zafer Plaza'dan ilk 270 m'de 7 dönüş). Dijkstra yalnız mesafe/profil ağırlığına bakıyor; "düz harita" hissi buradan.
- Lynch noktaları ekip bilgisine dayanıyor, hepsi `verified: false` — Zehra sahada doğrulayacak.
- Çevrimdışı önbellek yok (ROADMAP #4, P0): uçak modunda Keşfet boş açılır; rota/rehberlik gömülü grafikle çalışır.
- Yeniden tasarlanmamış ekranlar: Sor, Profil, Ayarlar, Hakkında, Onboarding (eski stil, çalışıyor).
- Supabase advisor'da tek uyarı: `auth_leaked_password_protection` (dashboard ayarı, ücretli özellik; kabul edildi).

## Sıradaki adımlar (öneri sırası)

1. **APK'yı kur, telefonda gez** (~20 dk): Keşfet → eser → Turlar → rota → simülasyon (farklı başlangıç noktaları) → bildirim gönder → admin'de onayla → rota değişti mi.
2. **Okunabilir rota katmanı** (~1 gün) — konuşulan ama başlanmayan iş:
   - Dönüş cezası (açı > 30° olan her geçişe sabit maliyet) → daha az dönüşlü rota.
   - Karar noktaları: yalnızca gerçek seçim olan kavşakta talimat; düz devam edilen ara düğümler susar.
   - Path / district / edge dili: "Atatürk Caddesi boyunca", "Kapalıçarşı'ya girin", "çarşının kuzey kenarından".
   - Sonra "Menzilname" şerit görünümü ve rota provası (yola çıkmadan önce sırayla yer işaretleri).
3. **Çevrimdışı önbellek** (ROADMAP #4, ~yarım gün): TanStack Query persist + expo-sqlite.
4. **Gerçek GPS modu** (ROADMAP #10): `walker` yerine `expo-location` kaynağı; takip kodu ortak.
5. **CI** (ROADMAP #13, ~1 saat): typecheck + test her push'ta.
6. Kalan ekranların Çini tasarımına geçirilmesi.

Ekip işleri ROADMAP'te: Zehra (Lynch noktalarını sahada doğrulama, fotoğraf kutusu, konum iğneleri), İnci (ikon, splash), Eda (TalkBack denetimi).

## Erişim ve hesaplar

- Supabase `sezi-eu` (`jejsvycpzulpleftkssj`). Admin: `edizkeskin@gmail.com`, rol `app_metadata.role = 'admin'`. Parolayı kullanıcı kendisi SQL ile belirler; ajan parola girmez.
- `.env` dosyaları (mobil ve admin) yerelde, commit'lenmez. Örnek: kökte `.env.example`; admin için `apps/admin/.env` içine aynı değerler `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` adıyla yazılır.
- Foto pipeline'ı için Python venv: pillow + pymupdf gerekir (`python -m venv`, `pip install pillow pymupdf`).
