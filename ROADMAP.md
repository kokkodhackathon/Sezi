# Yol haritası

Son güncelleme: 13 Ekim 2026. Görevi bitiren, durum sütununu günceller.

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
| İçerik ekleme ve düzenleme; yeni il ve tür eklenebilir | 🔴 Şema hazır, admin paneli yok |
| Ham veri kendi modelimize dönüştürüldü; doğrulanmamış içerik gerçek gibi gösterilmiyor | 🟢 Pipeline, `draft` / `verified`, konum kesinliği |
| Topluluk katkısında moderasyon | 🔴 Bildirim cihazda kalıyor |
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
| 2 | P0 | Admin paneli MVP (`apps/admin`): magic link girişi + admin rolü, eser listesi ve filtre, eser düzenleme (TR/EN alanlar), `draft → verified`, `needs_review` kuyruğu | Ediz + Eda | Admin bir eseri düzenleyip onaylar, mobil yenilenince görünür; admin olmayan yazamaz (RLS) | ⬜ |
| 3 | P0 | Admin'de harita üzerinde konum iğnesi: `approximate` / `unknown` → `exact` | Eda | Bursa Osmangazi'deki konumsuz eserlerin en az 50'si elle konumlanır | ⬜ |
| 4 | P0 | Çevrimdışı önbellek: `works_view`, `cities` ve `exhibitions` yanıtlarını cihazda saklamak (TanStack persist + expo-sqlite) | Eda | Uçak modunda Keşfet, eser detayı ve tur açılıyor | ⬜ |
| 5 | P0 | Resmî veri içe aktarma: tarihçe, mimari, fotoğraflar → `history`, `architecture`, `media` (Storage, WebP ≤1600 px, alt metin TR/EN) | Zehra + Ediz | Pilot alandaki 17 eserin metni ve en az 1 fotoğrafı var; her metin kaynağa bağlı | ⏸ veri bekleniyor |
| 6 | P0 | Saha gezisi (Bursa Hanlar): basamak, eğim, zemin, genişlik ölçümü; 17 landmark için TR/EN talimat metni; ortam sesi kayıtları | Zehra | `nav-json` segmentleri ölçümle güncel; `instructions` ve `audio_assets` dolu | ⬜ |
| 7 | P0 | Uygulama ikonu, açılış ekranı, ekran tasarımlarının gözden geçirilmesi | İnci | `app.json` ikon ve splash; tasarım notları uygulanmış | ⬜ |
| 8 | P0 | Demo senaryosu ve provası; yedek video | Hepsi | Uçak modunda baştan sona 5 dakikalık akış | ⬜ |
| 9 | P1 | Erişilebilirlik bildirimi gönderimi: oturum kalıcı, kuyruktaki bildirim `a11y_reports` tablosuna gider, admin onaylayınca segment `blocked` / ağırlık güncellenir | Ediz | Merdiven bildirimi onaylanınca rota o segmentten kaçınır (test) | ⬜ |
| 10 | P1 | Gerçek GPS modu: konuma göre başlangıç, canlı takip, pusula ile panlama | Eda | Sahada konum en yakın kenara eşleniyor; sapmada uyarı | ⬜ |
| 11 | P1 | Sezi'ye Sor (RAG): `LLMProvider` arayüzü, `doc_chunks` embedding'leri, alıntılı cevap, kaynak yoksa "bilmiyorum" | Ediz | 10 soruluk test seti: kaynaklıya alıntılı cevap, kaynaksıza red | ⏸ sağlayıcı kararı |
| 12 | P1 | TalkBack denetimi: onboarding → Keşfet → eser → tur → rehberlik | Eda + İnci | Ekrana bakmadan tamamlanıyor; bulgular düzeltilmiş | ⬜ |
| 13 | P1 | CI (GitHub Actions): `pnpm typecheck` + `pnpm test` her push'ta; pipeline için pytest (`type_of`, `tr_title`) | Ediz | Kırmızı/yeşil rozet; tür sınıflandırma testleri | ⬜ |
| 14 | P1 | Sergi–eser bağlantıları (`work_exhibitions`), külliye bağlantıları (Bursa külliyeleri `complexes`) | Zehra | Eser detayında "Sergilendiği yerler" görünür | ⬜ |
| 15 | P1 | Konum eşleştirme kalitesi: `approximate` eşleşmeleri gözden geçirip yanlışları `geo_overrides.json` ile kaldırmak | Zehra | Yaklaşık konumların yanlış ilçeye düşmesi 0 | ⬜ |
| 16 | P2 | Mimari terimler sözlüğü (`glossary_terms`): terimler kitaplardan, tanımlar kendi yazımımız | Zehra | Eser metninde terime dokununca tanım açılır | ⬜ |
| 17 | P2 | Konya ve Hatay için pilot alan grafiği (`AREAS` sözlüğüne ekle) | Ediz | Her ilde en az 5 landmark'lı rota | ⬜ |
| 18 | P2 | Maestro mobil E2E, Playwright admin E2E | Eda | Ana akışlar CI'da | ⬜ |
| 19 | P2 | iOS build | Eda | Simülatörde açılıyor | ⬜ |

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

- **12 Ekim:**
  - Monorepo, Supabase şeması ve RLS, rota ve Lynch yönlendirme motoru.
  - Mobil iskelet, görsel dil (Atkinson Hyperlegible, Fraunces, kilim motifleri), simülasyon modu.
  - Uygulamanın tüm final ekranları.
- **13 Ekim (bilgi notu):**
  - Hatay, Konya ve Bursa envanterinden 686 kayıt; çok şehirli Keşfet, il sayfası, sergiler, kitap atfı.
  - İşitme profili ve görsel/haptik ipuçları.
  - Pilot alan Süleymaniye'den Bursa Ulu Cami ve Hanlar Bölgesi'ne taşındı.
