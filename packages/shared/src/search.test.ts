import { describe, expect, it } from "vitest";

import { normalize, searchWorks, searchAskWorks, type SearchableWork } from "./index";

const w = (
  name: string,
  type_slug: string,
  type_name: string,
  district: string,
  city = "Bursa",
): SearchableWork & { slug: string } => ({
  slug: `${district}-${name}`.toLowerCase(),
  name: { tr: name },
  type_slug,
  type_name: { tr: type_name },
  district,
  city_name: { tr: city },
});

const sample = [
  w("İbrahim Paşa Hamamı", "hamam", "Hamam", "Osmangazi"),
  w("Kayıhan Hamamı", "hamam", "Hamam", "Osmangazi"),
  w("Eski Kaplıca Hamamı", "hamam", "Hamam", "Çekirge"),
  w("Ulu Cami", "cami", "Cami", "Osmangazi"),
  w("İplikçi Camii", "cami", "Cami", "Osmangazi"),
  w("Hamam Sokak Çeşmesi", "cesme", "Çeşme", "Osmangazi"),
];

describe("searchWorks", () => {
  it("geniş keşif sorularında şehirdeki anlatımı dolu eserleri önerir", () => {
    const works = [
      {...w("Davut Çeşmesi", "cesme", "Çeşme", "Osmangazi"), summary: null},
      {...w("Ulucami", "cami", "Cami", "Osmangazi"), summary: {tr: "Yayımlanmış özet"}},
      {...w("Başka Cami", "cami", "Cami", "Meram", "Konya"), summary: {tr: "Özet"}},
    ];
    for (const question of ["Bursa da nerelere gidebilirim", "Bursa'da gezilecek yer önerir misin?", "What can I visit in Bursa?"]) {
      const found = searchAskWorks(question, works);
      expect(found[0]?.name.tr).toBe("Ulucami");
      expect(found.every(x => x.city_name.tr === "Bursa")).toBe(true);
    }
    expect(searchAskWorks("Bursa'da hangi çeşmeleri görebilirim?", works).map(x => x.name.tr)).toEqual(["Davut Çeşmesi"]);
    expect(searchAskWorks("Bursa Ulucami'yi kim yaptırdı?", works).map(x => x.name.tr)).toEqual(["Ulucami"]);
  });
  it("sohbet soruları ve ayrı/bitişik Ulucami yazımı doğru eseri bulur", () => {
    const works = [w("Ulucami", "cami", "Cami", "Osmangazi"), w("Orhan Bey Camii", "cami", "Cami", "Osmangazi"), w("Alaaddin-i Mısri Türbesi", "turbe", "Türbe", "İznik"), w("Birgi Camii", "cami", "Cami", "Ödemiş")];
    expect(searchWorks("Ulu Cami hakkında biraz bilgi verir misin?", works).map(x => x.name.tr)).toEqual(["Ulucami"]);
    expect(searchWorks("Orhan Bey Camii’nin tarihini anlatır mısın?", works).map(x => x.name.tr)).toEqual(["Orhan Bey Camii"]);
  });
  it("eser adına kesmeyle gelen Türkçe ek başka eserleri zorunlu aday yapmaz", () => {
    const works = [w("Ulucami", "cami", "Cami", "Osmangazi"), w("Yıldırım Camii", "cami", "Cami", "Yıldırım")];
    for (const question of ["Bursa Ulucami’yi kim yaptırdı?", "Bursa Ulucami'yi kim yaptırdı?"]) {
      expect(searchWorks(question, works).map((x) => x.name.tr)).toEqual(["Ulucami"]);
    }
  });
  it("Osmangazi'deki hamamlar sorgusu yalnız Osmangazi'deki hamamları döndürür", () => {
    const res = searchWorks("Osmangazi'deki hamamlar", sample);
    expect(res.map((x) => x.name.tr)).toEqual(["İbrahim Paşa Hamamı", "Kayıhan Hamamı"]);
  });

  it("İplik ile iplik aynı sonucu verir", () => {
    expect(normalize("İplik")).toBe(normalize("iplik"));
    const upper = searchWorks("İplik", sample);
    const lower = searchWorks("iplik", sample);
    expect(upper).toEqual(lower);
    expect(upper.map((x) => x.name.tr)).toEqual(["İplikçi Camii"]);
  });

  it("tür eşleşmesi ad eşleşmesinden önce sıralanır", () => {
    const works = [
      w("Hamam Çeşmesi", "cesme", "Çeşme", "Osmangazi"),
      w("Yenişehir Hamamı", "hamam", "Hamam", "Osmangazi"),
    ];
    const res = searchWorks("hamam", works);
    expect(res[0]?.type_slug).toBe("hamam");
  });

  it("tek harf, ad kelimelerinin başıyla eşleşir; adın ilk kelimesi önce gelir", () => {
    const works = [w("Hacı Ali Camii", "cami", "Cami", "Osmangazi"), w("Alaaddin Camii", "cami", "Cami", "Osmangazi"), w("Ulu Cami", "cami", "Cami", "Osmangazi")];
    const res = searchWorks("a", works);
    expect(res.map((x) => x.name.tr)).toEqual(["Alaaddin Camii", "Hacı Ali Camii"]);
  });

  it("tek harf tür adındaki kelimelerle eşleşmez (\"a\" → \"and\" değil)", () => {
    const works = [w("Halil Ağa Evi", "konak", "Konak ve ev", "Mudanya"), w("Alaaddin Camii", "cami", "Cami", "Osmangazi")];
    works[0]!.type_name = { tr: "Konak ve ev", en: "Mansion and house" };
    expect(searchWorks("a", works).map((x) => x.name.tr)).toEqual(["Alaaddin Camii", "Halil Ağa Evi"]);
  });

  it("yazarken bütün kelimeler eşleşmeli; hiçbir eserde geçmeyen kelime yok sayılır", () => {
    expect(searchWorks("ulu ca", sample).map((x) => x.name.tr)).toEqual(["Ulu Cami"]);
    expect(searchWorks("kay", sample).map((x) => x.name.tr)).toEqual(["Kayıhan Hamamı"]);
    expect(searchWorks("hangi hamamlar", sample).every((x) => x.type_slug === "hamam")).toBe(true);
  });

  it("iki harfli tür kökü (su) yalnız kendisiyle tür ipucu olur", () => {
    const works = [w("Sultan Çeşmesi", "cesme", "Çeşme", "Osmangazi"), w("Tophane Sebili", "sebil", "Sebil", "Osmangazi")];
    expect(searchWorks("sultan", works).map((x) => x.name.tr)).toEqual(["Sultan Çeşmesi"]);
    expect(searchWorks("su", works)).toHaveLength(2);
  });
});
