# Product

## Platform

android

## Users
Vakıf eserlerini (cami, medrese, sebil, han, hamam, türbe…) yerinde gezen herkes: yerli ziyaretçi, turist, öğrenci. Görme kısıtlı (az gören, görme engelli) ve hareket kısıtlı (baston, tekerlekli sandalye) bireyler ürünün kenarında değil merkezinde. Tipik sahne: Bursa Hanlar Bölgesi gibi tarihî çarşılarda, kalabalık ve tabela karmaşası içinde, çoğu zaman tek elle ya da ekrana bakmadan kullanım.

## Product Purpose
Sezi, vakıf mirasını koordinatlara indirgeyen 2D navigasyon yerine, Kevin Lynch'in bilişsel haritalama yaklaşımıyla (landmark / node / path / district) çok duyulu yönlendirme yapan bir keşif asistanıdır. Kullanıcı eseri bulmakla kalmaz; külliyenin parçalarını bir bütün olarak deneyimler ve kaynaklı, doğrulanmış bilgiye ulaşır. Başarı: kısıtı olan bir kullanıcının Bursa'nın Ulu Cami ve Hanlar Bölgesi'nde rehbersiz, güvenle yön bulup eserleri öğrenebilmesi.

## Positioning
"100 m sonra sağa dönün" yerine "Sebilin su sesini duyunca meydanın sağına yönelin": yön tarifi yer işaretlerine, ortam seslerine (kulaklıkta yönüne göre panlanmış), titreşime ve dokuya dayanır. Rota kullanıcının algısal ve fiziksel profiline göre hesaplanır (tekerlekli sandalye basamaklı yoldan hiç geçmez, görme engelli gürültülü sokaktan kaçınır).

## Operating Context
- KÖK&KOD Hackathon (42 Türkiye x Vakıf Katılım). Final 7–8 Kasım 2026, Bilişim Vadisi İstanbul GO; jüri Bilişim Vadisi, Vakıf Katılım, bağımsız üyeler ve Vakıflar Genel Müdürlüğü'nden oluşur. Canlı demo zorunlu; demo simülasyon moduyla ve internetsiz çalışmalı.
- İller: Hatay, Konya, Bursa (Vakıf Katılım envanter kitapları). Yeni iller veriyle eklenir, kod değişmez.
- Pilot alan: Bursa, Ulu Cami ve Hanlar Bölgesi.
- Erişilebilirlik profili: görme, hareket ve işitme. Duymayan kullanıcı için her ses ipucunun görsel ve haptik karşılığı vardır.
- İçerik ekibin admin panelinden girilir ve onaylanır; topluluk erişilebilirlik bildirimleri moderasyondan geçer.

## Capabilities and Constraints
- Expo (React Native, New Architecture), Android development build; iOS ikincil.
- Ekranlar: algısal profil onboarding'i, Keşfet (il seçici, harita, tür ve ilçe filtresi), il sayfası, eser detayı (envanter atfı, sesli dinleme), turlar, rota, canlı rehberlik, simülasyon modu, Sezi'ye Sor, sergiler, Profil. Ayrıntı: ARCHITECTURE.md.
- Harita: MapLibre + OpenFreeMap. `Marker` bileşeni çöküyor; noktalar GeoJSON katmanıyla çizilir.
- Dil: Türkçe ve İngilizce.
- Doğrulanmamış içerik gerçek bilgi gibi gösterilemez; her tarihî bilgi kaynak gösterir.

## Brand Commitments
- Ad: **Sezi**.
- Renkler: moodboard paleti (docs/Moodboard.png): turkuaz, kırmızı/pas, kahve, krem kağıt zemin. Token'lar `packages/shared/src/theme.ts` içinde.
- Sade arayüz ve birkaç belirgin kültürel detay: karşılama ekranında küçük geometrik çengel; işlem, liste ve rehberlik ekranlarında dekoratif şerit yok.
- Arayüz ve yön talimatları Atkinson Hyperlegible Next; eser/tur başlıkları ve marka adı Fraunces. Uygulanmış görsel kurallar: [DESIGN.md](DESIGN.md). Logo ve uygulama ikonu henüz kesinleşmedi.

## Evidence on Hand
- Veri: envanter kitaplarının içindekiler sayfalarından olgusal alanlar (ad, il/ilçe, tür, cilt/sayfa). Tarihçe ve fotoğraflar resmî paylaşımla gelecek; o zamana kadar uygulama kitaptaki sayfayı gösterir.
- Tarihçe metinleri, fotoğraflar ve ses kayıtları henüz yok; uydurulmamalı. Resmî veri seti henüz gelmedi.

## Product Principles
1. Erişilebilirlik özellik değil, ürünün omurgası: her akış ekrana bakmadan ve ekran okuyucuyla tamamlanabilmeli.
2. Kaynaksız bilgi yok: doğrulanmamış içerik ya gösterilmez ya da açıkça taslak olarak işaretlenir.
3. Yön, mekânın kendisinden okunur: harita destekleyicidir, asıl rehber yer işaretleri, ses ve dokudur.
4. Sahada güvenilirlik: internet yokken de demo ve rehberlik çalışır.

## Accessibility & Inclusion
WCAG 2.2 AA zorunlu taban (kontrast testlerle korunur); az gören profili için yüksek kontrast (AAA metin) modu. TalkBack/VoiceOver ile tüm akışlar, dinamik yazı boyutu, en az 44–48 dp dokunma alanları, sesli anlatım ve titreşim desenleri. Renk tek başına anlam taşımaz.
