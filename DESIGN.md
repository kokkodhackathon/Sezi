---
name: Sezi
description: "Çini 2" — önce fotoğraf, az yazı; sıcak kırık beyaz zemin, mürekkep siyahı metin, kimlik rengi pastel firuze; düz yüzeyler, ölçülü hareket.
colors:
  light-background: "#F6F4F0"
  light-surface: "#FFFFFF"
  light-soft: "#ECE8E1"
  light-text: "#16151A"
  light-text-muted: "#5E5A64"
  light-primary-fill: "#A8E0D6"
  light-primary-ink: "#0F4A44"
  light-primary-text: "#0F4A44"
  light-accent-fill: "#FDE3DA"
  light-accent-ink: "#9A361D"
  light-danger: "#B3261E"
  light-border: "#E2DED6"
  dark-background: "#111014"
  dark-surface: "#1C1B20"
  dark-soft: "#26252B"
  dark-text: "#F3F1F5"
  dark-text-muted: "#ABA7B3"
  dark-primary-fill: "#7FCFC3"
  dark-primary-ink: "#06302B"
  dark-primary-text: "#8FD8CC"
  dark-danger: "#FFB4AB"
  high-contrast-background: "#FFFFFF"
  high-contrast-text: "#000000"
  high-contrast-primary-fill: "#064C50"
  high-contrast-primary-ink: "#FFFFFF"
  high-contrast-border: "#000000"
typography:
  fonts: "Nunito 700/800 (başlık, kart, düğme, etiket) · Atkinson Hyperlegible Next 400/600/700 (okuma, yardımcı bilgi, yön talimatı)"
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
---

# Sezi tasarım sistemi: Çini 2 (19 Ekim 2026)

Tüm mobil ekranlar bu sistemi kullanır. Önceki "Çini" sistemi (Fraunces başlıklar, derin turkuaz, `useSeziTheme`, native sekme çubuğu) ve ilk "Pastel Çini" denemesi (krem zemin, nane/şeftali, her yerde kapsül; modern bulunmadı) kaldırıldı.

## İlkeler

1. **Sade:** bir ekranda bir ana iş; filtre ve görünüm seçimi aramada, ana sayfada değil.
2. **Az yazı, önce görsel:** fotoğraf, tür glifi ve renkli kutucuk anlatır; ayrıntı eser sayfasında ve ekran okuyucu etiketinde. Fotoğrafı olmayan eser tür tonunda dolgu ve glifle gösterilir.
3. **Sakin zemin, tek kimlik rengi:** sıcak kırık beyaz zemin, mürekkep siyahı metin; ana renk **pastel firuze** (Bursa Yeşil Türbe çinileri, pilot alanın rengi). Firuze dolgu koyu firuze yazıyla okunur, beyazla değil. Yumuşak tonlar tür kutucuklarında ve fotoğrafsız kartlarda.
4. **Düz yüzey:** kartlar beyaz yüzey, gölgesiz; ayrım dolgu tonuyla ve ince çizgiyle yapılır. Gölge yalnız yüzen öğelerde (sekme çubuğu, pilot kartı, harita üstü kontroller, alt kart) ve çok hafif.
5. **Ölçülü hareket:** her hareketin bir nedeni var; kısa, ease-out, çıkış girişten hızlı. Reduce motion'a uyulur.
6. **Renk tek başına anlam taşımaz:** seçili durum dolgu yanında kalın yazı, ✓, dolu simge ya da çerçeveyle de gösterilir; tür farkını glif silueti verir.

## Renk

Kaynak `packages/shared/src/sweet-theme.ts` (`sweetThemes`: `light`, `dark`, `highContrast`); uygulamada `useSweetTheme()` (`apps/mobile/src/hooks/use-sweet-theme.ts`). Öncelik: az gören profili → yüksek kontrast; sonra Ayarlar'daki tema; "Cihaz" ise sistem tercihi. Tüm metin/zemin çiftleri `sweet-theme.test.ts`'te WCAG AA (≥ 4.5) ile doğrulanır.

| token | açık | koyu | görev |
|---|---|---|---|
| background / surface / soft | `#F6F4F0` / `#FFFFFF` / `#ECE8E1` | `#111014` / `#1C1B20` / `#26252B` | sayfa / kart / dolgulu alan (arama, seçenek, not, ikon düğmesi) |
| text / textMuted | `#16151A` / `#5E5A64` | `#F3F1F5` / `#ABA7B3` | ana ve ikincil metin |
| primary (fill / ink) | `#A8E0D6` / `#0F4A44` | `#7FCFC3` / `#06302B` | ana düğme, seçili hap, pilot kartı; `ink` yalnız `fill` üstünde |
| primaryText | `#0F4A44` | `#8FD8CC` | ana rengin zemin üstündeki hâli: bağlantı, ghost düğme, ikon, çizgi; seçili tür kutucuğunun dolgusu |
| accent (fill / ink), accentText | `#FDE3DA` / `#9A361D`, `#9A361D` | `#3D241C` / `#FFC6B3`, `#FFC6B3` | vurgu: UNESCO rozeti, uyarı, hedef |
| danger | `#B3261E` | `#FFB4AB` | tehlike ve olumsuz durum (yanında metin) |
| nav | çubuk `#FFFFFF`, yazı `#5E5A64`, seçili gösterge `#A8E0D6` / simge `#0F4A44` | `#1C1B20`, `#ABA7B3`, `#7FCFC3` / `#06302B` | sekme çubuğu |
| tones | cobalt `#E4E8FC`/`#2A3C9C`, teal `#DBF0EB`/`#1C5D55`, coral `#FDE3DA`/`#9A361D`, saffron `#FAEDCB`/`#6E520A`, sage `#E4EDDC`/`#3B5728`, plum `#F2E1EE`/`#7A3266` | koyu karşılıkları | tür rengi (`design/sweet/tones.ts`): cami kobalt, medrese/kütüphane safran, türbe erik, çeşme/sebil firuze, hamam/imaret mercan, diğerleri adaçayı |

**Yüksek kontrast** (az gören profili, `outlined: true`): dolgu ve gölge yok; beyaz zemin, siyah metin; yüzeyler 2 dp siyah çerçeveyle ayrılır (`outline(t)`); ana eylem koyu firuze üstünde beyaz; sekme çubuğunda seçili simge siyah gösterge içinde beyaz.

Harita (Mapbox Standard) kara zemini `t.background`; yol, park ve su için `components/map` içinde açıklamalı üç doğal harita sabiti var. Kendi stil dosyamız yok: Standard'ın ayarları (`basemap` import'u) ve üstüne slotlu katmanlar (rota `middle`, noktalar `top`).
- **3B:** Standard binaları açık, etkileşimli haritada 45° eğik bakış. Az gören profili, yüksek kontrast ve hareket azaltmada düz (tepeden) bakış; az görende ve yüksek kontrastta harita tek renkli, 3B bina yok.
- **Lynch dili:** pilot alan **bölgesi** (Ulu Cami ve Hanlar) hafif firuze dolgu ve kesikli kenarla (`bottom` slotu); **yer işareti** binaları tür tonunda, yarı saydam 3B blok (Mapbox'ın binasından 1 m yüksek). 3B kapalıyken aynı yerde düz dolgu ve kalın kenar. Veri `data/build_buildings.py` ile üretilir, uygulamaya gömülüdür.
- **İşaretler:** eser ve yer işareti noktaları tür simgesidir (`WorkGlyph` silueti, yüzey renginde yuvarlak, kenar ve glif tür mürekkebinde); seçili simge ~1,25 kat büyür, kümede seçili eserin altında vurgu halkası. Renk tek başına anlam taşımaz: türü siluet anlatır. Numaralı anlatım durakları her zaman en üstte. Nokta tabanları da resimdir (daire katmanı değil): 3B binanın arkasında soluklaşmaz.
- **Web (`apps/web/src/components/map`):** aynı kurallar. Glif çizimi `shared/glyphs.ts`, bina verisi ve 3B sabitleri `shared/pilot-buildings.ts` (mobil gömülü dosyayı okur). Sade harita yüksek kontrastta ve kayıtlı profil az görense; eğik bakış `prefers-reduced-motion`'da kapalı. Web'de rota çizgileri `top` slotunda (binaların üstünde); numaralı durak ve başlangıç daire kalır.

## Tipografi

`apps/mobile/src/design/type.ts`. İki yazı tipi:
- **Nunito** (700/800, yuvarlak): ekran, eser ve tur başlıkları, kart adı, düğme ve etiketler.
- **Atkinson Hyperlegible Next** (Braille Institute, az gören okurlar için): okuma metni, yardımcı bilgi ve **yön talimatı** (`display`). Yön talimatına yuvarlak başlık yazısı taşınmaz.

Roller: `hero` 34 (ana sayfada şehir adı), `screenTitle` 30, `editorial` 28 (eser/tur adı), `display` 32/40 Atkinson (yön talimatı), `title` 22, `heading` 19, `itemTitle` 17, `cardTitle` 16, `body` 17/26, `lead` 19/28, `meta` 15, `eyebrow` 15, `button` 17, `bubble` 14, `tab` 12. Okuma metni 17/26'nın altına inmez. Büyük harf `upper(text, lang)` ile (Türkçe i/İ).

## Biçim ve yerleşim

- Köşeler `radius`: `sm` 10 (çip, rozet, sekme göstergesi), `md` 16 (düğme, alan, seçenek satırı), `lg` 22 (kart, fotoğraf, harita), `xl` 28 (büyük kart, alt panel). Kapsül yalnız sayaç ve yuvarlak ikon düğmesinde. iOS'ta `borderCurve: 'continuous'`.
- Boşluk `space` (4 / 8 / 12 / 16 / 24 / 32); ana ekranların yatay payı `space.xl`.
- En küçük dokunma alanı 48 dp; düğme 54 dp (kompakt 48), liste satırı en az 64 dp. Sabit yükseklik yerine minimum yükseklik. `Segmented`, yazı ölçeği 1,5'i geçince dikeyleşir. `SafeAreaView` ve panel inset'leri sistem kenarlarını korur.
- Keşfet bir görsel vitrindir: şehir adı (dokununca şehir paneli), arama alanı, pilot kartı, tür kutucukları, öne çıkan fotoğraflar, iki sütunlu ızgara. Liste/harita geçişi ve ilçe filtresi arama ekranındadır.

## Sekme çubuğu

`apps/mobile/src/components/app-tabs.tsx` (`expo-router/ui`). Ekran kenarlarından 16 dp ayrık, içeriğin üstünde yüzen beyaz yüzey (22 köşe, ince çizgi, hafif gölge); çevresi saydamdır, kaydırılan içerik arkasından geçer. Sekme ekranları kaydırma kapsayıcısının alt payına `useTabBarSpace()` verir (Sor ekranında yazı alanı çubuğun üstünde durur). Dört sekmenin yazısı her zaman görünür (12 boyut istisnadır); seçili sekmede simge firuze göstergede (60×32, 10 köşe) dolu çizilir ve yazı kalınlaşır. Klavye açıkken gizlenir. Bırakılan denemeler: koyu yüzen kapsül (uygulamanın diliyle uyuşmadı), ekrana yapışık çubuk (kullanıcı yüzen biçimi istedi).

## Hareket

`apps/mobile/src/design/sweet/motion.ts` (Reanimated):
- Basma (`SoftPressable`): 0.96'ya küçülme 140 ms, geri dönüş 200 ms, `cubic-bezier(0.23, 1, 0.32, 1)`.
- Kart girişi (`FadeInItem`): 8 dp yukarı + opacity, 260 ms, öğeler arası 50 ms; 6. öğeden sonra gecikme artmaz.
- Tür kutucuğu seçimi: koyu firuze dolgu ve 1.05'e hafif sekme (yay, 350 ms, sönüm 0.7); seçim haptik verir.
- Sekme değişimi: seçili gösterge 150 ms'de yatayda açılır (sık tekrarlanan eylem, kısa).
- Alt panel (`SweetSheet`): 320 ms `cubic-bezier(0.32, 0.72, 0, 1)` ile kayarak açılır, 200 ms'de kapanır; arka plan 150 ms söner.
- Nokta kartı (`PointPopup`, yürüyüşte kendiliğinden açılır): 24 dp aşağıdan + opacity, 260 ms ease-out; aynı kenara 200 ms'de iner. Reduce motion: yalnız opacity.
- Navigasyon: talimat kartı yürüyüş başlarken bir kez `FadeInItem` ile girer; adım değişimi canlandırılmaz (görsel karşılığı CueFlash). Varış kartında başlık, fotoğraf, ad ve metin sırayla gelir; düğmeler hemen kullanılabilir.
- Onboarding: her adımın içeriği `FadeInItem` ile belirir (ileri/geri aynı).
- Fotoğraf kartı uzun basma: önizleme paneli açılır + hafif titreşim; ekran okuyucuda aynı önizleme özel eylemle.
- Şehir haritası: seçilen il işareti 150 ms'de hafif büyür + seçim titreşimi; seçili il metinle de yazılır. Reduce motion: ölçek yok.
- Navigasyon alt paneli: tutamaçtan sürüklenir, iki yüksekliğe yayla (300 ms, sönüm 0.8, parmağın hızıyla) oturur, sınırda lastik direnç; oturduğu anda hafif titreşim. Tutamaç aynı zamanda aç/kapat düğmesidir. Reduce motion: anında konum.
- Sor: yalnız yeni eklenen balon 8 dp + opacity ile girer; yanıt beklenirken üç nokta (reduce motion'da sabit metin) ve ekran okuyucu duyurusu.
- Boş durum motifi: çengel parçaları 50 ms arayla belirir (~560 ms, nadir an). Reduce motion: tek fade.
- Segmented ve Chip: seçim değişince seçim titreşimi.
- Canlandırılmayanlar: sekme ve ekran geçişleri (platform), ilerleme çubuğu, harita kamerası, liste kaydırma.
- Yükleniyor iskeleti: gri blok 900 ms'de nefes alır.
- Reduce motion açıkken ölçek ve kayma kalkar; yalnız opacity değişir (basınca 0.8, panel 150 ms söner).

## Bileşenler

- `apps/mobile/src/components/ui.tsx`: `Button` (`primary` firuze, `secondary` gri dolgu, `outline`, `ghost` yalnız yazı, `danger`), `Card` (beyaz, 22 köşe, gölgesiz), `ListRow` / `ToggleRow` (kart içinde ince çizgiyle ayrılır), `Segmented` (gri ray, seçili parça beyaz), `Chip` (gri; seçili firuze + kalın), `Badge`, `EmptyState`, `Field`, `Note`, `SectionTitle`, `Eyebrow`.
- `Field`: üstte etiket, 56 dp gri dolgulu kutu (16 köşe, 2 dp çerçeve yeri hep ayrılır, odakta kayma olmaz), altında yardım ya da hata. Odakta zemin beyazlaşır ve çerçeve koyu firuze olur; hata tehlike rengi çerçeve + ikon + metin (polite live region). Solda isteğe bağlı alan simgesi (`MailIcon`, `LockIcon`, `AtIcon`, `PersonIcon`; odakta firuze), sağda alan içi eylem yuvası (≥ 48 dp, ör. şifre göz düğmesi). Kutunun her yeri alanı odaklar. Sıradaki alana "İleri" ile geçilir (`inputRef`). Her alanda örnek gösteren yer tutucu olur (ör. `ornek@eposta.com`); etiketin yerine geçmez, etiket hep görünür.
- Klavye: `FormScreen` içindeki alan odaklanınca, klavyenin ekranı ne kadar örttüğü ölçülür, içerik o kadar alt boşluk alır ve alan altındaki 112 dp payla (şifre kuralları, sıradaki düğme) görünür alana kaydırılır (`RevealContext`). Android edge-to-edge'de pencere küçülmediği için `KeyboardAvoidingView` kullanılmaz.
- `apps/mobile/src/components/account-fields.tsx`: hesap formları. `PasswordField` (göz düğmesi; yeni şifrede kurallar yazdıkça tek tek işaretlenir: onay simgesi + metin, renk tek başına değil), `CodeField` (altı kutu, tek gizli alan; otomatik doldurma ve yapıştırma çalışır, sıradaki kutu çerçeveli), `FormError` (sunucu/ağ hatası: tehlike çerçeveli kutu, assertive), `FormScreen`. Bekleyen düğme yazısı ne olduğunu söyler ("Gönderiliyor…"). "Şifremi unuttum" şifre alanının altında küçük bağlantı; ana düğmenin hemen altına konmaz.
- `apps/mobile/src/components/avatar.tsx`: profil dairesi; fotoğraf yoksa seçilen tonda (`fill` / `ink`) baş harfler, ad yoksa kişi simgesi (boş daire hiç görünmez). Dekoratiftir, kimin olduğu yanındaki adla söylenir. Renk seçimi 48 dp yuvarlak örnekler; seçili örnekte onay simgesi ve koyu çerçeve, ekran okuyucu ton adını okur. Hesap kartı (girişliyken fotoğraf + ad + @kullanıcı adı; girişsizken kısa başlık, tek cümle ve "Hesap oluştur" / "Giriş yap") Profil sekmesinde duyusal profil kartının altındadır.
- `apps/mobile/src/components/profile-card.tsx`: duyusal profil kartı; görme, işitme, hareket, duyular ve dil simgeli haplar halinde. Hap dokununca ilgili onboarding adımını açar. Profil sekmesinin en üstünde ve onboarding'in son adımında özet olarak.
- `apps/mobile/src/components/photo-card.tsx`: `PhotoCard` (web'deki altyazılı eser kartının karşılığı): 4:5 fotoğraf, altta SVG gradyanla koyulaşan şerit (`PhotoScrim`), üstünde ad ve meta, tür çipi, Commons etiketi. Fotoğraf yoksa tür glifi. Ana sayfa şeridi ve ızgarası, Turlar kaydırıcısı (yana kayan, karta oturan) bunu kullanır. Bulanıklık yok (native modül gerektirir).
- `apps/mobile/src/components/city-map.tsx`: şehir seçicide web'in noktalı Türkiye haritası; işaret yeri sunucudaki illerin konumlu eserlerinden hesaplanır. Liste erişilebilirlik için altında kalır.
- `apps/mobile/src/components/nav-sheet.tsx`: navigasyonun sürüklenen alt paneli.
- `apps/mobile/src/components/screen-header.tsx`: tek başlık (`screenTitle`) ve isteğe bağlı alt açıklama; yinelenen üst etiket ve dekoratif şerit yok.
- `apps/mobile/src/components/floating-header.tsx`: detay sayfalarında 48 dp yüzen geri düğmesi; ölçülen kapak geçilince başlık 150 ms opacity ile belirir. `useFloatingHeaderScroll()` kaydırmayı UI iş parçacığında tutar; kapak esnemez ve yer değiştirmez.
- `apps/mobile/src/components/lynch-line.tsx`: numaralı duraklar, daha küçük yer işaretleri ve buluşma / bölge / başlangıç / varış simgeleriyle dikey rota hattı. Tür metni ve tamamlanma işareti renkten bağımsızdır; `compact` yürüyüş panelinde fotoğrafı kaldırır. Tur detayında ara yer işaretleri her bacağın gerçek `passedLandmarks` verisinden gelir.
- `apps/mobile/src/components/read-more.tsx`: uzun metin (eser tarihçesi, mimari). 600 karakterden uzunsa önce ilk paragraflardan ≤ 360 karakterlik, tam cümlede kesilmiş kısa hâli görünür. "Devamını oku · N dk" tamamını paragraf boşluklarıyla açar; açılan kısım yalnız saydamlıkla gelir. "Kısalt" metni kapatır ve sayfayı bölüm başlığına döndürür. Dinleme düğmesi her zaman metnin tamamını okur.
- `apps/mobile/src/components/read-along-text.tsx` + `lib/voice/read-along.ts`: eşli okuma. "Bu bölümü dinle" metni cümle cümle seslendirir; okunan cümle dolgu + alt çizgiyle vurgulanır (yüksek kontrastta yalnız alt çizgi ve kalın). Paragraf değişince sayfa onu gösterir; kullanıcı kendisi kaydırırsa takip bırakılır. Okuma sürerken altta yüzen "… okunuyor · Durdur" çubuğu durur.
- `apps/mobile/src/components/work-facts.tsx`: eser bilgi kartı; etiket solda, değer ortada, sağda kaynak numarası (çerçeveli rakam, renkten bağımsız). Numaralar kartın altındaki kaynak satırlarıyla eşleşir; satır kitabın o PDF sayfasını açar.
- `apps/mobile/src/components/work-visit.tsx`: "Gitmeden önce" kartı. Hareket kısıtlı profilde giriş ve yol satırları öne çıkar. Altında kaynak ve kontrol tarihi; bilgi yoksa "henüz doğrulanmadı".
- `apps/mobile/src/design/sweet/components.tsx`: `SoftPressable`, `IconBubble` (48 dp gri yuvarlak ikon düğmesi), `TypeTile`, `FadeInItem`, `Skeleton`, `SweetSheet`, `sweetShadow` (yalnız yüzen öğeler), `outline` (yüksek kontrast çerçevesi), `a11yLabel`. Eser kartı `components/photo-card.tsx` içinde (`PhotoCard`, UNESCO yıldızı sol üstte).
- `apps/mobile/src/design/work-glyph.tsx`: `WorkGlyph` (tür tonunda karo üstünde glif), `WorkGlyphInline`. `design/motif.tsx`: onboarding'deki küçük `CengelMark` (yüksek kontrastta gösterilmez) ve boş durumlardaki `EmptyMotif`.

## Rehberlik / CueFlash

Yön işareti ve `display` (Atkinson) talimat ana odağı oluşturur; kalan mesafe, simülasyon açıklaması ve erişilebilir ilerleme çubuğu ayrı bilgidir. İşitme profiline bağlı görsel ipucu dekoratif hareket değildir: normalde ekran kenarında iki parlama; reduce motion'da 1.500 ms sabit çerçeve. Her ses ipucunun görsel ve haptik karşılığı vardır. Simülasyon gerçek GPS yönlendirmesi diye sunulmaz ve yalnız Ayarlar → Geliştirici seçenekleri → Simülasyon modu açıkken görünür.

Yürüyüş ses ipuçları (`lib/navigation/earcons.ts`): konuşmadan önce kısa sesler, cuelume'dan (MIT) çevrimdışı üretilmiş WAV'lar (`assets/sounds/`, lisans yanında). Malzeme olayın türünü söyler: dönüş hava hışırtısı ve dönülecek kulakta, yer işareti tek cam nota ve yer işaretinin yönünden, anlatım noktası uzun cam zil, varış tokmak akoru (turda ara durak yumuşak, son durak güçlü), rotadan çıkma / yol kapalı tokmakla beşli, rota yok kısık akor, yürüyüş başlangıç / bitiş hava açılıp kapanması, kalabalık modu çıt sesi. Arayüz tıklama sesi yok. Duymayan profil, ses kapalı ya da kalabalık modunda çalmaz; her ipucunun görsel ve titreşim karşılığı oturumda verilir.

## Yönetim paneli

`apps/admin`: shadcn/ui (radix, `components.json`) + Tailwind v4. Token'lar `src/index.css` içinde Çini 2'nin açık temasıyla eşlenir: zemin kırık beyaz, kart beyaz, `primary` (eylem düğmesi, ilerleme, onay kutusu) koyu firuze `#1C5D55` dolgu + beyaz yazı (masaüstünde beyaz zeminde pastel dolgu silik kalıyordu), pastel firuze menüde seçili öğede, `success` / `warning` tür tonlarından (teal / coral), grafik serileri tür tonlarının koyu ve orta değerleri. Başlıklar Nunito (`font-heading`), gövde Atkinson. Panel yalnız açık temadır.
- Yerleşim: daraltılabilir sol menü (gruplar: Genel, İçerik, Konum ve rota, Topluluk, Ayarlar; bekleyen iş sayısı rozetle), üstte yol çubuğu. Menü, sayfa başlıkları ve pano kısayolları tek listeden (`src/lib/nav.ts`).
- Her sayfa `PageHeader` ile açılır: başlık + bu sayfada ne yapılacağını söyleyen tek cümle + sağda eylemler.
- Görsel boyut ile dokunma alanı ayrıdır. Görsel yükseklik: düğme ve alan varsayılan 40 px, `sm` 36, `xs` 32, ikon düğmesi 32–44 (shadcn varsayılanı 28–32 ince kalıyordu); düğme yazısı Nunito kalın. Dokunma alanı her düğme, toggle ve sekmede en az 48×48 (görünmez `::after` / `::before` uzantısı, AGENTS kural 5); menü satırı görsel olarak da 48 px (düğmesi `overflow-hidden`). Uzantılar çakışmasın diye sarılan düğme satırlarında dikey aralık en az `48 − yükseklik` (ör. `sm` için `gap-y-4`), yan yana ikon düğmeleri `size="icon"` + `gap-3`. Kartlarda gri alt şerit yalnız eylem satırında, özet kartlarında yok.
- Durum `StatusBadge` (Doğrulandı / Taslak / Arşivde); renk yanında hep metin. Geri alınamaz işlem `AlertDialog` ile onaylanır; sonuç `sonner` bildirimi.
- Açılış sayfası Pano: kapsam kartları, il grafiği ve tablosu, fotoğraf durumu, pilot alan ve tur kapsamı, sırada bekleyen işler.
- Ham renk ya da bileşen renklerini ezen sınıf yazılmaz; yeni bileşen `npx shadcn@latest add` ile eklenir.

## Web sitesi

`apps/web` (sezi.info): admin ile aynı shadcn bileşenleri ve ölçüler (40 px görsel yükseklik, 48×48 dokunma alanı). Renk değerleri CSS'te yazılmaz: `src/lib/theme.ts` ortak temadan (`sweetThemes.light`, `highContrast`) CSS değişkenleri üretir. Eylem rengi admin gibi koyu firuze dolgu (`tones.teal.ink`) + beyaz yazı; tür tonları `bg-tone-<ad>` / `text-tone-<ad>-ink`.
- Koyu tema yok. Üst çubuktaki **Görünüm** menüsü: yüksek kontrast (zemin beyaz, metin siyah, yüzeyler 2 px çerçeveli, harita tek renk) ve yazı boyutu (%100 / %112,5 / %125). Tercih tarayıcıda; ilk boyamadan önce uygulanır.
- Az yazı, önce fotoğraf: kartlarda kapak ya da tür tonunda hafif glif karosu (`WorkThumb`: tonun açığı, ince nokta deseni, küçük simge). Fotoğraf yüklenirken ışıltılı yer tutucu, sonra yumuşak beliriş. Uzun kitap metni "Devamını oku · N dk" ile açılır, altında her zaman kitap atfı.
- Az yazı: sayfa başlığının üstünde etiket, altında tanıtım paragrafı yok. Ana sayfa keşiftir (ayrı Keşfet sayfası yok; `/eserler` ana sayfaya yönlenir): arama kutusu, il sekmeleri, tür / ilçe seçimi, fotoğraflı / kesin konum anahtarları, liste ya da harita. Süzme yazarken anında, durum adreste. Açılır listeler yerel `<select>` değil, yuvarlak köşeli `FilterSelect` / `PlacePicker` (aranabilir).
- Eser kartı (Bencho "Progressive blur"): fotoğraf kartın tamamı (4:5); ad, tür etiketi (tür tonunda) ve yer fotoğrafın altında, aşağı doğru koyulaşan kademeli bulanıklık + koyu örtü üstünde. Üzerine gelince bulanıklık yükselir, fotoğraf hafifçe yakınlaşır. Fotoğrafsız kartta bulanıklık yok, yazı açık karonun üstünde koyu. Izgara eşit (öne çıkan büyük kart yok). Beğenilmezse sıradaki aday React Bits "Tilted Card".
- Köşeler ölçülü: `--radius` 0.5rem (8 px); çip, arama kutusu, kart fotoğrafı ve panel `rounded-lg` / `rounded-xl`. Tam yuvarlak (`rounded-full`) yalnız avatar, numara rozeti ve dönüş simgesi gibi kare öğelerde.
- Rota sayfası harita uygulamaları gibi: tam ekran harita, üstünde yüzen panel (masaüstünde solda, telefonda alttan sayfa). Panelde aranabilir Nereden / Nereye kutuları, simgeli profil seçici, sonuç (süre, mesafe, basamak), yol tarifi. Haritada esere dokunmak hedefi seçer; başlangıç "Haritadan seç" ile.
- Harita destekleyicidir: haritadaki her bilgi sayfadaki listede de yazılıdır; profil çizgileri renk yanında kalınlık ve kesiklikle ayrılır.
- Ana sayfanın başı: solda başlık ve arama kutusu, sağda büyük noktalı **Türkiye haritası** (il işaretleri düğme, dokununca il süzülür; işaret yeri o ilin eserlerinin ortalaması, harita sunucuda `dotted-map` ile üretilir); filtreler altında tam genişlikte. "Yakınınızda" şeridi (`components/explore/nearby.tsx`) şimdilik gösterilmiyor.
- Arama kutusu (`SearchField`): 64 px yükseklik, çerçevesiz, il sekmeleri ve filtre çipleriyle aynı zemin (`secondary`); odakta açık yüzey, halka ve firuze simge karosu. Boşken yer tutucu gerçek veriden örnek aramalar arasında yukarı kayarak döner (eser adları, "Osmangazi cami" gibi ilçe + tür); "/" tuşu kutuya odaklanır. Hareket azaltmada yer tutucu sabit.
- Üst menü (Aceternity "Resizable Navbar"): üç sütun, logo solda, sayfa bağlantıları ortada, eylemler sağda. Sayfa başında tam genişlikte düz çubuk; aşağı kayınca daralıp ortada yüzen, bulanık zeminli çubuğa dönüşür (yükseklik değişmez, yalnız `transform`). Rota / Turlar / Sergiler'de dolgu üzerine gelinen bağlantıya kayar, imleç yokken seçili sayfada durur. Her sayfada **arama** (Ctrl+K / ⌘K, eser adından doğrudan eser sayfasına). Telefon ve tablette hamburger yok: altta sekme çubuğu (Keşfet, Rota, Turlar, Hesap; seçim dolgusu kayar); Sergiler, Hakkında, Bildirim alt bilgide. Beğenilmezse sıradaki aday React Bits "Gooey Nav".
- Hareket ölçülü ve anlamlı: profil seçicide, il sekmelerinde (Tümü / Hatay / Konya / Bursa) ve liste/harita geçişinde seçim dolgusu kayar; rota süresi ve mesafesi değişince rakamlar kayarak yenilenir (`RollingText`); eser fotoğrafında fareyle büyüteç (`Lens`, dokunmatikte tam ekran açılır). Turlar fotoğraflı büyük kartlarla yana kayar (`CardCarousel`). Hareket azaltmada hepsi anlık.
- Her sayfada tek `h1`, "İçeriğe atla" bağlantısı, görünür odak çerçevesi (3 px `--ring`).

## Yap / Yapma

**Yap**
- Renkleri `useSweetTheme()` üzerinden al; dolgu üstünde eşleşen `ink`, zemin üstünde `primaryText` / `accentText` kullan.
- Ekranları `ui.tsx` ve `design/sweet/components` parçalarıyla, en az 48 dp dokunma alanıyla kur.
- Uzun metni ve büyük yazıyı kaydırılabilir, esnek yerleşimde tut.
- Kaynak, konum kesinliği ve simülasyon durumunu okunur metinle göster.
- Yüksek kontrastta dolgusuz yüzeylere `outline(t)` ekle.

**Yapma**
- Fotoğraf, tarihçe veya doğrulanmamış eser bilgisi uydurma.
- Sabit renk kodu yazma (harita altlığının üç doğal rengi dışında).
- Kartlara gölge ekleme; dekoratif bant ve madalyon kullanma.
- `primary.ink`'i zemin üstünde, beyaz yazıyı firuze dolgu üstünde kullanma.
- Renkleri tek başına durum göstergesi yapma.
- Ekranda harita kütüphanesini doğrudan kullanma; harita çizimleri `components/map` bileşenleriyle yapılır.
