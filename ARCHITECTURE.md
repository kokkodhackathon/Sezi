# Mimari

Durum: 13 Ekim 2026. Bu belge **bugün çalışan** sistemi anlatır. Hedefler ve yapılacaklar [ROADMAP.md](ROADMAP.md) dosyasında.

## Bileşenler

```
┌──────────────── apps/mobile (Expo SDK 57, RN 0.86 Fabric, Android dev build) ───────────────┐
│ Expo Router ekranları ─ TanStack Query ─ supabase-js (anon) ──────────────► Supabase Cloud │
│        │                                                                    (Postgres+RLS,  │
│        ├─ lib/nav.ts ─ assets/pilot/bursa-hanlar-nav.json (gömülü, internetsiz)  PostGIS,   │
│        │        └─ @sezi/shared: findRoute · buildGuidance · routeGeometry       pgvector)  │
│        └─ lib/simulation.ts ─ expo-speech · expo-haptics · react-native-audio-api  ▲        │
└────────────────────────────────────────────────────────────────────────────────────│────────┘
apps/admin (Vite + React; henüz iskelet) ───────────────────── authenticated + admin ┘
data/ (Python) ─ PDF/Wikidata/Nominatim/OSM ─► supabase/seed_*.sql, assets/pilot/*-nav.json
```

| Paket | Görev | Durum |
|---|---|---|
| `apps/mobile` | Kullanıcı uygulaması | Tüm final ekranları var, bir kısmı mock (aşağıda) |
| `apps/admin` | İçerik girişi, onay, moderasyon | Vite şablonu; yazılmadı |
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
- Bağlı tablolar: `complexes`, `work_events` (zaman çizelgesi), `inscriptions` (kitabeler), `media`, `glossary_terms`

**Kaynak**
- `sources`: `kind` = inventory / wikidata / osm / …, `city_id`, `volume`
- `work_sources`: `page`, `section`
- `exhibitions` ve `work_exhibitions`: envanter fotoğraf sergileri

**Navigasyon**
- `nav_nodes`, `nav_segments`, `instructions`, `audio_assets`
- Şu an kullanılmıyor: uygulama gömülü JSON grafiği okuyor (aşağıda).

**Topluluk ve yapay zekâ**
- `a11y_reports`: pending → approved / rejected
- `doc_chunks`: RAG için embedding'ler; henüz boş.

**Okuma arayüzü**
- `works_view` (security_invoker): eser, il, tür, külliye, `lng/lat`, kaynaklar ve sergiler tek satırda.
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
   - Çıktı: `nodes` (landmark'larda `workSlug`) ve `segments` (uzunluk, basamak, eğim, zemin, gürültü, landmark görünürlüğü).
   - Bursa Hanlar: 507 düğüm, 669 segment, 17 landmark.
2. **Maliyet** (`shared/routing.ts › segmentCost`)
   - Profile göre değişir: tekerlekli sandalye basamağı hiç kullanmaz; görme kısıtlı kullanıcı gürültü ve kaldırımdan kaçınır.
   - Landmark görünürlüğü maliyeti düşürür.
   - Arama algoritması Dijkstra (`findRoute`).
3. **Yönlendirme** (`shared/guidance.ts › buildGuidance`)
   - Dönüş açısı ve en yakın landmark'tan Lynch tarzı talimat üretir.
   - İpucu türü profile göre seçilir (`cuePreference`): duymayan kullanıcıya sesli ipucu verilmez.
4. **Simülasyon** (`mobile/lib/simulation.ts`)
   - Sanal yürüyüşçü rota geometrisinde ilerler. Adım noktalarında TTS, haptik desen ve stereo panlanmış ton çalınır.
   - Duymayan kullanıcıda bunların yerine `CueFlash`: ekran kenarı parlaması ve titreşim.
5. **Başlangıç noktası:** T1 Ulucami tramvay durağı (`nav.ts › DEFAULT_START`). Gerçek GPS modu henüz yok.

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
| `route/[slug]` | Rota özeti, profil açıklaması, simülasyon | gömülü grafik |
| `guide/[slug]` | Tam ekran canlı rehberlik (koyu tema) | gömülü grafik |
| `exhibitions` | Envanter fotoğraf sergileri | `exhibitions` |
| `search` | Ad, tür, ilçe ve il araması | `works_view` |
| `report/new`, `reports` | Erişilebilirlik bildirimi: **cihazda kuyruk**, sunucuya gönderim yok | cihaz |
| `sign-in` | Magic link (Supabase OTP); oturum kalıcı değil | Supabase Auth |
| `complex/[slug]` | Külliye ekranı; Bursa verisinde külliye bağlantısı henüz yok | `works_view` |
| `settings`, `about`, `lab` | Ayarlar, proje ve envanter bilgisi, cihaz testleri (ses, pusula, haptik) | – |

**Mock ya da eksik kalanlar**
- Ask'te LLM yok.
- Bildirimler sunucuya gitmiyor.
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
| Kendi i18n katmanı (i18next değil) | Tipli anahtarlar; eksik EN çevirisi derleme hatası verir |
