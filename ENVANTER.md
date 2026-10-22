# Vakıf Eserleri Envanter Projesi: bilgi notu analizi

Kaynak: *KÖK&KOD Hackathonu – Vakıf Eserleri Envanter Projesi Bilgi Notu* ve organizasyonun ekli mesajı (13 Ekim 2026). Belgedeki 6 bağlantının ve 6 envanter kitabının (Hatay 1, Konya 2, Bursa 3 cilt) tamamı incelendi.

## 1. Kapsam kararı

- **Çalışma şehirleri:** Hatay, Konya, Bursa (organizasyonun mesajı).
- **İleride eklenecek iller:** Kütahya (tamamlandı, baskıda), İzmir ve Manisa (2026'da başladı). Altyapı yeni illere açık olmalı.
- **Önceki pilot:** Süleymaniye (İstanbul) kapsam dışı kaldı. Verisi silinmedi, `archived` durumuna alındı.
- **Yeni pilot:** Lynch yönlendirme pilotu **Bursa – Ulu Cami ve Hanlar Bölgesi** (UNESCO alanı). Ulu Cami şadırvanı (su sesi), Koza Han, Emir Han ve Kapalıçarşı yürüme mesafesinde.

## 2. Envanter projesi: olgular (uygulamada şehir sayfalarında gösterilir)

| İl | Yıl | Eser | Fotoğraf | Durum | Yayın |
|---|---|---|---|---|---|
| Hatay | 2022 | 117 | 2.600 | Yayımlandı (TR/EN, basılı + dijital) | 1 cilt |
| Konya | 2024 | 289 | 15.200 | Yayımlandı (TR/EN, basılı + PDF) | 2 cilt |
| Bursa | 2025 | 385 | 34.952 | Tamamlandı, baskıda (PDF yayında) | 3 cilt |
| Kütahya | 2025 | 141 | 11.871 | Tamamlandı, baskıda | – |
| İzmir, Manisa | 2026 | – | – | Çalışma başladı | – |

**Sergiler:**
- **"5 Şubat Hatay":** Mimar Sinan Galerisi, Üsküdar. 5 Ekim – 26 Kasım 2023, 59 fotoğraf. Depremden hemen önce çekilmiş fotoğraflar.
- **"Ayna" (Konya):** Mimar Sinan Galerisi, Üsküdar. Açılış 24 Ocak 2025.
- **Bursa Vakıf Eserleri açık hava sergisi:**
  - Açılış 4 Nisan 2026, Tophane Meydanı. Bursa'nın fethinin 700. yılı etkinlikleri kapsamında.
  - Seçilen 276 fotoğraf yıl boyunca Orhangazi Meydanı, Cumhuriyet Caddesi, Çarşıbaşı, Emir Sultan ve UNESCO Meydanı'nda sergileniyor.

**Ödül:** Brandverse Awards 2026, Kültür ve Sanat Projeleri kategorisinde gümüş ödül.

**Yayın PDF'leri:** `https://www.vakifkatilim.com.tr/tr/hakkimizda/medya-merkezi/yayinlarimiz`.
- Sunucu HEAD isteklerine 404 döner, GET ile iner.
- Kitaplarda "Tüm hakları saklıdır" ibaresi var.

## 3. Kitapların yapısı (veri modeline etkisi)

- **Hatay:** Kayıtlar türe göre gruplanmış: külliyeler ve kervansaraylar, camiler ve mescitler, türbeler, kiliseler, eski evler ve konaklar, iş yerleri. Her kayıtta TR/EN başlık, giriş tarihçesi (banisi, yapım ve onarım yılları) ve yapı bölümlerine göre alt başlıklar var. **Adres yok.**
- **Konya ve Bursa:** Kayıtlar **ilçeye** göre, ilçe içinde türe göre gruplanmış. Her kaydın ilk cümlesinde açık adres var (ör. "Meram ilçesi, Şükran Mahallesi, Hotuz Sokak, No. 2").
- **Ortak içerik:** Bazı kayıtlarda kitabeler ve anlamları ("Mealen"), açılış ayeti, UNESCO Dünya Mirası notu (Bursa), deprem ve restorasyon olayları var.
- **Kapsam:** Envanter yalnızca İslami yapılardan oluşmuyor. Rum Katolik, Rum Ortodoks, Süryani Katolik ve Ermeni kiliseleri de var; manastır, değirmen, konak, köy evi ve höyük de yer alıyor.
- **Kitap sonu:** Mimari terimler sözlüğü (mihrap, harim, revak…).

## 4. Bilgi notundaki beklentiler → Sezi'deki karşılığı

| Beklenti | Karşılık |
|---|---|
| Kullanıcı dostu, mobil, hızlı, görsel anlatımı güçlü | Expo mobil uygulama; harita gecikmeli yüklenir; tür glifleri, kilim motifleri |
| Tarihçe, mimari ve teknik detay; Vakıf Katılım + diğer güvenilir kaynaklar | `history`, `architecture`, `period`, `work_events` (zaman çizelgesi), `inscriptions` (kitabeler). Kaynak gösterimi zorunlu: envanter kitabı **cilt/sayfa** ile |
| Veri alanları: il, ad, tür, konum, tarihçe, TR/EN, foto galerisi, sergi | `cities` (envanter bilgileriyle), `works` (ilçe, adres, konum kesinliği), `media`, `exhibitions` + `work_exhibitions`; tüm metinler `{tr, en}` |
| Harita + şehir/tür filtresi | Keşfet: şehir seçici, tür ve ilçe filtresi, harita |
| **Görme ve işitme engelli** kullanıcılar | Görme: mevcut (ekran okuyucu, yüksek kontrast, sesli rehberlik). **İşitme (yeni):** profil sorusu; duymayan kullanıcıda ses ipucu yerine görsel ve titreşim; sesli anlatımların tam metni |
| Yeni il ve eserlerin eklenebildiği esnek altyapı | Şehir tablosu, aktif/pasif; pipeline il tanımıyla çalışır; admin panelinden ekleme |
| Gençlerle buluşan kültürel platform | Turlar, ziyaret ilerlemesi, Sezi'ye Sor |

## 5. Veri politikası (telif)

- **Kitaplardan alınanlar (olgular):** Eser adı (TR/EN), il, ilçe, kitaptaki bölüm, cilt ve sayfa. Bunlar `verified` olarak yayımlanır ve kaynak olarak kitaba bağlanır.
- **Kitap metinleri (18 Ekim, kullanıcı kararı):** Kitaplar organizasyonun hackathon için paylaştığı veri setidir. Adres ve tarihçe metinleri (TR/EN) `data/inventory_texts.py` ile `text_drafts` tablosuna **taslak** olarak çıkarılır. Admin, **Eser metinleri** sayfasında kitap sayfasıyla karşılaştırıp yayınlar; yayınlanan metin esere kitap atfıyla bağlı kalır. Otomatik yayın yoktur. Kitabe çevirileri ve kitaptaki fotoğraflar alınmaz; fotoğraflar arşiv paylaşımından gelir.
- **Bilgi kartı ve sade özet (22 Ekim):** Yapım yılı, bani, dönem ve kısa sade özet, admin'in kitap sayfasını görerek **Eser metinleri**'nde girdiği bilgilerdir. Kaynakta olmayan bilgi eklenmez. Uygulamada her satırın yanında kaynak numarası durur ve kitabın o sayfası açılır.
- **Gitmeden önce (ziyaret bilgisi):** Basamak, rampa, açık saat ve gezme süresi kitapta yok. Bunlar saha gözlemi ya da resmî kaynaktan girer; kaynak ve kontrol tarihi zorunludur (veritabanı kuralı) ve uygulamada gösterilir. Bilgi yoksa uygulama "henüz doğrulanmadı" der.
- **Yüklenen fotoğraflar:** Admin, **Fotoğraf kutusu → Yükle**'den fotoğrafçısı ve kullanım izni (ekip çekimi, yazılı izin, CC BY, CC BY-SA, CC0, kamu malı) belli fotoğraf ekler. Fotoğrafın üstünde "Fotoğraf: <ad>" etiketi ve atıf paneli durur.
- **Konumlar:** Wikidata (CC0) ve OpenStreetMap/Nominatim (ODbL). `data/location_candidates.py` her eser için aday üretir, tür ve ilçe çelişkisini veto eder; admin **Konum eşleştirme** sayfasında karar verir. Her eserde kesinlik (`exact` / `approximate` / `unknown`) ayrıca gösterilir.
- **Wikimedia Commons fotoğrafları (21 Ekim):** Envanter fotoğrafı olmayan eserlerde Wikidata'nın temsil görseli (P18) kullanılır. Bize verilen veri dışında olduğu için fotoğrafın üstünde "Wikimedia Commons" etiketi durur; etiket yazar, lisans (bağlantılı), dosyadaki değişiklik ve Commons dosya sayfasını gösterir. Yalnız CC0, kamu malı, CC BY ve CC BY-SA girer. Dosya bizim `media` kovamıza kopyalanır (internetsiz çalışma). Satırlar taslak girer; veritabanı tetikleyicisi eserin Wikidata eşleşmesi **Konum eşleştirme**'de kabul edilmeden yayına izin vermez, kabul geri alınırsa fotoğraf taslağa döner.

## 6. Pipeline

```bash
python -I data/inventory_toc.py      # içindekilerden eser listesi → data/out/inventory_toc.json
python -I data/inventory_geocode.py  # Wikidata + Nominatim konumu → data/out/inventory_geo.json
python -I data/inventory_import.py   # → supabase/seed_inventory.sql
```

Kitap PDF'leri `data/raw/books/` klasörüne konur (gitignore'da).

**Bilinen ayrıştırma sınırları:**
- İçindekiler satırı resmî eser sayısıyla aynı değil: bir külliye satırı birden çok yapıyı kapsıyor.
- Ayrıştırma sonuçları: Hatay 74 / 117, Konya 271 / 289, Bursa 341 / 385.
- Şüpheli kayıtlar `needs_review` ile işaretlenir ve taslak olarak girer.
