import { describe, expect, it } from "vitest";

import { normalize, searchWorks, type SearchableWork } from "./index";

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
});
