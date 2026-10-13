# Sezi mobil (Expo)

Expo SDK 57, React Native 0.86 (New Architecture / Fabric), Expo Router. Android development build ile çalışır; Expo Go yetmez, çünkü native modüller var: MapLibre, react-native-audio-api, react-native-svg.

Kurallar ve tuzaklar: [AGENTS.md](../../AGENTS.md). Ekran listesi ve veri akışı: [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Çalıştırma

```bash
cp ../../.env.example .env          # EXPO_PUBLIC_SUPABASE_URL / _KEY (gerçek değerler: Supabase → Settings → API)
npx expo run:android                # ilk kurulum veya native modül değişikliği (~9 dk)
npx expo start --dev-client         # sonraki JS değişiklikleri
npx tsc --noEmit                    # typecheck
```

Emülatör ya da telefon Metro'ya bağlanamazsa:

```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp+sezi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

## Klasörler

```
src/app/          ekranlar (Expo Router); stack kayıtları _layout.tsx'te
src/components/   ui.tsx (temel bileşenler), deferred-map, cue-flash, exhibition-card…
src/design/       type.ts (tipografi, upper()), motif.tsx, icons.tsx, work-glyph.tsx
src/lib/          works (veri), nav/tours/simulation (rota), profile/settings (cihaz durumu), i18n + messages-app (TR/EN)
assets/pilot/     gömülü navigasyon grafiği (data/build_nav_graph.py üretir)
```

## Gerçek telefonda test listesi

Kulaklık takılı olsun.

1. **Lab:** "Sol" ve "Sağ" tonu doğru kulaktan geliyor; pusula yönü değişiyor; titreşimler hissediliyor.
2. **Turlar → "Ulu Cami ve Hanlar Bölgesi" → ilk durağa yol tarifi → simülasyon:**
   - Talimatlar okunuyor.
   - Sağa dönüşte çift, sola dönüşte tek titreşim.
   - Yer işareti tonu doğru yönden geliyor.
3. **Profil → düzenle → işitme "Duymuyorum":** Simülasyonda ses yok; ekran kenarı parlıyor ve titreşim var. Eser detayında anlatım metni görünüyor.
4. **Keşfet:** İl değiştirince harita ve liste değişiyor. Konumsuz eserde "Konum doğrulanıyor" etiketi var.
