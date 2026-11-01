# HANDOFF — oturum devri

Son güncelleme: 1 Kasım 2026. Yeni oturum önce [AGENTS.md](AGENTS.md)'yi, sonra bu dosyayı okur.

## Şu an neredeyiz

- **Sor UI/UX (1 Kasım):** kısa karşılama ve konulu soru kartları yalnız boş sohbette; sabit başlıkta açıklama paneli ve onaylı yeni sohbet. Kaynaklar yanıt altındaki sayaçtan panelde açılır; eser kartı sade. Çok satırlı 240 karakter alanı, beklerken gönderim engeli, yerel hatada yeniden dene, eski mesaj okunurken otomatik kaydırmayı bırakma ve son mesaja dönme. TR/EN ve tema token'ları korunur. iOS'ta örnek soru → yanıt → kaynak paneli ve yeni sohbet onayı denendi; Android ve ekran klavyesiyle fiziksel cihaz testi bekliyor.

- **Sohbet arama denemesi (1 Kasım):** gerçek `works_view` listesi + mobilin `searchWorks` araması + canlı `ask` ile 8 soru denendi. İlk turdaki Ulu Cami ayrı/bitişik yazımı ve sohbet sözcüklerinin (misin, biraz, anlatır vb.) adayları elemesi düzeltildi. Tekrar: 8/8 geçti; 7 kaynaklı cevap, 1 bilinmeyen ziyaret saatine red. Testler 155/155, typecheck ve mobil lint temiz. Şehirsiz Ulu Cami sorusu çok adaylı; model Bursa'yı varsayabiliyor, şehir netleştirme ileride ele alınmalı.

- **1 Kasım arama düzeltmesi:** mobil önerideki `Ulucami’yi` sorusunda kesme sonrası `yi` eki Yıldırım eserleriyle eşleşip Ulucami'yi eliyordu. Sorguda kesme sonrası ek ayrıştırılır; düz/eğri kesme regresyon testi ve birebir mobil soru canlı değerlendirmeye eklendi.

- **Dal:** `feature/seziye-sor` (kullanıcının istediği ad; Sezi'ye Sor geliştirmesi), taban `main` / `origin/main` (`https://github.com/kokkodhackathon/Sezi`). Henüz push/PR yok.
- **Yanıt dili (1 Kasım):** web ve mobilin ortak yayımlanmış eser bilgileri geçerli kaynak; ikinci kitap alıntısı şartı yok. Sezi kısa, günlük dille sohbet eder; kaynak numaraları korunur, eksik bilgiyi doğal dille söyler.
- **Testler:** `pnpm test` → 154 test geçiyor. `pnpm typecheck` ve `expo lint` temiz. Sezi'ye Sor canlı değerlendirmesi 12/12 (mobil önerideki eğri kesmeli Ulucami sorusu dahil), `public` şeması lint'i temiz.
- **Navigasyon yeniden tasarımı (17 Ekim, ROADMAP #21):**
  - Noktalar tek tabloda: `nav_points` (roller `start`, `landmark`, `story`, `arrival`), admin → **Noktalar**. `data/lynch` silindi; 12 nokta veritabanında.
  - Mobil: tek `navigate` ekranı (nereden: konumum / başlangıç noktası / haritada seçilen yer; nereye: eser, tur, gezinti). Eski `route/[slug]`, `guide/[slug]`, `walk` ekranları kaldırıldı. Oturum `lib/navigation/session.ts`.
  - Deneme verisi: Hanlar'da 10 eser varış noktası (envanter cilt/sayfa olgularından metin), Koza Hanı'nda TR ses kaydı. Örnek rota: Heykel → Pirinç Hanı, 4 noktaya uğrar.
  - Harita Mapbox'a geçirildi (17 Ekim): mobil `@rnmapbox/maps` (yalnız `components/map`), admin `mapbox-gl` (`lib/mapbox.ts`), Mapbox Standard stil. Token `.env`'lerde.
  - Admin → **Rota testi** (17 Ekim): uygulamanın rota planlayıcısı ve simülasyonu panelde. Planlayıcı, yürüyüşçü ve takip adımı `packages/shared`'a taşındı (`planner.ts`, `walker.ts`, `follow.ts`); mobil ve admin aynı kodu kullanır.
- **Cihazda denenmemiş:** gerçek telefonda yeni navigasyon ekranı, sahada GPS, admin bağlantısı (bildirim → onay → rota).
- **Sezi'ye Sor (29 Ekim–1 Kasım, ROADMAP #11, dalda):** DeepSeek `deepseek-flash` sağlayıcısı `LLMProvider` arkasında; API anahtarı yalnız Edge Function secret'ı. PostgreSQL tam metin araması doğrulanmış eser metnini ve herkese açık uygulama alanlarını `doc_chunks` parçalarından bulur, model yalnız bu bağlamla cevap verir ve kaynak kimlikleri sunucuda doğrulanır. Adres, konum kesinliği, ziyaret, erişilebilirlik, fotoğraf ve sergi gibi alanlar kitaba yanlış atfedilmeden **Sezi uygulama kaydı** adıyla ayrı `app` kaynağıdır. 682 doğrulanmış eser için TR + EN 1.364 uygulama parçası üretildi; toplam parça 4.139. Geçici DeepSeek 5xx/bozuk JSON yanıtı bir kez kontrollü tekrarlanır. Mobil kaynak numarası/kitap sayfası gösterir; servis yoksa yerel kayıt aramasına düşer. Kişisel veri aktarım notu ekranda. `20261029150000`, `20261029170000` ve `20261030110000` canlıya uygulandı; `ask` fonksiyonu ve `DEEPSEEK_API_KEY` yayında. `eval.mjs` 11/11 geçti. Seçilen 25 pilot eserin yayımlanmış adres/tarihçe/mimari alanları onaylı kitap taslaklarıyla 25/25 aynı. Sor başlangıç ekranı ve yeni kapsam metni iOS Simulator'da görüldü; ilk açılıştaki eski SQLite kilidi veri silmeden yeniden başlatınca tekrarlanmadı. Bekleyen: cevap/kaynak kartlarının cihazda dokunma denetimi.

## Okunabilir rota (ROADMAP #20) — plan ve durum

Tespit: motor Lynch'e göre rota seçmiyor (yalnız mesafe), sokak adlarını (1220 segmentin 1009'unda var) hiç kullanmıyor, karar noktası ayırt etmiyor, district/edge yok. Zafer Plaza → Ulu Cami: 641 m'de 12 dönüş talimatı.

- **Faz 0 (altın rota) kaldırıldı (17 Ekim):** ekip artık rota yazmıyor, yalnız nokta giriyor (admin → Noktalar). Rotalar her zaman motordan; talimat kalitesi Faz 1'den itibaren motorda iyileştirilir.
- **Faz 1:** dönüş cezası (kenar durumlu Dijkstra; yalnız bağlantı ≥ 3 kavşakta), sokak değişim cezası.
- **Faz 2:** karar noktası ve yol parçaları; zikzak sunumda birleşir, manevra atomik kalır.
- **Faz 3:** yol dili ("X boyunca N m"), teyitte yol adı.
- **Faz 4:** salience düğüme, `pathClass`, district çokgenleri ve edge (veri, `verified: false`).
- **Faz 5–6:** mobil rötuş, kabul testleri. Her fazda ölçüt: ekip ↔ motor fark raporu (rota ekranında, geliştirici seçenekleri).

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
- Lynch noktaları ekip bilgisine dayanıyor, hepsi `verified: false` — Sıla sahada doğrulayacak.
- Çevrimdışı önbellek yok (ROADMAP #4, P0): uçak modunda Keşfet boş açılır; rota/rehberlik gömülü grafikle çalışır.
- Yeniden tasarlanmamış ekranlar: Sor, Profil, Ayarlar, Hakkında, Onboarding (eski stil, çalışıyor).
- Supabase advisor'da tek uyarı: `auth_leaked_password_protection` (dashboard ayarı, ücretli özellik; kabul edildi).
- **Chirp 3 HD seslendirme açık** (18 Ekim): `GOOGLE_TTS_API_KEY` ve `TTS_DAILY_CHAR_LIMIT=30000` Supabase secret'ı (`.env`'e konmaz; anahtar APK'ya girmemeli). Günlük kullanım `public.tts_usage` tablosunda. Migration'lar `20261018120000_tts_cache` ve `20261018120100_work_audio` `db query -f` ile uygulandı (uzak migration geçmişi yerelle uyuşmadığı için `db push` kullanılmadı). Telefonda dinlenmedi.

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

Ekip işleri ROADMAP'te: Sıla (Lynch noktalarını sahada doğrulama, fotoğraf kutusu, konum iğneleri), İnci (ikon, splash), Eda (TalkBack denetimi).

## Erişim ve hesaplar

- Supabase `sezi-eu` (`jejsvycpzulpleftkssj`). Admin: `edizkeskin@gmail.com`, rol `app_metadata.role = 'admin'`. Parolayı kullanıcı kendisi SQL ile belirler; ajan parola girmez.
- `.env` dosyaları (mobil ve admin) yerelde, commit'lenmez. Örnek: kökte `.env.example`; admin için `apps/admin/.env` içine aynı değerler `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` adıyla yazılır.
- Foto pipeline'ı için Python venv: pillow + pymupdf gerekir (`python -m venv`, `pip install pillow pymupdf`).
