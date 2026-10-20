import { describe, expect, it } from "vitest";

import { fallbackDisplayName, NAME_MAX } from "./index";

describe("fallbackDisplayName", () => {
  it("geçerli kayıttaki adı korur", () => {
    expect(fallbackDisplayName("  Ayşe Yılmaz  ", "ayse@ornek.com")).toBe("Ayşe Yılmaz");
  });

  it("boş ya da 61 karakterlik ad e-posta önekine düşer", () => {
    expect(fallbackDisplayName("", "ediz@sezi.info")).toBe("ediz");
    expect(fallbackDisplayName("   ", "ediz@sezi.info")).toBe("ediz");
    expect(fallbackDisplayName("a".repeat(NAME_MAX + 1), "ediz@sezi.info")).toBe("ediz");
  });

  it("e-posta da yoksa Sezi döner", () => {
    expect(fallbackDisplayName("", undefined)).toBe("Sezi");
  });
});
