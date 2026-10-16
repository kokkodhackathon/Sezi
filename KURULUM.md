# Kurulum: Sezi'yi yeni bir bilgisayarda ayağa kaldırmak

Bu belge, projeyi ilk kez kuran takım arkadaşı içindir. Komutlar Windows'ta **Git Bash** için yazıldı; macOS/Linux'ta da aynıdır (yol ve `gradlew.bat` → `./gradlew` farkı dışında).

Yalnızca uygulamayı denemek istiyorsanız kurulum gerekmez: hazır APK'yı telefona kurun (bkz. [Hazır APK](#hazır-apk-kurulum-olmadan-denemek)).

## 1. Gerekenler

| Araç | Sürüm | Ne için | Not |
|---|---|---|---|
| Git | güncel | Repo | Windows'ta Git Bash ile gelir |
| Node.js | 22.x | Tüm JS paketleri | `node -v` → `v22…` |
| pnpm | 10.30.3 | Paket yöneticisi | `corepack enable` sonrası sürüm kendiliğinden gelir |
| Java JDK | 17 | Android build | Android Studio'nun JDK'sı da olur; `JAVA_HOME` tanımlı olmalı |
| Android Studio | güncel | SDK, emülatör, `adb` | SDK Manager'dan aşağıdakileri kurun |
| Android SDK | Platform 36, Build-Tools, Platform-Tools, NDK 27.1.12297006 | Native build | `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk` |
| Python | 3.11+ | Yalnız veri pipeline'ı (`data/`) | Uygulamayı çalıştırmak için gerekmez |
| poppler (`pdftotext`) | güncel | Yalnız envanter PDF'lerini işlemek için | Uygulamayı çalıştırmak için gerekmez |

Ortam değişkenleri (Windows → "Sistem ortam değişkenlerini düzenle"):

```
ANDROID_HOME = C:\Users\<kullanıcı>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Java\jdk-17   (ya da Android Studio\jbr)
PATH        += %ANDROID_HOME%\platform-tools ; %ANDROID_HOME%\emulator
```

Kontrol:

```bash
node -v && pnpm -v && java -version && adb version
```

## 2. Repoyu alın

> **Önemli:** Proje yolu yalnızca ASCII karakter içermeli ve kısa olmalı. `C:\Projeler\sezi` gibi bir yer seçin. `Masaüstü`, `Belgeler\Çalışma` gibi Türkçe karakterli yollarda Gradle kırılır.

```bash
mkdir -p /c/Projeler && cd /c/Projeler
git clone https://github.com/kokkodhackathon/Sezi.git sezi
cd sezi
corepack enable
pnpm install
```

## 3. Ortam dosyaları (.env)

Anahtarlar repoda yok (gitignore). Supabase anahtarlarını takımdan (Ediz) özel mesajla isteyin ya da Supabase Dashboard → Project Settings → API'den alın. Proje: **sezi-eu**, ref `jejsvycpzulpleftkssj`.

```bash
cp .env.example apps/mobile/.env
cp .env.example apps/admin/.env
```

Doldurulacak alanlar:

| Dosya | Değişken | Değer |
|---|---|---|
| `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL` | `https://jejsvycpzulpleftkssj.supabase.co` |
| | `EXPO_PUBLIC_SUPABASE_KEY` | Publishable key (`sb_publishable_…`) |
| | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Eski anon key (publishable yoksa) |
| `apps/admin/.env` | `VITE_SUPABASE_URL` | Aynı URL |
| | `VITE_SUPABASE_ANON_KEY` | Publishable ya da anon key |
| her ikisi | `EXPO_PUBLIC_MAPBOX_TOKEN` (mobil), `VITE_MAPBOX_TOKEN` (admin) | Mapbox public token (`pk.…`), account.mapbox.com → Tokens. Ücretsiz plan: mobilde ayda 25.000 aktif kullanıcı, webde 50.000 harita açılışı |

Mapbox token'ı için: yayına çıkarken mobil ve admin için **ayrı** token kullanın. URL kısıtı yalnızca web isteklerinde işe yarar; mobil token'a URL kısıtı eklemeyin (mobil haritada 403 verir). Android derlemesi için gizli indirme token'ı (`sk.…`) gerekmez.
`service_role` anahtarı ve veritabanı parolası **hiçbir .env'e konmaz, hiçbir yere commit'lenmez**.

Kontrol:

```bash
pnpm test        # 62+ test geçmeli
pnpm typecheck   # üç paket de "Done"
```

## 4. Admin paneli

```bash
pnpm dev:admin
```

Tarayıcıda **http://localhost:3000** açılır.

- Giriş e-postaya gelen bağlantıyla (magic link) yapılır; bağlantıyı aynı tarayıcıda açın.
- Yazma yetkisi için hesabınızın admin olması gerekir. Mevcut bir admin, Supabase Dashboard → SQL Editor'da şunu çalıştırır:
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
  where email = '<sizin e-postanız>';
  ```
  Sonra panelde çıkış yapıp yeniden girin.
- Sayfalar: Eserler, Yeni eser, Fotoğraf kutusu, **Noktalar** (başlangıç, yer işareti, anlatım, eser varışı), Bildirimler, İller.

## 5. Mobil uygulama (geliştirme)

Uygulama native modüller kullanır (harita, ses, konum); **Expo Go ile açılmaz**, development build gerekir.

### İlk kez (ya da yeni native paket eklendiğinde)

1. Telefonu USB ile bağlayın ya da Android Studio → Device Manager'dan bir emülatör açın.
   - Telefon: Geliştirici seçenekleri → USB hata ayıklama açık. Xiaomi'de ayrıca "USB üzerinden yükle".
   - `adb devices` cihazı göstermeli.
2. Build alın ve kurun (ilk seferde ~10 dk):
   ```bash
   cd apps/mobile
   npx expo run:android
   ```
   `android/` klasörü repoda yok; bu komut onu `app.json`'dan üretir (`expo prebuild`).

### Günlük çalışma

Uygulama cihazda kuruluysa yalnız Metro'yu başlatmak yeterli:

```bash
cd apps/mobile
npx expo start --dev-client
```

Cihaz Metro'ya bağlanamazsa (Windows güvenlik duvarı):

```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp+sezi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

İki cihaz bağlıysa komutlardan önce `export ANDROID_SERIAL=<adb devices'taki kimlik>` verin.

## 6. Bağımsız APK üretmek (Metro gerektirmez)

Takıma ya da jüriye dağıtılacak sürüm. JS paketi APK'nın içine gömülür.

```bash
cd apps/mobile
npx expo prebuild -p android        # android/ klasörü yoksa bir kez
cd android
./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a   # macOS/Linux: ./gradlew
```

- Süre ~10–15 dk. Çıktı: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- `arm64-v8a` gerçek telefonlar içindir. Emülatörde (x86_64) denemek için `-PreactNativeArchitectures=x86_64` ile ayrı build alın.
- APK debug anahtarıyla imzalıdır: telefona doğrudan kurulur, Play Store'a yüklenemez.
- Dev build ile aynı paket adını (`com.lahmacun.sezi`) taşır; biri diğerinin yerine kurulur.

### Hazır APK: kurulum olmadan denemek

1. `app-release.apk` dosyasını telefona gönderin (WhatsApp, Drive, USB).
2. Dosyaya dokunun; "Bilinmeyen kaynaklardan yükleme" izni isterse verin.
3. Uygulama açılınca profil sorularını yanıtlayın. Konum izni Yürüyüş ekranında istenir.

## 7. Veritabanı (yalnız şema değiştirecekler için)

Herkes aynı bulut veritabanını (Supabase, Frankfurt) kullanır; yerel veritabanı kurmanız gerekmez.

```bash
npx supabase login
# Yeni migration: supabase/migrations/<YYYYMMDDHHMMSS>_ad.sql
npx supabase@latest db query --linked --project-ref jejsvycpzulpleftkssj -f supabase/migrations/<dosya>.sql
npx supabase@latest db advisors --linked --project-ref jejsvycpzulpleftkssj --type security
```

`supabase/.temp/project-ref` eski bir projeyi gösteriyor; komutlarda `--project-ref` her zaman açıkça verilmeli. Ayrıntı: [AGENTS.md](AGENTS.md#veritabanı-supabase-cloud).

## 8. Sık karşılaşılan sorunlar

| Belirti | Çözüm |
|---|---|
| Gradle "path contains non-ASCII" ya da autolinking hatası | Repoyu `C:\Projeler\sezi` gibi ASCII bir yola taşıyın |
| `SDK location not found` | `ANDROID_HOME` tanımlayın ya da `apps/mobile/android/local.properties` içine `sdk.dir=C\:\\Users\\<kullanıcı>\\AppData\\Local\\Android\\Sdk` yazın |
| `Can't find ViewManager` / native modül bulunamadı | Yeni native paket eklenmiş: `npx expo run:android` ile yeniden build alın |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` / "not enough space" | `adb uninstall com.lahmacun.sezi`; emülatörde Device Manager → Wipe Data ya da daha büyük depolamalı AVD |
| Uygulama beyaz ekranda kalıyor | Metro çalışıyor mu? `adb reverse tcp:8081 tcp:8081` sonra uygulamayı yeniden açın |
| "EXPO_PUBLIC_SUPABASE_URL ve … tanımlı olmalı" hatası | `apps/mobile/.env` eksik ya da boş (bkz. adım 3) |
| Admin panelinde kaydet "yetki yok" hatası | Hesabınız admin değil ya da rol sonradan verildi: çıkış yapıp yeniden girin |
| Git Bash'te `adb shell` yolları bozuluyor | Komuttan önce `MSYS_NO_PATHCONV=1` verin |
| Xiaomi'de `adb install` reddediliyor | Geliştirici seçenekleri → "USB üzerinden yükle" ve "USB hata ayıklama (Güvenlik ayarları)" açık olmalı |
