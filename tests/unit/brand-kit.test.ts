import { describe, expect, it } from "vitest";
import { contrastNote, contrastRatio, extractSiteSuggestion, normalizeHex, normalizeRequiredPhrases, normalizeWebsite, textOn } from "@/lib/brand/kit";
import { appendRequiredPhrases, hasPhrase, requiredPhraseFindings } from "@/lib/engine/brand-voice";
import type { AdInput } from "@/lib/engine/types";

const ad = (primaryText: string, requiredPhrases: string[]): AdInput => ({
  sector: "genel",
  headline: "Yeni sezon",
  primaryText,
  description: "",
  flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
  brandVoice: { bannedWords: [], requiredPhrases },
});

describe("brand kit", () => {
  it("normalises colours and measures contrast", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("0B1B3F")).toBe("#0b1b3f");
    expect(normalizeHex("red")).toBeNull();
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(textOn("#0b1b3f")).toBe("#ffffff");
    expect(textOn("#fff3b0")).toBe("#0b1b3f");
    expect(contrastNote("#0b1b3f").ok).toBe(true);
    expect(contrastNote("#e0457b").ok).toBe(false);
  });

  it("accepts only https websites without credentials", () => {
    expect(normalizeWebsite("markam.com")).toBe("https://markam.com/");
    expect(normalizeWebsite("http://markam.com")).toBeNull();
    expect(normalizeWebsite("https://user:pw@markam.com")).toBeNull();
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
  });

  it("keeps at most ten unique mandatory phrases", () => {
    expect(normalizeRequiredPhrases("Kampanya stokla sınırlıdır.\nkampanya STOKLA sınırlıdır.\n\nab")).toEqual(["Kampanya stokla sınırlıdır."]);
    expect(normalizeRequiredPhrases(Array.from({ length: 20 }, (_, i) => `İbare ${i}`))).toHaveLength(10);
  });

  it("reads only a few meta values from an untrusted page", () => {
    const html = `<html><head><title>Çınar Kahve | Taze kavrum</title><meta property="og:site_name" content="Çınar &amp; Kahve">
      <meta name="description" content="Her sabah taze.">
      <meta name="theme-color" content="#7A3E1D"><link rel="apple-touch-icon" href="/icon-180.png"><script>alert(1)</script></head></html>`;
    expect(extractSiteSuggestion(html, "https://cinar.example/urun")).toEqual({
      name: "Çınar & Kahve",
      tagline: "Her sabah taze.",
      themeColor: "#7a3e1d",
      logoUrl: "https://cinar.example/icon-180.png",
    });
    const noHttpLogo = extractSiteSuggestion(`<link rel="apple-touch-icon" href="http://x.example/a.png"><title>A</title>`, "https://x.example/");
    expect(noHttpLogo.logoUrl).toBeNull();
    expect(noHttpLogo.themeColor).toBeNull();
  });
});

describe("mandatory phrases in analysis", () => {
  it("flags a missing phrase as a brand note, never as a legal finding", () => {
    const f = requiredPhraseFindings(ad("Yeni koleksiyon mağazada.", ["Kampanya stokla sınırlıdır."]));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ domain: "creative_quality", severity: "yellow", ruleId: null });
    expect(requiredPhraseFindings(ad("Yeni koleksiyon. KAMPANYA STOKLA SINIRLIDIR", ["Kampanya stokla sınırlıdır."]))).toHaveLength(0);
  });

  it("appends missing phrases to the safe text once", () => {
    expect(appendRequiredPhrases("Yeni koleksiyon mağazada", ["Kampanya stokla sınırlıdır."])).toBe("Yeni koleksiyon mağazada. Kampanya stokla sınırlıdır.");
    const once = appendRequiredPhrases("Yeni koleksiyon.", ["Stoklarla sınırlı"]);
    expect(once).toBe("Yeni koleksiyon. Stoklarla sınırlı.");
    expect(appendRequiredPhrases(once, ["Stoklarla sınırlı"])).toBe(once);
    expect(hasPhrase("stoklarla  sınırlı!", "Stoklarla sınırlı.")).toBe(true);
  });
});
