/** Hakkında sayfası: proje, ekip, veri ve kaynaklar: TR + EN metinleri (EN tipi her anahtarı zorunlu kılar). */
export const tr = {
  "about.title": "Hakkında",
  "about.lead":
    "Sezi, vakıf eserlerini kaynaklı envanter verisiyle sunan ve Kevin Lynch'in bilişsel haritalama yaklaşımıyla erişilebilir yönlendirme yapan bir keşif uygulamasıdır.",

  // Lynch yaklaşımı
  "about.lynch.title": "Proje amacı ve Kevin Lynch yaklaşımı",
  "about.lynch.p1":
    "Klasik harita uygulamaları kültürel mirası soyut koordinatlara ve “100 metre sonra sağa dönün” gibi mekanik komutlara indirger. Sezi ise kent plancısı Kevin Lynch'in bilişsel haritalama öğelerini — yer işareti (landmark), düğüm (node), yol (path) ve bölge (district) — temel alır.",

  // Erişilebilirlik yaklaşımı
  "about.a11y.title": "Erişilebilirlik yaklaşımı",
  "about.a11y.p1":
    "Erişilebilirlik Sezi'de sonradan eklenen bir katman değil, rota motorunun ve arayüzün çekirdeğidir. Rotalar kullanıcının görme, hareket ve işitme profiline göre gerçek yaya grafiği üzerinde ayrı ayrı hesaplanır:",
  "about.a11y.wcag":
    "Web ve mobil arayüzde WCAG 2.2 AA kontrast standardı, az gören kullanıcılar için yüksek kontrast (AAA) modu, ölçeklenebilir yazı boyutu ve en az 48×48 px dokunma hedefleri uygulanır; renk hiçbir zaman tek başına bilgi taşımaz.",

  // Ekip ve Hackathon
  "about.team.title": "Ekip: LAHMACUN",
  "about.team.ediz.role": "Backend",
  "about.team.eda.role": "Frontend",
  "about.team.inci.role": "Tasarım",
  "about.team.zehra.role": "Veri",

  // Veri politikası ve telif
  "about.copyright.title": "Veri politikası ve telif",
  "about.copyright.p1":
    "Sezi'de kaynaksız hiçbir tarihî bilgi üretilmez ve uydurulmaz. Eser adı, il, ilçe, yapı türü ve envanter kitabındaki cilt/sayfa bilgisi doğrudan envanter dizininden alınır.",
  "about.copyright.p2":
    "Kitap metinleri (adres, tarihçe ve mimari açıklama) yalnızca yönetici onayıyla, ilgili envanter kitabının sayfasıyla karşılaştırılarak ve açık kitap atfıyla (Kitap adı, Cilt, Sayfa) yayımlanır; otomatik veya doğrulanmamış metin yayınlanmaz. Her eserin konum kesinliği (kesin, yaklaşık, doğrulanmadı) kullanıcıya açıkça gösterilir.",

  // Kaynaklar
  "about.sources.title": "Kaynaklar ve açık veri atıfları",
  "about.sources.vakifTitle": "Vakıf Katılım — Vakıf Eserleri Envanteri",
  "about.sources.vakifBody": "Hatay, Konya ve Bursa vakıf eserleri envanter kitapları, sergi katalogları ve fotoğraf arşivi.",
  "about.sources.wikidataTitle": "Wikidata (CC0)",
  "about.sources.wikidataBody": "Yapı kimlikleri, çok dilli adlar ve temel coğrafi koordinat eşleştirmeleri (Creative Commons CC0).",
  "about.sources.osmTitle": "OpenStreetMap ve Nominatim (ODbL)",
  "about.sources.osmBody": "Bursa Hanlar Bölgesi yaya yolu ağı, merdiven ve zemin öznitelikleri, yapı konum doğrulaması (© OpenStreetMap katkıcıları, ODbL).",
  "about.sources.mapboxTitle": "Mapbox",
  "about.sources.mapboxBody": "Etkileşimli harita görselleştirmesi ve yüksek kontrastlı harita katmanları.",
};

export const en: Record<keyof typeof tr, string> = {
  "about.title": "About",
  "about.lead":
    "Sezi is a heritage discovery application that presents foundation works with sourced inventory data and provides accessible guidance through Kevin Lynch's cognitive mapping approach.",

  // Lynch approach
  "about.lynch.title": "Project purpose and the Kevin Lynch approach",
  "about.lynch.p1":
    "Conventional map apps reduce cultural heritage to abstract coordinates and mechanical commands such as “turn right in 100 metres”. Sezi builds on urban planner Kevin Lynch's elements of cognitive mapping — landmarks, nodes, paths and districts.",

  // Accessibility approach
  "about.a11y.title": "Accessibility approach",
  "about.a11y.p1":
    "In Sezi, accessibility is not an afterthought layered on top — it is the core of both the routing engine and the user interface. Routes are computed on the real pedestrian graph according to each visitor's vision, mobility and hearing profile:",
  "about.a11y.wcag":
    "Across web and mobile, Sezi enforces WCAG 2.2 AA contrast, a high-contrast (AAA) mode for low-vision users, scalable text sizes and minimum 48×48 px touch targets; colour is never the sole carrier of meaning.",

  // Team and Hackathon
  "about.team.title": "Team: LAHMACUN",
  "about.team.ediz.role": "Backend",
  "about.team.eda.role": "Frontend",
  "about.team.inci.role": "Design",
  "about.team.zehra.role": "Data",

  // Data policy and copyright
  "about.copyright.title": "Data policy and copyright",
  "about.copyright.p1":
    "Sezi never fabricates or guesses unsourced historical facts. Work names, provinces, districts, building types and inventory book volume/page references are taken directly from the verified inventory index.",
  "about.copyright.p2":
    "Book texts (addresses, histories and architectural descriptions) are published only after admin verification against the corresponding inventory book page and always carry explicit book attribution (Title, Volume, Page); no automated or unverified text is published. Location precision (exact, approximate, unverified) is shown transparently on every work.",

  // Sources
  "about.sources.title": "Sources and open-data attributions",
  "about.sources.vakifTitle": "Vakıf Katılım — Foundation Works Inventory",
  "about.sources.vakifBody": "Hatay, Konya and Bursa foundation works inventory books, exhibition catalogues and photograph archive.",
  "about.sources.wikidataTitle": "Wikidata (CC0)",
  "about.sources.wikidataBody": "Building identifiers, multilingual names and initial coordinate matching (Creative Commons CC0).",
  "about.sources.osmTitle": "OpenStreetMap and Nominatim (ODbL)",
  "about.sources.osmBody": "Bursa Inns Quarter pedestrian network, step and surface attributes, and building location verification (© OpenStreetMap contributors, ODbL).",
  "about.sources.mapboxTitle": "Mapbox",
  "about.sources.mapboxBody": "Interactive map rendering and high-contrast map layers.",
};
