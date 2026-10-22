import { describe, expect, it } from "vitest";
import { moveToArchitecture, paragraphsOf, suggestArchitecture, suggestBuiltYears } from "./text-suggest";

const history = [
  "Cami, Sultan II. Murad döneminde Hacı Ali Bey tarafından H. 850 / M. 1446 yılında inşa ettirilmiştir. Vakfiyesi kayıtlarda geçer.",
  "Banisi Hacı Ali Bey 1460 yılında vefat etmiş ve haziresine defnedilmiştir.",
];
const architecture = [
  "Kare planlı yapının iç ölçüleri 8,65 × 8,65 m'dir; üzeri kasnaklı bir kubbeyle örtülüdür.",
  "Duvarlar iki sıra tuğla ve bir sıra moloz taşla almaşık örülmüştür. Minare kesme taş kaide üzerinde yükselir.",
  "Mihrap alçıdan, minber ahşaptandır; pencereler sivri kemerlidir.",
];
const later = [
  "Cami 1855 depreminde zarar görmüş, 1960 yılında Vakıflar Genel Müdürlüğü tarafından onarılmıştır.",
  "Günümüzde ibadete açıktır.",
];

describe("suggestArchitecture", () => {
  it("tarihçe ile onarımlar arasındaki mimari bloğu bulur", () => {
    expect(suggestArchitecture([...history, ...architecture, ...later], "tr")).toEqual({ start: 2, end: 5 });
  });

  it("mimari tanım yoksa ya da tek paragrafsa öneri vermez", () => {
    expect(suggestArchitecture([...history, ...later], "tr")).toBeNull();
    expect(suggestArchitecture([architecture[0]!], "tr")).toBeNull();
  });

  it("İngilizce metinde de bloğu bulur", () => {
    const en = [
      "The mosque was commissioned by Hacı Ali Bey in AH 850 / AD 1446, during the reign of Sultan Murad II.",
      "The square-planned building measures 8.65 × 8.65 m inside and is covered by a dome on a drum.",
      "Its walls are built of alternating brick and rubble courses; the minaret rises on a cut stone base.",
      "It was repaired in 1960 and is used for worship today.",
    ];
    expect(suggestArchitecture(en, "en")).toEqual({ start: 1, end: 3 });
  });
});

describe("suggestBuiltYears", () => {
  it("hicrî yılı değil miladi yılı alır, cümleyi kanıt olarak verir", () => {
    const [first] = suggestBuiltYears(history.join("\n\n"));
    expect(first).toEqual({ year: 1446, sentence: expect.stringContaining("inşa ettirilmiştir") });
  });

  it("gün ve aylı hicrî tarihte de miladi yılı alır", () => {
    const text = "Kitabesine göre cami H. 17 Recep 1082 / M. 19 Kasım 1671 tarihinde yaptırılmıştır.";
    expect(suggestBuiltYears(text).map((s) => s.year)).toEqual([1671]);
  });

  it("onarım, yeniden inşa ve vefat cümlelerini önermez", () => {
    const text = [
      "Yapı 1855 depreminden sonra yeniden inşa edilmiştir.",
      "Banisi 1487 yılında vefat edince cami tamir ettirilmiştir.",
      "Cami 1960 yılında onarılmıştır.",
    ].join(" ");
    expect(suggestBuiltYears(text)).toEqual([]);
  });

  it("aynı yılı bir kez verir ve sınırı aşmaz", () => {
    const text = [
      "Cami 1446 yılında inşa edilmiştir.",
      "Medrese de 1446 yılında yaptırılmıştır.",
      "İmaret 1450 yılında tamamlanmıştır.",
      "Hamam 1452 yılında yapılmıştır.",
    ].join(" ");
    expect(suggestBuiltYears(text, 2).map((s) => s.year)).toEqual([1446, 1450]);
  });
});

describe("moveToArchitecture", () => {
  it("seçilen paragrafları sırasıyla taşır, mimarideki metnin sonuna ekler", () => {
    const out = moveToArchitecture("a\n\nb\n\nc\n\nd", "x", new Set([1, 2]));
    expect(out).toEqual({ history: "a\n\nd", architecture: "x\n\nb\n\nc" });
    expect(paragraphsOf(out.history)).toEqual(["a", "d"]);
  });
});
