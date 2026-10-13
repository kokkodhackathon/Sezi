# SEZİ — LAHMACUN / KÖK&KOD Hackathon Planı

## Context
- **Yarışma:** 42 Türkiye x Vakıf Katılım KÖK&KOD. Online geliştirme 8 Ekim – 7 Kasım 2026, yüz yüze final 7–8 Kasım (Bilişim Vadisi İstanbul GO). Bugün 12 Ekim, kalan süre ~26 gün.
- **Takım LAHMACUN:** Zehra (veri analitiği), İnci (tasarım), Ediz (backend), Eda (frontend).
- **Ürün: Sezi.** Vakıf eserlerine Kevin Lynch'in bilişsel haritalama yaklaşımıyla (landmark / node / path / edge / district) yönlendiren, çok duyulu ve erişilebilir bir keşif asistanı. Yönlendirmeler "100 m sonra sağa dön" yerine şöyle: "Sebilin su sesini duyunca meydanın sağına yönelin." Sesler mekânsal (stereo), yanında haptik titreşim ve sesli betimleme var.
- **Hedef kullanıcı:** Herkes. Erişilebilirlik ürünün çekirdeğinde: kullanıcı görme ve hareket profilini seçer, rota ve rehberlik buna göre şekillenir.
- **İller (bilgi notu, 13 Ekim):** Hatay, Konya ve Bursa. Kaynak: Vakıf Katılım'ın vakıf eserleri envanter kitapları (Hatay 2022, Konya 2024, Bursa 2025). Mimari yeni illere açık; `cities` tablosuna satır eklemek yeter. Ayrıntı: `ENVANTER.md`.
- **Pilot alan:** Bursa, Ulu Cami ve Hanlar Bölgesi. Ulu Cami, Koza Han, Emir Han, Bedesten ve çevresi sesli rehberlikle derin modellenir. Üç ilin envanter kayıtları keşif katmanında yer alır.

## Şartnamenin zorunlu tuttukları (jüri kontrol listesi)
1. Çalışan mobil MVP ve uçtan uca canlı demo. Mockup kabul edilmiyor.
2. Birden çok eseri keşfetme. Her eserde tarihî bilgi, görsel ve **kaynak** gösterilmeli.
3. **İçerik ekleme ve düzenleme** imkânı olmalı. Mimari yeni eser, şehir ve içerik tipi eklemeye açık olmalı.
4. Ham veri seti ekip tarafından kendi veri modeline dönüştürülmeli. **Doğrulanmamış içerik gerçek bilgi gibi gösterilemez.**
5. Topluluk katkısı varsa moderasyon zorunlu.
6. Erişilebilirlik ürünün içinde çalışmalı. Ekran okuyucu, alt metin, kontrast, büyük yazı ve sesli anlatım beklentiler arasında.
7. Girdi doğrulama yapılmalı, ana akışlar test edilmeli. Kod modüler olmalı, README'de kurulum anlatılmalı.

## Kararlar
| Konu | Karar |
|---|---|
| Mobil | Expo (React Native) + TypeScript, Expo Router, development build |
| Backend | **Supabase Cloud (free tier)**: Postgres + PostGIS + pgvector, Auth, Storage, RLS, Edge Functions |
| Admin | Kendi web panelimiz: Vite + React + TS + shadcn/ui + MapLibre GL JS. Coolify'da (statik) barınacak |
| Demo | Simülasyon modu (sanal yürüyüş). Uygulama internetsiz çalışır. Sahada çekilmiş video yedek olarak hazır |
| Yapay zekâ | (1) Ham veriyi yapılandırma (2) Kaynaklı RAG asistanı. **LLM sağlayıcısı sonra seçilecek.** Kod, sağlayıcıdan bağımsız bir `LLMProvider` arayüzü üzerinden yazılacak |
| Ses ipuçları | Sahada gerçek ses kaydı. Pusula yönüne göre stereo/3D panlama |
| Topluluk | Erişilebilirlik bildirimi ("burada merdiven var", "rampa kapalı"). Admin onayından sonra rota ağırlıkları güncellenir |
| Dil | Türkçe ve İngilizce. i18next kullanılacak, içerik alanları `{tr, en}` jsonb olarak tutulacak |
| Giriş | Kullanıcı anonim girer, profili cihazda saklanır. Bildirim göndermek için magic link ile isteğe bağlı hesap açılır. Admin rolü ayrı |
| Tasarım | Turkuaz, kırmızı ve kahve tonları. Modern ve göz yormayan, düşük opaklıkta geometrik Türk motifleri. WCAG AA, karanlık mod, yüksek kontrast modu, dinamik yazı boyutu |

## Özellikler (MVP)
1. **Algısal profil (onboarding):** Görme (tam / az gören / görme engelli), hareket (yok / baston / tekerlekli sandalye), duyu tercihi (ses / haptik / görsel yoğunluk), dil. Ekran okuyucuyla baştan sona kullanılabilir olacak.
2. **Keşfet:** Harita ve liste görünümü. Bölge, şehir, tür ve külliye filtresi.
3. **Eser detayı:** Tarihçe, alt metinli görseller, kaynak listesi, TTS ile sesli anlatım, erişilebilirlik skoru ve "külliyenin parçaları" ilişki ağı.
4. **Pilot alan rotası:** Pilot Lynch grafiğinde profile göre ağırlıklandırılmış Dijkstra. Hesaba katılanlar: basamak, eğim, zemin, genişlik, gürültü, landmark görünürlüğü. Algoritma `packages/shared` içinde, bu sayede internetsiz de çalışıyor.
5. **Canlı algısal rehberlik:** Konum (GPS ya da simülasyon) en yakın kenara eşlenir ve sıradaki node'un talimatı tetiklenir.
   - Landmark sesi kulaklıkta yönüne göre panlanır (pusula ile).
   - Haptik desenler: sol, sağ, varış ve dikkat için ayrı.
   - Talimat TTS ile okunur.
   - Talimat metinleri node başına elle yazılır ve admin onayından geçer.
6. **Simülasyon modu:** Rota üzerinde sanal yürüyüşçü ve hız ayarı. Sesler, titreşimler ve talimatlar gerçek zamanlı tetiklenir. Jüri için kontrol paneli olacak.
7. **"Sezi'ye Sor" (RAG):** Yalnızca doğrulanmış kaynaklardan cevap verir ve alıntı gösterir. Kaynakta yoksa "bilmiyorum" der.
8. **Erişilebilirlik bildirimi:** Yeni bildirim `pending` durumunda başlar. Admin onaylarsa `approved` olur ve segment ağırlığı güncellenir.
9. **Admin paneli:**
   - Eser, medya ve kaynak CRUD işlemleri.
   - İçerik durumu (`draft` / `verified`). Yalnızca `verified` içerik gerçek bilgi olarak yayınlanır.
   - Harita üzerinde node, landmark ve segment düzenleme.
   - Ses yükleme, talimat metni düzenleme, bildirim moderasyonu.

## Veri modeli (Postgres)
- `regions`, `cities`, `work_types`
- `complexes` (külliye)
- `works`: geom, `name{tr,en}`, `summary{tr,en}`, `history{tr,en}`, `status`, `complex_id`, `a11y_score`
- `sources`, `work_sources`; `media` (url, `alt_text{tr,en}`, credit)
- `nav_nodes`: geom, `lynch_type` (landmark / node / district_gate), `visibility_deg`, `sound_asset_id`, `work_id?`
- `nav_segments`: from, to, geom, length, steps, slope, surface, width_cm, kerb, noise, `a11y_flags`
- `instructions`: node_id, approach_from, `text{tr,en}`, cue_type, status
- `audio_assets`, `a11y_reports` (segment_id, type, note, photo, status, user_id)
- `doc_chunks` (`embedding vector`, source_id, work_id): RAG için
- RLS kuralları: anonim kullanıcı yalnızca `verified` içeriği okur. Bildirimi yalnızca hesabı olan kullanıcı yazar. Yazma işlemlerinin hepsi admin'e açık.

## Repo yapısı (pnpm monorepo)
```
apps/mobile      Expo uygulaması
apps/admin       Vite + React admin paneli
packages/shared  tipler, zod şemaları, rota motoru, talimat motoru
supabase/        migrations, seed, edge functions (rag-ask)
data/            Python pipeline (ham veri → JSON → doğrulama → seed)
docs/            yarışma dokümanları
```

## Teknoloji ayrıntıları
- **Mobil:**
  - Harita: `@maplibre/maplibre-react-native` (OSM tile'ları; pilot alan için offline paket)
  - Mekânsal ses: `react-native-audio-api` (StereoPanner)
  - Konum ve pusula: `expo-location` (konum + heading)
  - Haptik ve TTS: `expo-haptics`, `expo-speech`
  - Durum ve veri: TanStack Query, Zustand, `expo-sqlite` (offline önbellek), i18next
- **Veri pipeline:** Python, pydantic ve pytest. LLM ile çıkarılan alanlar her zaman `draft` olarak girer.
- **Testler:**
  - Rota ve talimat motoru: Vitest
  - Admin akışları: Playwright
  - Mobil ana akış: Maestro
  - Pipeline: pytest
  - CI: GitHub Actions
- **Free tier riskini azaltmak için:**
  - Proje 7 gün işlem görmezse duraklıyor. Bunu GitHub Actions ile günlük keep-alive okuması önler.
  - Storage 1 GB, DB 500 MB. Ses dosyaları Opus/AAC ile, görseller WebP olarak sıkıştırılır.
  - Otomatik yedek yok. Haftalık `supabase db dump` alınır.
  - Demo internetsiz çalışan pakete dayanır. Gerekirse finalden önce 1 aylık Pro'ya geçmek tek tıkla mümkün.

## Zaman çizelgesi ve roller
| Hafta | Ediz (backend) | Eda (frontend) | İnci (tasarım) | Zehra (veri) |
|---|---|---|---|---|
| 1 (12–18 Ekim) | Supabase projesi + `db push`, RLS, monorepo | Expo iskeleti, navigasyon, i18n, tema token'ları | Marka (Sezi), renk ve motif sistemi, ana ekranlar | Bursa Hanlar Bölgesi saha gezisi #1 (node ve landmark çıkarma, ses kaydı). Geçici veri (Wikidata/OSM) |
| 2 (19–25 Ekim) | Admin API'leri, storage, rota motoru (shared) | Keşfet, eser detayı, onboarding | Rehberlik ekranı, admin UI, erişilebilirlik modları | Lynch grafiği verisi, segment ölçümleri, pipeline v1 |
| 3 (26 Ekim – 1 Kasım) | RAG edge function, bildirim ve moderasyon, yedekleme | Canlı rehberlik (ses, haptik, TTS), simülasyon modu | Admin paneli (Eda ile), motif detayları | Gerçek veri setini yükleme ve doğrulama, talimat metinleri (TR/EN) |
| 4 (2–6 Kasım) | **Freeze**, testler, offline paket | VoiceOver ve TalkBack ile denetim, hata düzeltme | Sunum ve demo videosu | Demo senaryosu, sahada video çekimi |

Veri seti geç gelirse bloke olmayız. Şema hazır olur, sadece pipeline'ın girdisi değişir.

## Doğrulama
1. `pnpm test` → rota motoru profil ağırlıklarına göre doğru yolu seçiyor. Örnek: tekerlekli sandalye profili basamaklı segmentten geçmiyor.
2. Uçtan uca test: admin panelden eser ekle → `verified` yap → mobilde görün → kaynak listesi açılsın.
3. Simülasyon: Bursa Hanlar Bölgesi rotasında, uçak modu açıkken, talimatlar, ses panlaması ve haptik doğru node'larda tetiklensin.
4. RAG: kaynakta olmayan bir soruya "bilmiyorum" desin. Kaynakta olan soruya alıntıyla cevap versin.
5. Bildirim: kullanıcı merdiven bildirir → admin onaylar → rota yeniden hesaplanınca o segmentten kaçınsın.
6. Erişilebilirlik: VoiceOver ve TalkBack ile onboarding, keşif ve rota akışı baştan sona tamamlanabilsin.

## Açık konular
- LLM ve embedding sağlayıcısı (sonra karar verilecek)
- Vakıf Katılım veri setinin formatı (gelince pipeline uyarlanacak)

## İlerleme (13 Ekim 2026)

**Bitti**
- [x] Monorepo, Supabase (sezi-eu, Frankfurt) şeması + RLS, `works_view`
- [x] Rota motoru (profil ağırlıklı) + Lynch yönlendirme motoru, 17 test
- [x] Mobil: onboarding (algısal profil), Profil, Keşfet (harita + liste + tür filtresi), eser detayı (sesli dinle, kaynaklar), TR/EN
- [x] Görsel dil: Atkinson Hyperlegible + Fraunces, kilim motifleri, eser türü glifleri, yüksek kontrast modu
- [x] Pilot veri: Wikidata'dan 85 eser (19 doğrulanmış), OSM'den Süleymaniye yaya grafiği (13 Ekim'de Bursa'ya taşındı)
- [x] Bilgi notu uyarlaması: Hatay/Konya/Bursa envanter kitaplarının içindekiler sayfalarından 686 kayıt (ad, ilçe, tür, cilt/sayfa), Wikidata + Nominatim ile konum; çok şehirli Keşfet, il sayfası, sergiler, eser detayında kitap atfı
- [x] İşitme profili: duymayan kullanıcıya her ses ipucunun görsel (ekran kenarı parlaması) ve haptik karşılığı, anlatım metni
- [x] Rota ekranı + simülasyon modu (TTS, titreşim, yönlü ses ipucu)

**Sırada**
- [ ] Gerçek telefonda ses/titreşim/pusula testi (README kontrol listesi) — Ediz
- [ ] Saha gezisi: basamak/eğim/zemin ölçümü, ortam sesi kayıtları, elle yazılmış talimatlar — Zehra
- [ ] Uygulama ikonu ve açılış ekranı, ekran tasarımlarının gözden geçirilmesi — İnci
- [ ] Gerçek GPS modu (konuma göre başlangıç ve canlı takip) — Eda
- [ ] Admin paneli: giriş, eser CRUD, taslak onayı, grafik düzenleme, bildirim moderasyonu — Ediz
- [ ] Erişilebilirlik bildirimi akışı (mobil), RAG asistanı (LLM sağlayıcısı seçilince)
