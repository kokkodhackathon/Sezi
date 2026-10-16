# Sezi

Vakıf eserlerine Kevin Lynch'in bilişsel haritalama yaklaşımıyla (landmark / node / path / district) yön tarif eden, çok duyulu ve erişilebilir keşif uygulaması. Kapsam: Hatay, Konya ve Bursa'daki vakıf eserleri envanteri. Pilot alan: Bursa Ulu Cami ve Hanlar Bölgesi. Takım LAHMACUN, 42 Türkiye x Vakıf Katılım KÖK&KOD Hackathon.

## Belgeler

| Dosya | İçerik |
|---|---|
| [AGENTS.md](AGENTS.md) | Geliştirici ve yapay zekâ ajanları için kurallar, komutlar, tuzaklar. **Önce bunu okuyun** |
| [KURULUM.md](KURULUM.md) | Yeni bilgisayarda adım adım kurulum: gerekenler, .env, admin, mobil build, APK, sık sorunlar |
| [ROADMAP.md](ROADMAP.md) | Kilometre taşları, sahipli backlog, kabul ölçütleri, açık kararlar |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Bileşenler, veri modeli, rota motoru, ekranlar, kararlar |
| [PRODUCT.md](PRODUCT.md) | Kullanıcılar, ilkeler, marka |
| [DESIGN.md](DESIGN.md) | Uygulanmış mobil tasarım dili, tema rolleri, tipografi ve ortak bileşenler |
| [ENVANTER.md](ENVANTER.md) | Vakıf Katılım bilgi notu, envanter kitapları, veri politikası (telif) |
| [data/README.md](data/README.md) | Veri pipeline'ı ve nav grafiği üretimi |

## Yapı

```
apps/mobile      Expo (SDK 57) + Expo Router: kullanıcı uygulaması
apps/admin       Vite + React admin paneli (henüz şablon)
packages/shared  zod şemaları, rota motoru (profil ağırlıklı Dijkstra), Lynch yönlendirme motoru, geo, tema
supabase/        migrations + seed (Supabase Cloud, sezi-eu)
data/            ham veri → model dönüşüm pipeline'ı (Python)
docs/            yarışma belgeleri ve moodboard (yalnızca yerel, git'e girmez)
```

## Kurulum

Gereken: Node 22, pnpm 10. Adım adım anlatım: [KURULUM.md](KURULUM.md).

```bash
pnpm install
pnpm test        # shared testleri
pnpm typecheck   # tüm paketler
pnpm dev:mobile  # Expo dev server
pnpm dev:admin   # admin paneli (http://localhost:3000)
```

Mobil uygulama native modüller (harita, mekânsal ses) eklendikten sonra Expo Go ile değil development build ile çalışır: `cd apps/mobile && npx expo run:android`.

## Veritabanı (Supabase Cloud, free tier)

1. Supabase CLI ile projeye bağlanın (`<project-ref>` Dashboard → Project Settings'te yazar):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```
2. Migration'ları uygulayın. `sezi-eu` projesinde (ref `jejsvycpzulpleftkssj`, Frankfurt) tüm migration'lar ve envanter seed'i uygulandı. Yeni bir projede envanter verisi için `supabase/seed_inventory.sql` dosyasını ayrıca çalıştırın (bkz. data/README.md):
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
- **Demo internetten bağımsız olmalı.** Pilot navigasyon grafiği uygulamaya gömülü. Eser listesinin çevrimdışı önbelleği henüz yok (ROADMAP #4).

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

1. Telefonda Geliştirici seçenekleri → USB hata ayıklama açık olsun; Xiaomi'de "USB üzerinden yükle" de açılmalı.
2. Telefonu USB ile bağlayın; `adb devices` listede göstermeli.
3. `cd apps/mobile && npx expo run:android` çalıştırın.
4. Kontrol listesi: [apps/mobile/README.md](apps/mobile/README.md#gerçek-telefonda-test-listesi).
