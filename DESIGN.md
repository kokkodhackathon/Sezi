---
name: Sezi
description: "Çini" — önce fotoğraf, az yazı; sıcak beyaz zemin, İznik turkuazı, mercan kırmızısı yalnızca vurguda.
colors:
  light-background: "#FAF7F2"
  light-surface: "#FFFFFF"
  light-soft: "#F1ECE5"
  light-text: "#1E1A17"
  light-text-muted: "#5F5650"
  light-primary: "#0B6E73"
  light-on-primary: "#FFFFFF"
  light-accent: "#B8321F"
  light-on-accent: "#FFFFFF"
  light-danger: "#8E1F1A"
  light-border: "#ECE6DE"
  dark-background: "#161311"
  dark-surface: "#211C19"
  dark-soft: "#2A2420"
  dark-text: "#F2EDE7"
  dark-text-muted: "#B5ABA2"
  dark-primary: "#6FC7C4"
  dark-on-primary: "#161311"
  dark-accent: "#F08A70"
  dark-on-accent: "#161311"
  dark-danger: "#F28B82"
  dark-border: "#332C27"
  high-contrast-background: "#FFFFFF"
  high-contrast-surface: "#FFFFFF"
  high-contrast-text: "#000000"
  high-contrast-text-muted: "#1E1A17"
  high-contrast-primary: "#064C50"
  high-contrast-on-primary: "#FFFFFF"
  high-contrast-accent: "#8E1F1A"
  high-contrast-on-accent: "#FFFFFF"
  high-contrast-danger: "#8E1F1A"
  high-contrast-border: "#000000"
typography:
  hero:
    fontFamily: Fraunces_700Bold
    fontSize: "44px"
    fontWeight: 700
    lineHeight: "50px"
    letterSpacing: "-0.5px"
  display:
    fontFamily: AtkinsonHyperlegibleNext_700Bold
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.3px"
  title:
    fontFamily: AtkinsonHyperlegibleNext_600SemiBold
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "34px"
  editorial:
    fontFamily: Fraunces_600SemiBold
    fontSize: "32px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "-0.3px"
  heading:
    fontFamily: AtkinsonHyperlegibleNext_700Bold
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "26px"
  item-title:
    fontFamily: AtkinsonHyperlegibleNext_600SemiBold
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: AtkinsonHyperlegibleNext_400Regular
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "26px"
  lead:
    fontFamily: AtkinsonHyperlegibleNext_400Regular
    fontSize: "19px"
    fontWeight: 400
    lineHeight: "28px"
  meta:
    fontFamily: AtkinsonHyperlegibleNext_400Regular
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
  button:
    fontFamily: AtkinsonHyperlegibleNext_700Bold
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.light-text}"
    textColor: "{colors.light-background}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-outline:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.light-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-danger:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-danger}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  field:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  chip-selected:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
---

## Çini ilkeleri (14 Ekim 2026)

- **Kaynak:** Bursa vakıf eserlerinin kubbe ve çini süslemeleri (envanter fotoğraf arşivi). Turkuaz, mercan kırmızısı, beyaz ve koyu mürekkep.
- **Önce fotoğraf, sonra yazı.** Liste ve kartlar fotoğrafla açılır; fotoğrafı olmayan eser yumuşak dolgulu alanda tür simgesiyle gösterilir. Uzun açıklama yerine tek satır (tür · ilçe); ayrıntı eser sayfasında ve ekran okuyucu etiketinde.
- **Kutu yerine boşluk.** Kartlar çerçevesiz, yumuşak gölgeli (`softShadow`); etiketler dolu küçük hap; ayraçlar ince.
- **Renk görevi:** turkuaz etkileşim (düğme, seçili şerit), mercan yalnızca vurgu (UNESCO, haritada hedef, seçili nokta). Renk tek başına anlam taşımaz.
- **Yazı:** eser, tur, il adları ve ekran başlıkları Fraunces; arayüz, talimat ve okuma metni Atkinson Hyperlegible Next.
- **Açık tema birincildir**; koyu tema ayarlardan seçilir, az gören profili yüksek kontrast temasını kullanır.
- **Simülasyon** (sanal yürüyüş, jüri senaryoları, profillere göre rota, cihaz testleri) yalnızca Ayarlar → Geliştirici seçenekleri → Simülasyon modu açıkken görünür.


# Design System: Sezi

## Overview

**Creative North Star: "Sıcak çağdaş kültür rehberi"**

Sezi'nin kültürel kimliği krem sayfa, kahve mürekkep, sade eser çizimleri ve sınırlı serif kullanımıyla görünür. Arayüzün ritmini süsleme yerine okunabilir başlıklar, kaynak satırları ve açık eylemler kurar. Erişilebilirlik, palet ve bileşen kararlarının parçasıdır.

Bu belge uygulanmış React Native / Android kaynaklarını kaydeder. Frontmatter'daki `px` birimi taşınabilir şemanın gösterimidir; uygulamada boşluk ve köşe değerleri dp, yazı değerleri React Native'in ölçeklenebilir yazı ölçüleridir. Bileşen renkleri açık tema örneğidir; uygulama karşılıklarını `useSeziTheme()` üzerinden seçer. Web hover, CSS düzeni veya masaüstü breakpoint'i tanımlanmaz.

**Key Characteristics:**
- Krem sayfa üzerinde sade beyaz yüzeyler.
- Ana eylem ve seçili durum için turkuaz.
- Okuma ve yönlendirmede Atkinson; eser ve tur başlığında Fraunces.
- Kaynak ve konum kesinliğini görünür tutan içerik düzeni.
- Karşılamada tek küçük kültürel işaret.

## Colors

Renklerin kaynağı `packages/shared/src/theme.ts`; ham moodboard paleti arayüze doğrudan uygulanmaz.

### Primary
- **Derin turkuaz:** açık temada ana düğme, seçili kontrol, eylem simgesi ve yön işareti.
- **Açık turkuaz:** koyu temada aynı roller; metin eşleşmesi `onPrimary` ile değişir.
- **Yüksek kontrast turkuaz:** az gören profilinin ana eylem rengi.

### Secondary
- **Pas:** marka ayrıntısı ve anlam taşıyan vurgu; kartların genel dolgu rengi değildir.
- **Koyu kırmızı:** tehlike ve olumsuz durum; açıklama metniyle birlikte gösterilir.

### Neutral
- **Krem / beyaz:** sayfa ile kart, alan ve seçili kontrol ayrımı.
- **Kahve mürekkep / soluk kahve:** ana metin ile ikincil bilgi ayrımı.
- **Kum çizgisi:** liste ayırıcıları ve yüzey sınırları.
- **Gece / yükseltilmiş gece:** koyu temanın sayfa ve yüzey ayrımı.
- **Siyah / beyaz:** yüksek kontrast temasının metin ve sınırları.

**The Anlamlı Renk Rule.** Seçili durum, uyarı ve konum kesinliği renk yanında metin, sınır veya erişilebilirlik durumuyla da ifade edilir.

## Typography

**Display Font:** ekran başlığı ve rehberlikte Atkinson Hyperlegible Next; marka adında Fraunces.
**Body Font:** Atkinson Hyperlegible Next.

Frontmatter, `apps/mobile/src/design/type.ts` içindeki yeniden kullanılan rolleri kaydeder. Ekran başlığı `display`, bölüm başlığı `heading`, eser satırı `itemTitle`, okuma `body`, kaynak ve yardımcı bilgi `meta`, kontroller `button` kullanır. `hero` marka adına; `editorial` eser ve tur adına ayrılır. Yazı tipleri Expo üzerinden yüklenen gerçek font varlıklarıdır; sistem fontuyla hazırlanmış bir başlık standardı yoktur.

**The İki Ses Rule.** Atkinson işlemi ve yön talimatını; Fraunces eser, tur ve marka kimliğini taşır. Serif yön talimatlarına taşınmaz.

**The Tek Başlık Rule.** `ScreenHeader` bir ekran başlığı ve gerektiğinde alt açıklama gösterir; yinelenen dekoratif üst başlık göstermez.

## Layout

Ana ekranların yatay payı `space.xl`; içerik tek sütunlu ve dikey kaydırılabilirdir. Liste satırları yatay simge, esnek metin grubu ve sağ eylem işareti kullanır. Satır başlıkları ile kaynaklar ayrı satırlara yerleşir. Boşluk ölçeği küçük grup içi aralıktan ekran kenarına kadar frontmatter'daki altı değerden oluşur; içerik bölüm aralıkları gerektiğinde ekran stilinde ayrıca tanımlanır.

Keşfet listeyle açılır; harita bir görünüm seçeneğidir. Şehir ve filtreler, alt kenardan açılan native `Modal` içinde kaydırılabilir seçeneklere sahiptir. Görsel rehberlikte ana talimat kaydırılabilir sahnede, yürütme kontrolleri alt bölümde kalır. Bunlar ekran örnekleridir; her yeni ekrana aynı kompozisyon dayatılmaz.

En küçük etkileşim alanı 48 dp; standart düğme ve alan 56 dp, kompakt düğme 48 dp, ortak liste satırı en az 64 dp'dir. Sabit yükseklik yerine minimum yükseklik kullanılır. `Segmented`, yazı ölçeği 1,5'i geçtiğinde dikeyleşir. `SafeAreaView` ve alt panel inset'leri sistem kenarlarını korur.

## Elevation & Depth

Örneklenen ortak bileşenlerde gölge veya native elevation yoktur. Derinlik krem/beyaz ya da koyu tema yüzey ayrımı, bir dp sınır ve ayırıcı çizgiyle oluşur. Modal arka planı tema metninin `66` alfa uzantısıyla kararır; bu etkileşim katmanıdır, dekoratif gölge değildir.

## Shapes

Kontrol ve alanlar orta köşe, kart ve haritalar büyük köşe, seçeneğin iç yüzeyi küçük köşe kullanır. Chip'ler kapsül biçimindedir. Alt panelin üst köşesi ekran kaynağında ayrıca 24 dp'dir; kart köşesinin yerine genel bir yeni ölçek olarak kullanılmaz.

Karşılama ekranındaki `CengelMark` 40 dp'dir. Yüksek kontrast temasında gösterilmez. Dekoratif kilim bantları ve büyük madalyonlar yeniden kullanılan ekran dili değildir.

## Components

### Buttons

Ana düğme turkuaz; ikincil düğme metin renginde dolgu; outline beyaz yüzey üzerinde turkuaz sınır; ghost saydam; danger yüzey üzerinde tehlike rengi kullanır. Basılı durumda opacity 0,85, devre dışıyken 0,4'tür. Bunlar mevcut durum değerleridir; gelecekte tüm kontrollere evrensel bir kontrast garantisi olarak uygulanmaz. Etiket ortalıdır, dar alanda küçülebilir; erişilebilir rol, etiket ve disabled durumu taşınır.

### Chips

Seçili chip turkuaz dolgu ve `onPrimary` metin; diğerleri yüzey dolgusu ve sınır kullanır. Seçili durum erişilebilirlik ağacında da belirtilir. Metin 15 boyutlu kalın Atkinson'dır; dokunma alanı en az 48 dp'dir.

### Cards / Containers

`Card` yüzey dolgusu, bir dp sınır ve büyük köşe taşır; varsayılan iç pay `space.lg` olur. `padded={false}` liste gruplarına ayrılır. `ListRow` ilk satırdan sonra üst ayırıcı kullanır. Basılı satır sayfa rengine geçer; genel gölge eklenmez.

### Inputs / Fields

`Field` görünür etiket, beyaz yüzey, orta köşe ve okunabilir sınır kullanır. Hata durumunda sınır ve hata metni danger olur; hata metni polite live region taşır. Çok satırlı alan en az 120 dp'dir. Özel focus halkası kaynakta uygulanmış değildir; yeni bir uygulanmış standart gibi kaydedilmez.

### Navigation

Alt gezinme `NativeTabs` ile platformun gerçek sekme bileşenidir. Dört sekmenin yazılı etiketi görünür; Atkinson normal durumda yarı kalın, seçili durumda kalındır. Native sekme etiketi 12 boyutlu istisnadır; dar ekranda büyütülmüş İngilizce etiketlere yer açar. Seçili simge ve yazı turkuaz, göstergesi primary renginin `2E` alfa uzantısıdır. Uygulama SVG eylem simgeleri ile platform sekme ikonlarını aynı renderer'a dönüştürmez.

### Guidance / CueFlash

Yön işareti ve 32/40 Atkinson talimat ana odağı oluşturur. Kalan mesafe, simülasyon açıklaması ve erişilebilir ilerleme çubuğu ayrı bilgidir. İşitme profiline bağlı görsel ipucu dekoratif hareket değildir: normalde ekran kenarında iki parlama; reduce motion'da 1.500 ms sabit çerçeve gösterir. Simülasyon gerçek GPS yönlendirmesi diye sunulmaz.

## Do's and Don'ts

### Do:
- **Do** renkleri `useSeziTheme()` üzerinden ve eşleşen metin token'ıyla kullan.
- **Do** ekranları mevcut ortak bileşenlerle ve en az 48 dp dokunma alanıyla kur.
- **Do** uzun metni ve büyük yazıyı kaydırılabilir, esnek yerleşimde tut.
- **Do** kaynak, konum kesinliği ve simülasyon durumunu okunur metinle göster.
- **Do** her ses ipucunun görsel ve haptik karşılığını koru.

### Don't:
- **Don't** fotoğraf, tarihçe veya doğrulanmamış eser bilgisi uydur.
- **Don't** ana arayüze dekoratif bantlar veya tekrar eden üst başlıklar ekle.
- **Don't** Fraunces'i kontrollerde veya yön talimatlarında kullan.
- **Don't** renkleri tek başına durum göstergesi yap.
- **Don't** yeni harita ekranında MapLibre Marker kullan; DeferredMap ve GeoJSON katmanlarını koru.
