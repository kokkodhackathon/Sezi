import { describe, expect, it } from "vitest";

import { unsupportedInSummary } from "./index";

const source =
  "Cami, Orhan Gazi'nin oğlu Süleyman Paşa tarafından 1339 yılında yaptırılmıştır. Osmanlılar döneminde iki kez onarılmıştır.";

describe("unsupportedInSummary", () => {
  it("kaynakta olan yıl, ad ve çekimli biçimleri uyarı vermez", () => {
    expect(unsupportedInSummary("Bu cami 1339'da Süleyman Paşa'nın emriyle yapıldı. Osmanlı döneminde onarıldı.", source, "tr")).toEqual([]);
  });

  it("kaynakta olmayan yıl ve ad döner", () => {
    expect(unsupportedInSummary("Cami 1340 yılında Mimar Sinan tarafından yapıldı.", source, "tr")).toEqual(["1340", "Mimar", "Sinan"]);
  });

  it("cümle başındaki büyük harfli sözcük özel ad sayılmaz", () => {
    expect(unsupportedInSummary("Yapı iki kez onarıldı. Bugün ibadete açık.", source, "tr")).toEqual([]);
  });

  it("şapka farkı, kitaptaki Roma rakamlı yüzyıl ve uzun çekim eki uyarı vermez", () => {
    const book = "Fâtih devrinde, XIV. yüzyılda Osmanlı’nın yaptırdığı yapı.";
    expect(unsupportedInSummary("Yapı 14. yüzyılda, Fatih döneminde Osmanlıların eseri.", book, "tr")).toEqual([]);
    expect(unsupportedInSummary("Yapı 15. yüzyılda yapıldı.", book, "tr")).toEqual(["15"]);
  });
});
