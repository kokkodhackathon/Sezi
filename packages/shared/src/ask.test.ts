import { describe, expect, it } from "vitest";

import { AskRequestSchema, AskResponseSchema } from "./ask";

const deviceId = "123e4567-e89b-42d3-a456-426614174000";

describe("Sezi'ye Sor şemaları", () => {
  it("geçerli ve sınırlandırılmış isteği kabul eder", () => {
    const value = AskRequestSchema.parse({
      question: "Ulu Cami ne zaman yapıldı?",
      lang: "tr",
      deviceId,
      candidateSlugs: ["bursa-ulu-cami"],
      history: [{ role: "user", text: "Ulu Cami hakkında bilgi ver" }],
    });
    expect(value.question).toBe("Ulu Cami ne zaman yapıldı?");
    expect(value.candidateSlugs).toEqual(["bursa-ulu-cami"]);
  });

  it("uzun soru ve geçersiz eser anahtarını reddeder", () => {
    expect(() => AskRequestSchema.parse({ question: "a".repeat(241), lang: "tr", deviceId })).toThrow();
    expect(() => AskRequestSchema.parse({ question: "Ulu Cami?", lang: "tr", deviceId, candidateSlugs: ["../taslak"] })).toThrow();
  });

  it("kaynaklı yanıtı ayrıştırır, kaynak numarası pozitif olmalıdır", () => {
    const base = {
      mode: "rag" as const,
      answer: "Yapı 1399 yılında tamamlandı. [1]",
      workSlugs: ["bursa-ulu-cami"],
      citations: [{
        index: 1,
        workSlug: "bursa-ulu-cami",
        workName: "Ulu Cami",
        section: "history" as const,
        sourceTitle: "Bursa Vakıf Eserleri",
        sourcePublisher: "Vakıf Katılım",
        sourceYear: 2025,
        sourceUrl: "https://example.com/book.pdf",
        sourceVolume: 1,
        sourcePage: "37–76",
      }],
    };
    expect(AskResponseSchema.parse(base).citations[0]?.index).toBe(1);
    expect(() => AskResponseSchema.parse({ ...base, citations: [{ ...base.citations[0], index: 0 }] })).toThrow();
  });

  it("uygulamadaki yayımlanmış eser kaydını kaynak olarak kabul eder", () => {
    const response = AskResponseSchema.parse({
      mode: "rag",
      answer: "Koza Han, Orhan Camii ile Ulucami arasındadır. [1]",
      workSlugs: ["bursa-koza-hani"],
      citations: [{
        index: 1,
        workSlug: "bursa-koza-hani",
        workName: "Koza Han",
        section: "app",
        sourceTitle: "Sezi uygulama kaydı",
        sourcePublisher: "Sezi",
        sourceYear: 2026,
        sourceUrl: null,
        sourceVolume: null,
        sourcePage: null,
      }],
    });

    expect(response.citations[0]?.section).toBe("app");
  });
});
