import { describe, expect, it } from "vitest";
import { wordDiff } from "@/lib/text/word-diff";

const changed = (parts: { text: string; changed: boolean }[]) => parts.filter((p) => p.changed).map((p) => p.text);

describe("word diff", () => {
  it("marks only the words the safe text removed or added", () => {
    const d = wordDiff("7 günde 5 kilo ver! Garantili sonuç.", "Dengeli beslenmene destek ol. Sonuçlar kişiden kişiye değişir.");
    expect(d.before.map((p) => p.text).join("")).toBe("7 günde 5 kilo ver! Garantili sonuç.");
    expect(d.after.map((p) => p.text).join("")).toBe("Dengeli beslenmene destek ol. Sonuçlar kişiden kişiye değişir.");
    const same = wordDiff("Yeni sezon çaylarımız mağazada.", "Yeni sezon bitki çaylarımız mağazada!");
    expect(changed(same.before)).toEqual([]);
    expect(changed(same.after)).toEqual(["bitki"]);
  });

  it("groups neighbouring changes into one highlight", () => {
    const d = wordDiff("Hemen al, kesin zayıfla bugün", "Hemen al bugün");
    expect(changed(d.before)).toEqual(["kesin zayıfla"]);
  });
});
