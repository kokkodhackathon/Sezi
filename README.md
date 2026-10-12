# Sezi

Vakıf eserlerine Kevin Lynch'in bilişsel haritalama yaklaşımıyla (landmark / node) yönlendiren, çok duyulu ve erişilebilir keşif asistanı. Takım LAHMACUN, 42 Türkiye x Vakıf Katılım KÖK&KOD Hackathon. Plan: [PLAN.md](PLAN.md).

## Yapı

```
apps/mobile      Expo (SDK 57) + Expo Router
apps/admin       Vite + React admin paneli
packages/shared  zod şemaları, rota motoru (profil ağırlıklı Dijkstra), yönlendirme motoru, geo
supabase/        migrations + seed (Supabase Cloud)
data/            ham veri → model dönüşüm pipeline'ı (Python)
docs/            yarışma dokümanları
```

## Kurulum

Gereken: Node 22, pnpm 10.

```bash
pnpm install
pnpm test        # shared testleri
pnpm typecheck   # tüm paketler
pnpm dev:mobile  # Expo dev server
pnpm dev:admin   # admin paneli (http://localhost:5173)
```

Mobil uygulama native modüller (harita, mekânsal ses) eklendikten sonra Expo Go ile değil development build ile çalışır: `cd apps/mobile && npx expo run:android`.

## Veritabanı (Supabase Cloud, free tier)

1. Supabase CLI ile projeye bağlanın (`<project-ref>` Dashboard → Project Settings'te yazar):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```
2. Migration'ları uygulayın. `sezi-eu` projesinde (ref `jejsvycpzulpleftkssj`, Frankfurt) init ve seed zaten uygulandı. Yalnızca yeni bir projede `--include-seed` kullanın, aksi halde seed kayıtları çift eklenir:
   ```bash
   npx supabase db push
   ```
3. Admin kullanıcısı: Dashboard → SQL Editor'da şunu çalıştırın:
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '<e-posta>';
   ```
   Kullanıcının yeni token alması için çıkış yapıp tekrar girmesi gerekir.

Free tier sınırları ve önlemler:
- **7 gün işlem olmazsa proje duraklar.** `.github/workflows/supabase-keepalive.yml` her gün bir okuma yapar. Repo secrets'a `SUPABASE_URL` ve `SUPABASE_ANON_KEY` eklenmeli.
- **Storage 1 GB, veritabanı 500 MB.** Ses kayıtları AAC/Opus ile 64–96 kbps'e sıkıştırılır, görseller en fazla 1600 px ve WebP olur.
- **Yedekleme yok.** `npx supabase db dump` ile haftalık dump alınır.
- **Demo internetten bağımsız.** Pilot verisi uygulama paketine gömülü olduğu için olası bir kesinti demoyu durdurmaz.

Erişim kuralları (RLS):
- Anonim kullanıcı yalnızca `verified` içeriği okur.
- Yazma işlemlerini yalnızca admin yapar.
- Erişilebilirlik bildirimini yalnızca giriş yapmış kullanıcı gönderir. Admin onaylayınca segment kendiliğinden güncellenir ve rota motoru o segmentten kaçınır.

## Ortam değişkenleri

`.env.example` dosyasını `apps/mobile/.env` ve `apps/admin/.env` olarak kopyalayın.

## Android development build notları

- **Proje yolu ASCII olmalı** (örn. `C:\Projeler\sezi`). Türkçe karakterli yolda Gradle ve autolinking kırılır.
- İlk build: `cd apps/mobile && npx expo run:android` (yaklaşık 9 dk). Sonraki JS değişiklikleri için sadece `npx expo start --dev-client` yeterli.
- Emülatör Metro'ya LAN IP'si üzerinden bağlanamazsa (Windows güvenlik duvarı): `adb reverse tcp:8081 tcp:8081`, ardından uygulamada `http://127.0.0.1:8081` ile bağlanın.
- MapLibre `Marker` bileşeni RN 0.86 Fabric ile çöküyor (SIGSEGV, `MountingCoordinator::pullTransaction`). Noktaları `GeoJSONSource` + `Layer type="circle"` ile çizin.
- Emülatör depolaması dolarsa `expo run:android` APK'yı sessizce kuramaz (`INSTALL_FAILED_INSUFFICIENT_STORAGE`). Önce `adb uninstall com.lahmacun.sezi`, sonra `adb install apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## Gerçek telefonda test

1. Telefonda Geliştirici seçenekleri → USB hata ayıklama açık; USB ile bağla (`adb devices` listede görmeli).
2. `cd apps/mobile && npx expo run:android` (dev build kurulur, Metro başlar).
3. Kulaklık tak. Kontrol listesi:
   - Lab sekmesi: "Sol"/"Sağ" tonu doğru kulaktan geliyor mu, pusula yönü değişiyor mu, titreşimler hissediliyor mu.
   - Bir eser → "Yol tarifi al" → 1× simülasyon: talimatlar okunuyor mu, sağa dönüşte çift / sola tek titreşim, yer işareti tonu doğru yönden mi.
