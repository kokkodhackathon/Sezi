# Yol haritası

Son güncelleme: 15 Ekim 2026. Görevi bitiren, durum sütununu günceller. Anlık durum ve sıradaki işler: [HANDOFF.md](HANDOFF.md).

## Hedef

**7–8 Kasım 2026 finalinde canlı demo** (Bilişim Vadisi İstanbul GO). Demo şöyle ilerler:

1. Jüri profil seçer: görme engelli, tekerlekli sandalye veya duymayan.
2. Keşfet'te Hatay, Konya ve Bursa envanterini, harita ve kitap atfıyla gezer.
3. Bursa Ulu Cami ve Hanlar Bölgesi'nde bir tur başlatır.
4. Simülasyonda yer işaretli, sesli, titreşimli ya da görsel rehberlikle eserden esere yürür. **İnternet kapalıyken de çalışır.**
5. Admin panelinden bir eser onaylanır ve mobilde anında görünür.

## Jüri kontrol listesi (şartname)

| Zorunlu | Durum |
|---|---|
| Çalışan mobil MVP, uçtan uca canlı demo | 🟡 Mobil var; admin ve çevrimdışı önbellek eksik |
| Birden çok eser; her eserde tarihî bilgi, görsel, **kaynak** | 🟡 Kaynak var (cilt/sayfa); tarihçe ve görsel resmî veriyi bekliyor |
| İçerik ekleme ve düzenleme; yeni il ve tür eklenebilir | 🟢 Admin paneli: eser ekleme/düzenleme, fotoğraf, il |
| Ham veri kendi modelimize dönüştürüldü; doğrulanmamış içerik gerçek gibi gösterilmiyor | 🟢 Pipeline, `draft` / `verified`, konum kesinliği |
| Topluluk katkısında moderasyon | 🟢 Bildirim → admin onayı → rota etkisi |
| Erişilebilirlik ürünün içinde | 🟢 Profil, ekran okuyucu, kontrast, işitme karşılıkları. TalkBack denetimi bekliyor |
| Girdi doğrulama, testler, modüler kod, README | 🟡 zod ve Vitest var; CI, pipeline ve E2E testleri yok |

## Kilometre taşları

| Hafta | Tarih | Çıktı |
|---|---|---|
| 1 | 12–18 Ekim | ✅ Şema, mobil ekranlar, envanter verisi, Bursa pilot grafiği. ⏳ Telefonda doğrulama |
| 2 | 19–25 Ekim | Admin MVP (giriş, eser düzenleme, onay, konum iğnesi), çevrimdışı önbellek, saha gezisi #1, resmî veri gelirse içe aktarma |
| 3 | 26 Ekim – 1 Kasım | Bildirim gönderimi ve moderasyonu, gerçek GPS modu, ortam sesleri, RAG (sağlayıcı seçilirse), TalkBack denetimi |
| 4 | 2–6 Kasım | **4 Kasım feature freeze.** Hata düzeltme, demo provası (uçak modu), sunum, yedek video |
| Final | 7–8 Kasım | Canlı demo |

## Backlog

Öncelik: **P0** demo için şart, **P1** jüri puanını artırır, **P2** zaman kalırsa.

| # | Öncelik | Görev | Sahip | Kabul ölçütü | Durum |
|---|---|---|---|---|---|
| 1 | P0 | Yeni ekranları telefonda doğrula: Keşfet çoklu il, il sayfası, eser detayı, Hanlar turu ve simülasyonu | Ediz | Ekran görüntüleri; çökme yok; TR/EN metinler taşmıyor | ⏳ |
| 2 | P0 | Admin paneli MVP (`apps/admin`): magic link girişi + admin rolü, eser listesi ve filtre, eser düzenleme (TR/EN alanlar), `draft → verified`, `needs_review` kuyruğu | Ediz + Eda | Admin bir eseri düzenleyip onaylar, mobil yenilenince görünür; admin olmayan yazamaz (RLS) | ✅ Giriş, liste, düzenleme, yeni eser, iller, fotoğraf kutusu (14 Ekim) |
| 3 | P0 | Admin'de harita üzerinde konum iğnesi: `approximate` / `unknown` → `exact` | Eda | Bursa Osmangazi'deki konumsuz eserlerin en az 50'si elle konumlanır | ⏳ Araç hazır; elle konumlama sürüyor |
| 4 | P0 | Çevrimdışı önbellek: `works_view`, `cities` ve `exhibitions` yanıtlarını cihazda saklamak (TanStack persist + expo-sqlite) | Eda | Uçak modunda Keşfet, eser detayı ve tur açılıyor | ⬜ |
| 5 | P0 | Resmî veri içe aktarma: tarihçe, mimari, fotoğraflar → `history`, `architecture`, `media` (Storage, WebP ≤1600 px, alt metin TR/EN) | Zehra + Ediz | Pilot alandaki 17 eserin metni ve en az 1 fotoğrafı var; her metin kaynağa bağlı | ⏳ Bursa fotoğrafları eklendi (51 fotoğraf, 47 eser); tarihçe metinleri bekleniyor |
| 6 | P0 | Saha gezisi (Bursa Hanlar): basamak, eğim, zemin, genişlik ölçümü; 17 landmark için TR/EN talimat metni; ortam sesi kayıtları | Zehra | `nav-json` segmentleri ölçümle güncel; `instructions` ve `audio_assets` dolu | ⏳ 12 buluşma/yer işareti noktası admin panelinde (Noktalar, "Sahada doğrulandı" kapalı); sahada doğrulanacak |
| 7 | P0 | Uygulama ikonu, açılış ekranı, ekran tasarımlarının gözden geçirilmesi | İnci | `app.json` ikon ve splash; tasarım notları uygulanmış | ⏳ Sade tasarım dili mobil ekranlara uygulandı; DESIGN.md yazıldı. Android emülatöründe temel akış kontrol edildi; gerçek telefon, ikon/splash ve kapsamlı erişilebilirlik kontrolü bekliyor |
| 8 | P0 | Demo senaryosu ve provası; yedek video | Hepsi | Uçak modunda baştan sona 5 dakikalık akış | ⬜ |
| 9 | P1 | Erişilebilirlik bildirimi gönderimi: oturum kalıcı, kuyruktaki bildirim `a11y_reports` tablosuna gider, admin onaylayınca segment `blocked` / ağırlık güncellenir | Ediz | Merdiven bildirimi onaylanınca rota o segmentten kaçınır (test) | ✅ Hesapsız gönderim (RLS), admin onayı → segment_overrides → uygulama rotası |
| 10 | P1 | Gerçek GPS modu: konuma göre başlangıç, canlı takip, pusula ile panlama | Eda | Sahada konum en yakın kenara eşleniyor; sapmada uyarı | ⏳ Yürüyüş ekranında (#21) GPS takibi, konumdan rota ve sapmada yeniden rota var; sahada denenmedi |
| 11 | P1 | Sezi'ye Sor (RAG): `LLMProvider` arayüzü, `doc_chunks` embedding'leri, alıntılı cevap, kaynak yoksa "bilmiyorum" | Ediz | 10 soruluk test seti: kaynaklıya alıntılı cevap, kaynaksıza red | ⏸ sağlayıcı kararı |
| 12 | P1 | TalkBack denetimi: onboarding → Keşfet → eser → tur → rehberlik | Eda + İnci | Ekrana bakmadan tamamlanıyor; bulgular düzeltilmiş | ⬜ |
| 13 | P1 | CI (GitHub Actions): `pnpm typecheck` + `pnpm test` her push'ta; pipeline için pytest (`type_of`, `tr_title`) | Ediz | Kırmızı/yeşil rozet; tür sınıflandırma testleri | ⬜ |
| 14 | P1 | Sergi–eser bağlantıları (`work_exhibitions`), külliye bağlantıları (Bursa külliyeleri `complexes`) | Zehra | Eser detayında "Sergilendiği yerler" görünür | ⬜ |
| 15 | P1 | Konum eşleştirme kalitesi: `approximate` eşleşmeleri gözden geçirip yanlışları `geo_overrides.json` ile kaldırmak | Zehra | Yaklaşık konumların yanlış ilçeye düşmesi 0 | ⬜ |
| 16 | P2 | Mimari terimler sözlüğü (`glossary_terms`): terimler kitaplardan, tanımlar kendi yazımımız | Zehra | Eser metninde terime dokununca tanım açılır | ⬜ |
| 17 | P2 | Konya ve Hatay için pilot alan grafiği (`AREAS` sözlüğüne ekle) | Ediz | Her ilde en az 5 landmark'lı rota | ⬜ |
| 18 | P2 | Maestro mobil E2E, Playwright admin E2E | Eda | Ana akışlar CI'da | ⬜ |
| 19 | P2 | iOS build | Eda | Simülatörde açılıyor | ⬜ |
| 20 | P0 | Okunabilir rota: dönüş cezası, yalnız karar noktalarında talimat, path/district/edge dili; en son Menzilname şeridi ve rota provası | Ediz | Zafer Plaza → Ulu Cami rotasında ilk 300 m'de en fazla 2 dönüş talimatı; testle korunur | ⏳ Altın rota (Faz 0) 17 Ekim'de kaldırıldı: ekip rota yazmaz, yalnız nokta girer. Sıradaki: Faz 1 dönüş cezası |
| 21 | P0 | Navigasyon: admin panelinden noktalar (başlangıç, yer işareti, anlatım, eser varışı); tek navigasyon ekranında nereden/nereye, yol üstündeki noktalara uğrayan rota (≤ %25, ≤ +300 m), yaklaşınca pop-up + ses, varışta eser kartı + ses; simülasyonda haritadan başlangıç | Ediz | Admin noktayı ekler, rota ona uğrar ve yarıçapta açar; işitme `deaf`'te metin + titreşim; internetsiz son bilinen noktalar ve indirilmiş sesler | ⏳ Emülatörde doğrulandı (17 Ekim): admin varış noktası + ses yükleme, GPS ile plan/uğrama/pop-up, haritadan seçilen başlangıçla sanal yürüyüş ve varış kartı, iki duraklı tur (varış → sıradaki durak → ikinci varış, ziyaret kaydı), hedefsiz gezinti (5 nokta, pop-up sonrası sürdürme, tamamlanma), profil karşılaştırması. Bekleyen: Mapbox geçişi (token), sahada GPS, Xiaomi dokunma testi |
| 22 | P1 | Admin → Rota testi: uygulamanın rota planlayıcısı ve sanal yürüyüşü panelde (profil, dil, nereden/nereye, gezinti, hız, yol kapatma, yanlış dönüş, nokta kartı, kayıt) ve dört profilin karşılaştırması (aynı harita + tablo); planlayıcı, yürüyüşçü ve takip adımı `packages/shared`'da tek kaynak | Ediz | Panelde Heykel → Pirinç Hanı rotası uygulamayla aynı (1 km, 4 noktaya uğrar, +201 m); senaryolar yeniden rota çizer; varışta varış bilgisi açılır; karşılaştırmada seçilen profille yürünür | ✅ Tarayıcıda doğrulandı (17 Ekim): yol kapatma, yanlış dönüş, 5 noktalı gezinti, tekerlekli sandalye (basamaksız), EN talimat, profil karşılaştırması (Heykel → Pirinç Hanı: yürüyen 1 basamaklı, sandalye ve görme engelli basamaksız; duymayan yürüyenle aynı rota) ve seçilen profille yürüyüş. Taslak seçeneği veritabanında taslak nokta olmadığı için farkı gösterilemedi |
| 23 | P1 | Türkçe seslendirme Google Chirp 3 HD (`tr-TR-Chirp3-HD-Laomedeia`): kayıt varsa kayıt, yoksa Chirp, alınamazsa cihaz sesi; İngilizce cihaz sesi. Sunucu (Storage) ve cihaz önbelleği, günlük 30k karakter sınırı. Eserlere admin panelinden TR/EN ses kaydı | Ediz | Aynı metin ikinci kez Google'a gitmez (`tts_usage` değişmez); daha önce çalınan metin uçak modunda Chirp ile çalar; eser sayfasında yüklenen kayıt çalar | ⏳ 18 Ekim: migration'lar, edge function `tts`, mobil ses katmanı (`lib/voice`), admin eser ses kaydı hazır. Sabit 28 cümle (adsız dönüşler + uyarılar, "Vardınız.", kalabalık/rota yok) uygulamaya gömülü (379 KB); başlangıç noktalarından 20 esere 4 profilin bütün talimat ve giriş cümleleri (564) sunucuda üretildi. Doğrulandı: admin yükle/kaldır (tarayıcı); edge function üretim, önbellek isabeti, boşluk normalleştirme, 400/413/429; Metro MP3'leri pakete alıyor. Bekleyen: telefonda dinleme (Chirp sesi, hız, uçak modu, eser kaydı) |
| 24 | P0 | Eşleştirme masası: konum adayları (Wikidata + OSM yapı kayıtları + önceki eşleşme; tür ve ilçe çelişkisi vetosu, kaynak uyuşması) ve kitaptan TR/EN adres + tarihçe taslakları; admin panelinde **Konum eşleştirme** ve **Eser metinleri** sayfaları | Ediz + Zehra | Admin aday kabul edince eserin konumu/kesinliği/kimlikleri yazılır, seed kararı ezmez; taslak kitap sayfasıyla karşılaştırılıp yayınlanınca uygulamada eser sayfasında görünür | ⏳ 18 Ekim: 566 eserde 1.581 aday, 685 metin taslağı (576'sı adresli) yüklendi. Tarayıcıda denendi: kabul → konum İznik'e taşındı, kimlikler düzeldi, geri alındı. Bekleyen: ekibin karar vermesi (Bekliyor 220 / Çelişkili 80 Bursa'da), mimari metninin tarihçeden ayrılması, kitaptaki adresle sokak/mahalle düzeyi konum, 50–100 eserlik kontrol seti |

Durum işaretleri: ⬜ başlamadı · ⏳ sürüyor · ⏸ bekliyor · ✅ bitti

## Açık kararlar

| Konu | Seçenekler | Ne zaman |
|---|---|---|
| LLM ve embedding sağlayıcısı | Belirlenmedi. Kod sağlayıcıdan bağımsız yazılacak | Hafta 2 sonu; karar çıkmazsa Ask yerel arama olarak kalır |
| Resmî veri formatı | Organizasyon "envanter dokümanları + yüksek çözünürlüklü fotoğraf" paylaşacak | Gelince pipeline'a adaptör yazılır |
| Kütahya, İzmir, Manisa | `cities` tablosunda pasif; veri gelince aktif edilir | Final sonrası |

## Riskler

- **Resmî veri geç gelir.** Uygulama şu an kitap sayfasına yönlendiriyor; demo bununla da çalışır.
- **Free tier projesi duraklar.** `.github/workflows/supabase-keepalive.yml` önlüyor; secrets eklendi mi kontrol edin.
- **Emülatör yavaş, depolaması dolu.** Testler telefonda yapılır.
- **Final günü internet olmaz.** Görev #4 (çevrimdışı önbellek) P0.

## Biten işler (özet)

- **17 Ekim (navigasyon yeniden tasarımı):** tek `nav_points` tablosu (başlangıç, yer işareti, anlatım, eser varışı) ve admin "Noktalar" editörü; `data/lynch` noktaları veritabanına taşındı, altın rota kaldırıldı. Mobil: Rota, Rehberlik ve Yürüyüş tek `navigate` ekranında (konumum / başlangıç noktası / haritada seçilen yer; eser, tur ya da gezinti; yol üstündeki noktalara uğrayan rota; varış kartı ve sesi); profil karşılaştırması başlangıç ve hedef seçimiyle baştan yazıldı; harita çizimleri `components/map` katmanında. Deneme verisi: Bursa Hanlar'da 10 eser varış noktası (envanter cilt/sayfa olgularıyla), Koza Hanı'nda ses kaydı.

- **16 Ekim (yürüyüş modu):** anlatım noktaları tablosu (sonra `nav_points` oldu); admin editörü; mobil yürüyüş, anlatım pop-up'ı, ses ayarı; uğrayan rota motoru (`shared/via.ts`).

- **15 Ekim:** Lynch buluşma/yer işareti noktaları ve 650 m grafik (897 düğüm, 8 başlangıç); simülasyonda başlangıç seçimi; release APK (arm64); GitHub'a ilk push. Altın rota: Heykel → Koza Hanı onaylı ekip tarifi (`data/lynch/routes`), atomik manevra + gruplu sunum, geliştirici seçeneklerinde ekip ↔ motor karşılaştırması.

- **14 Ekim (admin paneli):** giriş ve rol; eser listesi/düzenleme/yeni eser; haritada konum; fotoğraf onayı ve fotoğraf kutusu (46 eşleşmeyen arşiv fotoğrafı); bildirim moderasyonu; il yönetimi. Uygulama: bildirimler hesapsız sunucuya gider, onaylı bildirimler rotaya uygulanır (internetsizken son bilinen hâl), Keşfet'te aşağı çekip yenile.

- **14 Ekim (tasarım ve fotoğraflar):**
  - "Çini" tasarım dili: açık tema birincil; önce fotoğraf, az yazı; çerçevesiz kartlar. DESIGN.md güncellendi.
  - Bursa fotoğraf arşivi kitap sayfalarıyla eşlenip eserlere bağlandı (Storage + `media`); Keşfet, eser, tur ve il ekranları fotoğraflı.
  - Simülasyon özellikleri Ayarlar → Geliştirici seçenekleri → Simülasyon modu arkasına alındı.

- **14 Ekim (simülasyon):**
  - Sanal yürüyüşçü GPS benzeri ölçüm üretir; takip, rotadan sapma ve talimat zamanlaması gerçek GPS ile ortak (`shared/tracking`). Gerçek GPS modu (#10) için kaynak değiştirmek yeterli.
  - Zengin Lynch dili: merdiven, arnavut kaldırımı ve ana cadde uyarıları; her 90 m'de teyit.
  - Jüri paneli (yol kapandı, yanlış dönüş, kalabalık), yeniden rota, profil karşılaştırması.
  - Ses manzarası ve ses altyazısı. Konuşma kuyruğu; rota ve tam ekran ekranları tek oturumu paylaşıyor.

- **12 Ekim:**
  - Monorepo, Supabase şeması ve RLS, rota ve Lynch yönlendirme motoru.
  - Mobil iskelet, görsel dil (Atkinson Hyperlegible, Fraunces, kilim motifleri), simülasyon modu.
  - Uygulamanın tüm final ekranları.
- **13 Ekim (bilgi notu):**
  - Hatay, Konya ve Bursa envanterinden 686 kayıt; çok şehirli Keşfet, il sayfası, sergiler, kitap atfı.
  - İşitme profili ve görsel/haptik ipuçları.
  - Pilot alan Süleymaniye'den Bursa Ulu Cami ve Hanlar Bölgesi'ne taşındı.
