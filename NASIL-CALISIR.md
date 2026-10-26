# Sezi nasıl çalışır?

Bu belge Sezi'nin parçalarını şemalarla anlatır: veri nereden gelir, rota nasıl bulunur, telefon yürürken ne yapar, ses nereden çalar. Kod ayrıntısı için [ARCHITECTURE.md](ARCHITECTURE.md). Son güncelleme: 26 Ekim 2026.

---

## 1. Büyük resim

Sistem beş parçadan oluşur: **veri hattı**, **sunucu**, **admin paneli**, **mobil uygulama** ve **web sitesi** (`sezi.info`). Rota motoru ortak pakette (`packages/shared`) durur; telefon, web ve admin paneli aynı motoru kullanır.

```mermaid
flowchart LR
  subgraph KAYNAK["📚 Ham kaynaklar"]
    PDF["Envanter kitapları<br/>PDF"]
    FOTO["Fotoğraf arşivi<br/>+ Wikimedia Commons"]
    OSM["OpenStreetMap<br/>yollar · binalar · çeşme, fırın, cami"]
  end

  subgraph HAT["🐍 Veri hattı · data/"]
    PY["Python scriptleri"]
  end

  subgraph SUNUCU["☁️ Supabase"]
    DB[("Veritabanı")]
    ST[("Dosya deposu<br/>foto · ses")]
    TTS["tts fonksiyonu<br/>Chirp ses üretimi"]
  end

  ADMIN["🖥️ Admin paneli"]
  MOTOR["⚙️ Ortak motor<br/>packages/shared"]
  APP["📱 Mobil uygulama"]
  WEB["🌐 Web sitesi"]
  GRAF["🗺️ Pilot grafiği + binalar<br/>uygulamaya gömülü"]

  PDF --> PY
  FOTO --> PY
  OSM --> PY
  PY -->|"eserler, fotoğraflar,<br/>metin ve konum taslakları,<br/>duyu ipucu adayları"| DB
  PY -->|"yol ağı, binalar"| GRAF
  ADMIN -->|"onaylar, yazar"| DB
  ADMIN -->|"yükler"| ST
  DB -->|"okur"| APP
  DB -->|"okur"| WEB
  ST -->|"indirir"| APP
  TTS --> ST
  APP -->|"Türkçe metin"| TTS
  GRAF --> APP
  GRAF --> WEB
  MOTOR --> APP
  MOTOR --> WEB
  MOTOR --> ADMIN
```

| Parça | Görevi | Bir cümleyle |
|---|---|---|
| Veri hattı | Kitaplardan ve haritadan veri ve taslak çıkarır | "Ham bilgiyi düzenli tabloya çevirir" |
| Supabase | Veriyi, dosyaları ve izinleri tutar | "Ortak hafıza" |
| Admin paneli | Taslakları onaylar, içerik ve tur girer, rotayı dener | "Mutfak" |
| Ortak motor | Rota bulur, talimat kurar, yürüyüşü izler | "Beyin" |
| Mobil uygulama | Kullanıcıyı gezdirir | "Vitrin ve rehber" |
| Web sitesi | Eserleri arama motorlarına ve masaüstüne açar, rota ve tur önizler | "Vitrin" |

---

## 2. Veri hattı: kitaptan haritaya

Hepsi `python -I data/<script>.py` ile çalışır. Hiçbir hat kendi başına yayın yapmaz: emin olunamayan her şey **taslak** olarak girer ve admin onaylar.

### 2a. Eser envanteri

```mermaid
flowchart LR
  A["📖 Kitap PDF"] --> B["inventory_toc<br/>İçindekiler okunur"]
  B --> C["Ad · il · ilçe<br/>cilt · sayfa"]
  C --> D["inventory_geocode<br/>Konum aranır"]
  D --> D1{"Wikidata'da<br/>var mı?"}
  D1 -->|evet| E["Koordinat"]
  D1 -->|hayır| D2["Nominatim'e sor<br/>saniyede 1 istek"]
  D2 --> E
  E --> F["inventory_import<br/>Tür ve kesinlik"]
  F --> G[("works tablosu")]
  D --> LC[("location_candidates<br/>konum adayları")]
  LC -->|"admin kabul eder"| G
```

Konum için hat birden çok aday üretir (Wikidata, OSM, Nominatim, elle düzeltme) ve her adaya gerekçeli bir puan verir: ad benzerliği, tür, ilçe. Tür ya da ilçe çelişen aday elenir. Admin **Konum eşleştirme** sayfasında birini kabul edince eserin konumu yazılır; bir eserin tek kabul edilmiş adayı olur.

Konum ne kadar güvenilir? Uygulama bunu kullanıcıya açıkça gösterir:

| Kesinlik | Ne zaman | Haritada |
|---|---|---|
| 🎯 `exact` | Elle doğrulandı ya da güçlü Wikidata eşleşmesi | Nokta |
| 〰️ `approximate` | Zayıf eşleşme | "Yaklaşık" etiketi |
| ❔ `unknown` | Eşleşme yok | Haritada yok, listede var |

> **Telif kuralı:** Kitaptan olgular doğrudan girer (ad, il, tür, cilt/sayfa). Kitap metinleri (adres, tarihçe) yalnız taslak olarak girer, admin kitap sayfasıyla karşılaştırıp yayınlar (§2c).

### 2b. Fotoğraf eşleştirme

Arşivdeki dosya adları eseri söylemez ("ERD03201.jpg"). Hat, fotoğrafı kitaptaki görsellerle **görüntü parmak iziyle** karşılaştırır.

```mermaid
flowchart LR
  F["🖼️ Arşiv fotoğrafı"] --> K["Küçült<br/>1600 px + 480 px"]
  F --> H["Parmak izi"]
  P["📖 Kitaptaki görseller"] --> H2["Parmak izi + sayfa no"]
  H --> M{"En yakın görsel"}
  H2 --> M
  M -->|"çok benzer"| V["✅ verified"]
  M -->|"biraz benzer"| D["📝 draft<br/>admin bakar"]
  M -->|"benzemiyor"| X["📦 Fotoğraf kutusu"]
```

Kitapta fotoğrafı olmayan esere Wikidata'daki **Commons** görseli (P18) eklenir; kartta yazarı ve lisansı görünür. Admin de **Fotoğraf kutusu → Yükle** ile fotoğraf ekleyebilir; fotoğrafçı ve kullanım izni zorunludur.

### 2c. Kitaptan metin taslakları

```mermaid
flowchart LR
  P["📖 Kitap PDF"] --> T["inventory_texts<br/>yazı tipine göre ayıklar"]
  T --> D[("text_drafts<br/>adres · tarihçe TR/EN")]
  D --> A{"🖥️ Eser metinleri<br/>kitap sayfası yanında"}
  A -->|"düzelt + yayınla"| W[("works")]
```

- Eserin sınırı kitaptaki başlıktan bulunur; kitabe alıntıları ve çevirileri çıkarılır.
- Admin metni kitap sayfasıyla yan yana görür. Mimari bölüm ve yapım yılı için **öneri** çıkar, kanıt cümlesiyle; admin seçmeden hiçbiri yayına girmez.
- Admin'in düzenlediği taslağa veri hattı bir daha dokunmaz.
- **Sade özet:** Admin **Özet oluştur** deyince o tek eserin metni Gemini'ye gider ve 2–3 cümlelik TR/EN bir öneri döner. Öneri taslakta saklanır, yayına girmez. Özette kitap metninde geçmeyen bir yıl ya da ad varsa kartta uyarı çıkar. Admin **Özete taşı** der, kitapla karşılaştırır ve yayınlar. Toplu iş yoktur.

### 2d. Pilot yol grafiği

Bursa Hanlar Bölgesi'nin yaya yolları OpenStreetMap'ten indirilir, eserlerle birleştirilir ve **uygulamanın içine gömülür**. Bu sayede rota internetsiz hesaplanır.

```mermaid
flowchart LR
  O["🌍 OSM<br/>650 m çevre"] --> B["build_nav_graph.py"]
  W[("Kesin konumlu<br/>eserler")] --> B
  B --> J["📄 bursa-hanlar-nav.json<br/>898 düğüm · 1221 yol parçası · 36 eser"]
  J --> APP["📱 Uygulama"]
  J --> WEB["🌐 Web"]
  J --> ADM["🖥️ Admin rota testi"]
```

> Grafik yeniden üretilince o an yayında olan kesin konumlu eserler girer. 23 Ekim'deki üretimde 20 eserden 36'ya çıktı.

Her yol parçası (segment) şu bilgileri taşır:

| Bilgi | Örnek | Nereden |
|---|---|---|
| Uzunluk | 42 m | Geometri |
| Basamak | 3 | OSM `steps` |
| Eğim | %5 | OSM |
| Zemin | asfalt · parke · arnavut kaldırımı · **bilinmiyor** | OSM `surface` |
| Gürültü | 0–1 | Yol sınıfından tahmin |
| Yer işareti görünürlüğü | 0–1 | Yakındaki yer işaretleri |

**Zemin bilinmiyorsa** (OSM'de etiket yok): 1221 parçanın 198'i böyle. Rota hesabı bu yolu düz zemin sayar, ama rehberlik ondan bir doku cümlesi kurmaz. Bilinmeyen zeminden arnavut kaldırımına geçişte "zemin değişiyor" denmez, çünkü önceki zeminin ne olduğu bilinmiyor.

### 2e. Harita binaları

`build_buildings.py` pilot alandaki eserlerin OSM bina tabanlarını bulur: önce eserin OSM kimliğiyle, sonra eserin konumunu içeren binayla, en son 20 m içindeki binayla. Yüksekliği Mapbox'tan alır. Bu binalar haritada tür renginde 3B blok olarak öne çıkar. Ulu Cami ve Hanlar bölgesinin çizgisi de bu binalardan çizilir; resmî bir sınır değildir.

### 2f. Duyu ipucu adayları

`build_sense_points.py` OSM'den yön bulmaya yardım edebilecek üç tür yer çıkarır:

| Tür | OSM'de | Ne söylenebilir |
|---|---|---|
| 💧 Su sesi | çeşme | "Su akıyorsa sesini duyabilirsiniz." |
| 🥖 Koku | fırın, pastane | "Açıkken fırın kokusu gelebilir." |
| 🕌 Ezan sesi | adı olan cami | "Ezan okunurken ses bu camiden geliyor olabilir." |

- Hepsi **taslak yer işareti** olarak girer. Çeşme kuru olabilir, fırın kapalı olabilir, ezan o camiden duyulmayabilir; sahada bakılmadan yayınlanmaz.
- Cami ya da çeşme 35 m içindeki aynı türden bir esere bağlanır.
- Script tekrar çalıştırılabilir; aynı OSM kaydı ikinci kez girmez.

---

## 3. Sunucu: kim neyi görür?

Supabase'deki her tablo bir **kapıdan** (RLS) geçer. Uygulama hiçbir zaman taslak içerik görmez.

```mermaid
flowchart TB
  subgraph KIM["Kim"]
    ANON["👤 Uygulama<br/>hesapsız"]
    ADM["🛡️ Admin"]
  end
  subgraph ICERIK["İçerik"]
    V["✅ verified"]
    D["📝 draft"]
    A["🗄️ archived"]
  end
  ANON -->|okur| V
  ANON -. göremez .-> D
  ANON -. göremez .-> A
  ADM -->|okur + yazar| V
  ADM -->|okur + yazar| D
  ADM -->|okur + yazar| A
```

Uygulamanın okuduğu ana pencereler:

| Görünüm | İçinde ne var |
|---|---|
| `works_view` | Eser + il + tür + konum + kaynak + fotoğraflar + ses kaydı + bilgi kartı kaynağı + ziyaret bilgisi, tek satırda |
| `nav_points_view` | Başlangıç, yer işareti (duyu ipucuyla), anlatım ve varış noktaları |
| `tours_view` | Hazır turlar: başlık, açıklama, durak listesi |
| `segment_overrides` | Onaylanmış "bu yol kapalı / merdivenli" bildirimleri |

Uygulamanın hiç göremediği tablolar: veri hattının önerileri (`location_candidates`, `text_drafts`) yalnız admin içindir. İsteğe bağlı hesabın tercihlerini (`accounts`) yalnız sahibi okur.

### Pasaport, fotoğraflar ve arkadaşlar

Hesap açan kullanıcının paylaştığı her şey **varsayılan olarak yalnız kendisine** görünür. Görünürlüğü kullanıcı Gizlilik ekranında seçer: Yalnız ben / Arkadaşlar / Herkes.

```mermaid
flowchart LR
  VAR["📍 Gerçek GPS ile varış<br/>ya da 60 m içinde 'Buradayım'"] --> DAMGA["🎫 Damga (visits)<br/>eser + gün, konum yok"]
  SIM["🧪 Simülasyon"] -. damga vermez .-> DAMGA
  DAMGA --> BAS["🏅 Başarımlar<br/>cihazda hesaplanır"]
  FOTO["📷 Fotoğraf (user_photos)"] -->|Herkes| ONAY{"Admin onayı"}
  ONAY -->|yayınla| ESER["Eser sayfası<br/>Ziyaretçi fotoğrafları"]
  FOTO -->|Sezi arşivine öner| ARSIV{"Admin: arşive al"}
  ARSIV --> MEDIA["media taslağı<br/>CC BY 4.0, yükleyenin adı"]
```

- **Damga** yalnız eser ve gün olarak kaydedilir; konumun kendisi sunucuya gitmez. Hesapsız kullanıcının damgaları cihazda kalır, hesap açınca hesaba taşınır.
- **Arkadaşlık** karşılıklıdır: istek gider, karşı taraf kabul eder. Kullanıcı adıyla aranabilmek için kişinin "bulunabilirim" anahtarını açması gerekir. Engellenen kişi isteği gönderemez, profili göremez; varsa arkadaşlık silinir.
- **Kim neyi görür:** kişinin pasaportunu, başarımlarını ve katkılarını profil görünürlüğü belirler; her fotoğrafın ayrıca kendi görünürlüğü vardır. Bu kuralları veritabanı uygular (RLS), uygulama değil.
- **Katkı sayaçları** (onaylanan bildirim, yayındaki ve arşive alınan fotoğraf, arkadaş) tetikleyicilerle sayılır; kullanıcı bunları yazamaz.
- Hesap silinince fotoğraflar, damgalar ve arkadaşlıklar da silinir. Sezi arşivine alınmış kopya, verilen izin gereği kalır.

---

## 4. Admin → uygulama: içerik nasıl akar?

Kodda **sabit nokta ya da rota yoktur**. Rotayı değiştiren her şey admin panelinden veri olarak girilir.

```mermaid
sequenceDiagram
  participant A as 🖥️ Admin
  participant S as ☁️ Supabase
  participant U as 📱 Uygulama
  participant M as ⚙️ Motor

  A->>S: Nokta ekler (ör. "Koza Hanı anlatımı" + ses)
  A->>S: Durumu "Doğrulandı" yapar
  U->>S: Açılışta / öne gelince noktaları çeker
  S-->>U: Yayındaki noktalar
  U->>U: Cihaza kaydeder, sesleri indirir
  U->>M: Noktaları grafiğe uygula
  M-->>U: Yeni sürüm → ekranlar rotayı yeniden hesaplar
```

### Nokta rolleri

Bir yer birden çok rol taşıyabilir.

| Rol | Simge | Ne yapar |
|---|---|---|
| `start` | 🚩 | Başlangıç / buluşma yeri (durak, meydan) |
| `landmark` | 🗿 | Yer işareti: talimatta anılır ("Heykel hizasında sağa"), çevresindeki yolları "daha kolay bulunur" yapar |
| `story` | 💬 | Anlatım: yaklaşınca metin + ses açılır, rota buraya uğrar |
| `arrival` | 🏛️ | Esere varınca açılan bilgi |

Yer işaretinin iki ses alanı birbirinden ayrıdır:
- **Ortam sesi** (`ambient`): Yürürken ses manzarasında çalan sentez ses (§9).
- **Duyu ipucu** (`cue`): Talimat cümlesine eklenen "olabilir" cümlesi (§6).

### Turlar

Turlar da veridir. Admin **Turlar** sayfasında şunları girer: başlık, açıklama ve pilot alandaki 2–12 eserden durak listesi. İsterse sırayı kendisi sabitler. Kaydederken veritabanı iki şeyi reddeder: başka ilden ya da var olmayan bir eser, ve aynı eserin iki kez girilmesi. Düzenleme penceresinde yürüyen ve tekerlekli sandalye için mesafe canlı görünür. Yayındaki turu uygulama cihazda saklar; web de aynı tablodan okur.

### Erişilebilirlik bildirimi döngüsü

```mermaid
flowchart LR
  K["👤 Kullanıcı<br/>'Burada merdiven var'"] --> Q["📥 Cihazda kuyruk"]
  Q -->|"internet gelince"| R[("a11y_reports<br/>pending")]
  R --> AD{"🛡️ Admin"}
  AD -->|onay| O[("segment_overrides")]
  AD -->|ret| X["❌"]
  O --> ALL["📱 Herkesin grafiğine uygulanır"]
```

---

## 5. Rota motoru

Rota bulmak dört adımdır: **grafiği hazırla → her yola profile göre fiyat biç → en ucuz yolu bul → yol üstündeki noktalara uğrat.**

```mermaid
flowchart TB
  G["🗺️ Gömülü grafik"] --> W["Çalışma grafiği"]
  P["📍 Noktalar"] --> W
  O["🚧 Onaylı bildirimler"] --> W
  W --> C["💰 Her yol parçasına fiyat<br/>segmentCost · profile göre"]
  C --> D["🔎 En ucuz yol<br/>Dijkstra"]
  D --> V["↪️ Yakındaki anlatım noktalarına uğrat<br/>en çok %25 ve +300 m"]
  V --> L["🧭 Talimatları kur<br/>buildGuidance"]
  L --> R["✅ Planlanmış rota"]
```

### Fiyat (maliyet) nasıl biçilir?

Başlangıç fiyatı **yolun metre cinsinden uzunluğudur**. Profil bu fiyatı artırır, azaltır ya da yolu tamamen kapatır.

| Durum | 🚶 Yürüyen | 🦯 Bastonlu | ♿ Tekerlekli sandalye | 👁️‍🗨️ Görme engelli |
|---|---|---|---|---|
| Basamak | + 2 m / basamak | + 15 m / basamak | ⛔ yol kapalı | yürüyenle aynı |
| Eğim > %8 | — | pahalılaşır | ⛔ yol kapalı | — |
| Dar yol < 90 cm | — | — | ⛔ yol kapalı | — |
| Arnavut kaldırımı | — | × 1,4 | × 1,8 | — |
| Zemin bilinmiyor | — | düz sayılır | düz sayılır | — |
| Gürültülü cadde | — | — | — | × 2'ye kadar |
| Kaldırım kenarı | — | — | ⛔ yol kapalı | × 1,3 |
| Yer işareti görünür | %30'a kadar ucuz | %30'a kadar ucuz | %30'a kadar ucuz | (görmediği için yok) |

> **Duymayan kullanıcı:** Rotası yürüyenle aynıdır. Fark rotada değil, **ipucunun türündedir** (bkz. §9).

### Üç tür plan

```mermaid
flowchart LR
  subgraph R1["🏛️ Esere git · planRoute"]
    a1((Başla)) --> a2["💬"] --> a3["💬"] --> a4((Eser))
  end
  subgraph R2["🚶 Gezinti · planStroll"]
    b1((Başla)) --> b2["💬 en yakın"] --> b3["💬 sonraki"] --> b4["…en çok 5"]
  end
  subgraph R3["🧭 Tur · tours"]
    c1((Başla)) --> c2["🏛️ Durak 1"] --> c3["🏛️ Durak 2"] --> c4["🏛️ …"]
  end
```

| Plan | Hedef | Sınır |
|---|---|---|
| Esere git | Seçilen eser | Uğrama en çok %25 ya da +300 m uzatır |
| Gezinti | Hedef yok, anlatım noktaları | 5 nokta, bacak ≤ 500 m, toplam ≤ 1,2 km |
| Tur | Admin'in girdiği eserler | Sıra: varsayılan olarak gerçek yol mesafesiyle en kısa yürüyüş (en yakın komşu, sonra 2-opt), ya da admin'in sabitlediği sıra. Profile ulaşılamayan durak atlanır. Her durak ayrı "esere git" |

---

## 6. Talimat motoru: cümle nasıl kurulur?

Kevin Lynch'in fikri: insanlar yolu **sokak adıyla değil, gördükleri şeylerle** bulur. Bu yüzden talimat önce bir yer işaretine dayanır.

```mermaid
flowchart TB
  T["Dönüş düğümü"] --> A["Açıyı ölç"]
  A --> K{"Dönüş türü"}
  K -->|"< 20°"| S["düz devam"]
  K -->|"20°–60°"| H["hafif sağ/sol"]
  K -->|"60°–160°"| N["sağa/sola dön"]
  K -->|"> 160°"| B["geri dön"]
  S & H & N & B --> Y{"35 m içinde<br/>yer işareti var mı?"}
  Y -->|"evet, düğümde"| C1["'Koza Parkı hizasında sağa dönün.'"]
  Y -->|"evet, yakında"| C2["'Ulu Cami yakınında sağa dönün.'"]
  Y -->|"hayır"| C3["'Sağa dönün.'"]
  C1 & C2 & C3 --> U{"Önde tehlike?"}
  U -->|"merdiven"| U1["+ 'Ardından merdiven var.'"]
  U -->|"taş zemine geçiş<br/>önceki zemin biliniyorsa"| U2["+ 'Zemin arnavut kaldırımına dönüyor.'"]
  U -->|"cadde"| U3["+ 'Trafiği yoğun bir caddeye…'"]
  U -->|"yok"| Q
  U1 & U2 & U3 --> Q{"Anılan yer işaretinin<br/>duyu ipucu var mı?"}
  Q -->|"evet, bu rotada ilk kez"| Q1["+ 'Açıkken fırın kokusu gelebilir.'"]
  Q -->|"hayır"| OK["Cümle hazır"]
  Q1 --> OK
```

Ek kurallar:
- İki talimat arası **90 m'yi aşarsa** ortada teyit verilir: "Doğru yoldasınız; Okçu Baba Türbesi sağınızda." Teyitte 45 m içindeki yer işareti anılır.
- **Yön, yer işaretinin kendi konumundan hesaplanır.** Yer işareti rota için en yakın yol düğümüne bağlanır, ama "sağınızda / solunuzda" ve uzaklık o düğümden değil, yapının durduğu yerden ölçülür. Yolun solundaki fırın, düğüme bağlandı diye "önünüzde" anılmaz.
- **Duyu ipucu kuralları:**
  - Her zaman "olabilir" diye söylenir. Talimat hiçbir zaman yalnız ipucuna dayanmaz.
  - Bir yer işaretinin ipucu rotada **bir kez** söylenir; yan yana dönüşlerde aynı cami tekrar tekrar anılmaz.
  - Duymayan kullanıcıya su ve ezan ipucu söylenmez; koku ipucu herkese söylenir.
  - Bir eserin adıyla ancak nokta o esere bağlıysa söylenir. "Geyve Hanı yakınında… su sesi" gibi yanlış bir atıf çıkmaz.
  - Uygulama yalnız yayındaki ipuçlarını kullanır; bugün 60 adayın hepsi taslak.
- Tekerlekli sandalye rotasında merdiven zaten olmadığı için merdiven uyarısı verilmez.
- Rota sonunda: "Vardınız."

---

## 7. Navigasyon oturumu: yürürken ne olur?

Navigasyon ekranı üç aşamadan geçer.

```mermaid
stateDiagram-v2
  [*] --> Plan
  Plan: 📋 Plan<br/>nereden → nereye seçilir<br/>rota önizlenir
  Yurume: 🚶 Yürüyüş<br/>konum izlenir<br/>talimatlar verilir
  Varis: 🏛️ Varış<br/>eser kartı + sesi
  Plan --> Yurume: Başla
  Yurume --> Yurume: Sapma / yol kapalı<br/>→ yeniden rota
  Yurume --> Varis: Hedefe ulaşıldı
  Varis --> Yurume: Turda sonraki durak
  Varis --> [*]
```

### Her konum ölçümünde

Telefon konumu iki kaynaktan alabilir. İkisi de **aynı takip adımından** geçer; bu yüzden simülasyonda görülen davranış gerçek yürüyüşte de aynıdır.

```mermaid
flowchart LR
  GPS["📡 GPS"] --> F
  SIM["🤖 Sanal yürüyüşçü<br/>geliştirici modu"] --> F
  F["followRoute<br/>takip adımı"] --> T1["Rota üstünde<br/>ne kadar ilerledim?"]
  F --> T2["Rotadan<br/>uzaklaştım mı?"]
  F --> T3["Sıradaki talimatın<br/>zamanı geldi mi?"]
  F --> T4["Bir noktanın<br/>yarıçapına girdim mi?"]
  T2 -->|"evet"| RR["🔁 Bulunduğum yerden<br/>yeniden rota"]
  T3 -->|"evet"| SAY["🔊 Talimatı ver"]
  T4 -->|"evet"| POP["💬 Pop-up + ses"]
```

### Sapma kararı: tek sıçrama alarm değildir

GPS bazen bir anlığına 30 m sıçrar. Yanlış alarm olmasın diye:

```mermaid
flowchart LR
  M["Ölçüm"] --> D{"Rotaya uzaklık ><br/>max(20 m, doğruluk × 1,5)?"}
  D -->|hayır| OK["✅ Sayaç sıfırlanır"]
  D -->|evet| C["Sayaç +1"]
  C --> C3{"Üst üste 3 kez mi?"}
  C3 -->|hayır| M
  C3 -->|evet| R["🔁 Sapma → yeniden rota"]
```

### Talimat zamanlaması

Talimat sabit metrede değil, **yürüme hızına göre dönüşten yaklaşık 4 saniye önce** verilir. Hızlı yürüyene daha erken, yavaş yürüyene daha geç söylenir.

### Nokta pop-up'ı

- Anlatım ya da varış noktasının yarıçapına girilince **bir yürüyüşte bir kez** açılır.
- Konum doğruluğu **50 m'den kötüyse** açılmaz (sıçrayan GPS yanlış pop-up açmasın).
- Kayıt çalarken talimatlar bekler, kayıt bitince okunur.
- Nokta bir esere bağlıysa kartta eserin fotoğrafı, türü ve dönemi görünür; karta dokununca eser sayfası açılır.
- **Yoldaki eserler:** Yayında metni olan pilot eserin yanından geçerken (20 m) kısa bir anlatım kartı açılır. Rota bu eserlere sapmaz. Hedef ve turdaki eserler yolda açılmaz.

---

## 8. Ses motoru: hangi ses çalar?

Her konuşma isteği şu karar ağacından geçer:

```mermaid
flowchart TB
  S["🔊 Okunacak bir şey var"] --> R{"Admin'in yüklediği<br/>ses kaydı var mı?<br/>(nokta / eser)"}
  R -->|evet| REC["🎙️ İnsan kaydı çalar"]
  R -->|hayır| L{"Dil?"}
  L -->|EN| DEV["📱 Cihaz sesi"]
  L -->|TR| B{"Uygulamaya<br/>gömülü mü?"}
  B -->|evet| CH1["✨ Chirp · anında, internetsiz"]
  B -->|hayır| C{"Daha önce<br/>indirildi mi?"}
  C -->|evet| CH2["✨ Chirp · internetsiz"]
  C -->|hayır| N["☁️ Sunucudan iste"]
  N --> W{"Zamanında geldi mi?<br/>talimat 1,5 sn · anlatım 8 sn"}
  W -->|evet| CH3["✨ Chirp"]
  W -->|hayır| DEV2["📱 Cihaz sesi<br/>(indirme arkada sürer,<br/>sonraki sefere hazır)"]
```

### Chirp sesi nasıl üretilir ve saklanır?

Aynı cümle **dünyada bir kez** üretilir. Sonra hem sunucuda hem telefonda saklanır.

```mermaid
sequenceDiagram
  participant U as 📱 Uygulama
  participant F as ☁️ tts fonksiyonu
  participant D as 🗄️ Dosya deposu
  participant B as 📊 Günlük sayaç
  participant G as 🔷 Google Chirp

  U->>F: "Sola dönün." + ses adı
  F->>F: Metni düzelt, parmak izini çıkar
  F->>D: Bu dosya var mı?
  alt Var (önbellek)
    D-->>F: Evet
    F-->>U: Dosya adresi
  else Yok
    F->>B: 13 karakter ayır
    alt Günlük sınır doldu (30.000)
      B-->>F: Hayır
      F-->>U: 429 → cihaz sesi
    else Yer var
      B-->>F: Tamam
      F->>G: Seslendir
      G-->>F: MP3
      F->>D: Kaydet
      F-->>U: Dosya adresi
    end
  end
  U->>U: Telefona kalıcı kaydet
```

### Üç katmanlı önbellek

| Katman | İçinde | İnternet gerekir mi? | Ne zaman dolar |
|---|---|---|---|
| 📦 Uygulamaya gömülü | 28 sabit cümle ("Sola dönün.", "Vardınız."…) | Hayır | Uygulama paketlenirken |
| 💾 Telefon | Bir kez çalınmış / önceden indirilmiş cümleler | Hayır | Rota hesaplanınca, noktalar gelince |
| ☁️ Sunucu | Herkesin ürettiği tüm cümleler | Evet | İlk istendiğinde |

> Rota hesaplandığı anda o rotanın bütün talimatları arka planda indirilir. Kullanıcı yürümeye başladığında sesler genellikle telefondadır.

### Konuşma sırası

- Yeni talimat, okunmakta olanı **kesmez**; bitmesini bekler.
- Beklerken daha yenisi gelirse eskisi atılır (artık geçersizdir).
- Acil mesajlar (yol kapalı, rota değişti) **hemen** okunur, öncekini keser.

---

## 9. Ses manzarası (soundscape)

Görme engelli kullanıcı yer işaretlerini **sesinden** tanır: çeşmeden su sesi, handan çarşı uğultusu, diğer yapılardan yumuşak bir ton gelir. Sesler şimdilik sentezlenir; saha kayıtları gelince değişecek. Sesin yönü de talimattaki gibi **yapının kendi konumundan** hesaplanır.

```mermaid
flowchart LR
  Y["🧍 Kullanıcı<br/>konum + baktığı yön"] --> M["soundscapeMix"]
  L["🗿 Yer işaretleri"] --> M
  M --> V1["Uzaklık → ses düzeyi<br/>8 m'de tam · 60 m'de sıfır"]
  M --> V2["Yön → sağ/sol kulak<br/>stereo"]
  M --> V3["En yüksek 3 ses"]
  V1 & V2 & V3 --> O["🎧 Kulaklık"]
```

| Eser türü | Ortam sesi |
|---|---|
| Çeşme, sebil, hamam, sarnıç | 💧 su |
| Han, çarşı, kervansaray | 🛍️ çarşı |
| Diğerleri (cami dahil) | 🔔 ton |

> Ezan gibi dinî bir ses sentezlenip çalınmaz. Camiden gelebilecek gerçek ezan yalnız talimattaki "olabilir" cümlesiyle anılır (§6).

---

## 10. Profile göre ipucu

Kurala göre **her ses ipucunun görsel ve dokunsal bir karşılığı vardır.** Profil hangisinin öne çıkacağını seçer.

| Profil | 🔊 Ses | 👀 Görsel | 📳 Titreşim |
|---|---|---|---|
| Yürüyen | ✅ talimat | ✅ harita + kart | ✅ |
| Görme engelli | ✅ talimat + ses manzarası | — | ✅ |
| Az gören | ✅ | ✅ tek renkli, yüksek kontrast | ✅ |
| Duymayan | ❌ | ✅ ekran kenarı parlar (`CueFlash`), talimat metni ekranda; su ve ezan ipucu yazılmaz, koku ipucu kalır | ✅ |
| Gürültülü ortam (elle açılır) | ❌ geçici | ✅ parlama | ✅ |

---

## 11. İnternet olmadan ne çalışır?

| Özellik | İnternetsiz | Neden |
|---|---|---|
| Rota hesabı | ✅ | Grafik uygulamanın içinde |
| Noktalar (başlangıç, anlatım, duyu ipuçları…) | ✅ son bilinen hâl | Cihazda saklanır |
| Turlar | ✅ son bilinen hâl | Cihazda saklanır |
| Nokta ses kayıtları | ✅ indirildiyse | Önceden indirilir |
| Noktalara bağlı eserlerin kartı ve sayfası | ✅ | Eşitlemede cihaza alınır |
| Yoldaki eserlerin anlatımı | ✅ | Metin cihazda, Türkçe sesi önceden indirilir |
| Sabit Türkçe talimatlar | ✅ | Uygulamaya gömülü |
| Rotanın diğer talimatları | ✅ rota internetliyken hesaplandıysa | Önceden indirilir |
| Yeni bir Türkçe cümle | ⚠️ cihaz sesiyle | Sunucuya ulaşılamaz |
| Keşfet'teki eser listesi, fotoğraflar | ❌ | Henüz çevrimdışı önbellek yok |

---

## 12. Admin rota testi: telefonsuz deneme

Admin panelindeki **Rota testi**, telefondaki motorun **aynısını** tarayıcıda çalıştırır. Rota davranışı değişince önce burada bakılır.

```mermaid
flowchart LR
  subgraph shared["⚙️ packages/shared (tek kaynak)"]
    P["Planlayıcı"]
    W["Sanal yürüyüşçü"]
    F["Takip adımı"]
  end
  shared --> APP["📱 Uygulama"]
  shared --> RT["🖥️ Rota testi"]
  RT --> X1["Profil karşılaştırması<br/>4 profil, aynı harita"]
  RT --> X2["Senaryolar<br/>yol kapat · yanlış dön"]
  RT --> X3["Zaman damgalı kayıt"]
  RT --> X4["Taslak noktalar dahil<br/>yayınlamadan dene"]
```

**Taslak noktaları dahil et** açıkken taslak noktalar da rotaya girer. Yeni bir yer işareti ya da duyu ipucu, uygulamaya çıkmadan önce burada denenir.

---

## 13. Web sitesi

`sezi.info`, Next.js ile yazıldı ve `/tr` ile `/en` altında iki dilde çalışır.

- **Sayfalar:** Eser, il ve külliye sayfaları sunucuda üretilir ve 10 dakikada bir yenilenir, böylece arama motorları içeriği görür. Bu sayfalarda da yalnız yayındaki içerik görünür.
- **Ortak motor:** Rota, tur ve bildirim sayfaları uygulamayla aynı motoru ve aynı gömülü grafiği kullanır. Mesafeler ve durak sırası telefondakiyle aynı çıkar.
- **Harita:** Harita mobildekiyle aynı görünür: 3B binalar, Lynch bölgesi, tür renginde yer işareti blokları ve tür simgeleri. Simge çizimi ve bina verisi ortak pakette tutulur.
- **Sade görünüm:** Yüksek kontrastta ve "az gören" profilinde harita tek renkli ve düz olur. Hareket azaltma açıksa harita eğik bakış yerine yukarıdan görünür; tercih değişince sayfa yenilenmeden uygulanır.

---

## Sözlük

| Terim | Anlamı |
|---|---|
| **Düğüm (node)** | Yolların kesiştiği nokta |
| **Segment** | İki düğüm arasındaki yol parçası |
| **Yer işareti (landmark)** | Akılda kalan, görünen yapı: heykel, çeşme, cami |
| **Maliyet** | Bir yolun profile göre "zahmeti"; motor en az zahmetli yolu seçer |
| **Dijkstra** | En ucuz yolu bulan klasik algoritma |
| **Uğrama (via)** | Rotanın hedefe giderken bir anlatım noktasından geçmesi |
| **Tur** | Admin'in seçtiği eserlerden oluşan hazır gezi; sırayı uygulama hesaplar ya da admin sabitler |
| **Duyu ipucu (cue)** | Yer işaretine eklenen "olabilir" cümlesi: su sesi, fırın kokusu, ezan |
| **Taslak (draft)** | Veri hattının ya da admin'in girdiği, henüz onaylanmamış içerik; uygulama ve web görmez |
| **Sapma** | Kullanıcının rotadan uzaklaşması |
| **Chirp 3 HD** | Google'ın doğal Türkçe sentetik sesi (Laomedeia) |
| **RLS** | Veritabanında "kim hangi satırı görür" kuralı |
| **verified / draft** | Yayında / taslak |
| **Edge function** | Sunucuda çalışan küçük fonksiyon (`tts`) |
