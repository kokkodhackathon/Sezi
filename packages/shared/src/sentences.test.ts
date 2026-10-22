import { describe, expect, it } from "vitest";

import { splitReadAlong } from "./sentences";

const flat = (text: string) => splitReadAlong(text).flat();

describe("splitReadAlong", () => {
  it("cümle sonunda böler, paragrafları ayrı tutar", () => {
    expect(splitReadAlong("Han 1340'ta yapıldı. Avlusu geniştir!\n\nSonra onarıldı? Evet.")).toEqual([
      ["Han 1340'ta yapıldı.", "Avlusu geniştir!"],
      ["Sonra onarıldı?", "Evet."],
    ]);
  });

  it("Roma rakamlı sıra sayısında bölmez (II. Murad)", () => {
    expect(flat("Yapı II. Murad döneminde yapıldı. I. Dünya Savaşı'nda hasar gördü.")).toEqual([
      "Yapı II. Murad döneminde yapıldı.",
      "I. Dünya Savaşı'nda hasar gördü.",
    ]);
  });

  it("kısaltmalarda bölmez (H., M., Hz., s., vb.)", () => {
    expect(flat("Kitabeye göre H. 740 / M. 1340 yılında Hz. Ali adına yapılmış. Bkz. s. 12 vb. kaynaklar.")).toEqual([
      "Kitabeye göre H. 740 / M. 1340 yılında Hz. Ali adına yapılmış.",
      "Bkz. s. 12 vb. kaynaklar.",
    ]);
  });

  it("sayı + nokta + küçük harf (14. yüzyıl) bölünmez; yıl sonunda büyük harfle başlayan cümle bölünür", () => {
    expect(flat("Yapı 14. yüzyıla aittir. Onarım 1958. Sonraki onarım 2010'da.")).toEqual([
      "Yapı 14. yüzyıla aittir.",
      "Onarım 1958.",
      "Sonraki onarım 2010'da.",
    ]);
  });

  it("boşlukları sadeleştirir, boş metinde boş döner", () => {
    expect(splitReadAlong("  Bir   cümle.\nAynı paragraf.  ")).toEqual([["Bir cümle.", "Aynı paragraf."]]);
    expect(splitReadAlong("   ")).toEqual([]);
  });

  it("parçalar birleşince metnin tamamını verir (hiçbir kelime kaybolmaz)", () => {
    const text = "Çarşı (bedesten) yanar… Sonra yeniden yapılır. “Kapı” kitabesi: H. 1200.";
    expect(flat(text).join(" ")).toBe(text);
  });
});
