import { describe, expect, it } from "vitest";
import { fold } from "@/lib/engine/text";
import type { EngineFinding } from "@/lib/engine/types";
import { topRiskyPhrases } from "@/lib/onboarding/risky";
import { guessSector } from "@/lib/sectors";
import { PASTE_MAX, parseVariantLines, pasteProblem, safestVariants, VARIANT_MAX_CHARS, type VariantRow } from "@/lib/variants/paste";

describe("sector guess (P9.2)", () => {
  it("finds a clear sector from site text and falls back to general", () => {
    expect(guessSector(fold("Doğal vitamin ve mineral takviyesi. Kolajen kapsül, probiyotik destek.")).sector).toBe("takviye_gida");
    expect(guessSector(fold("Satılık ve kiralık daireler, yeni konut projeleri, villa ve arsa.")).sector).toBe("emlak");
    expect(guessSector(fold("Kredi kartı, yatırım fonu ve sigorta ürünleri. Faiz oranları.")).sector).toBe("finans");
    expect(guessSector(fold("El yapımı seramik kupalar ve tabaklar.")).sector).toBe("genel");
    // Turkish suffixes count ("kremler"), a hint in the middle of another word does not.
    expect(guessSector(fold("Kremler, serumlar ve nemlendiriciler")).sector).toBe("kozmetik");
    expect(guessSector(fold("Mikrofinans ve akredite laboratuvar")).sector).toBe("genel");
  });
});

const finding = (o: Partial<EngineFinding>): EngineFinding => ({
  ruleId: null,
  ruleVersionId: null,
  ruleStatus: null,
  domain: "tr_law",
  severity: "info",
  field: "primary_text",
  matchedText: null,
  title: "Kural",
  explanation: "",
  suggestion: "",
  origin: "rule_engine",
  ...o,
});

describe("first risky phrases on a site (P9.2)", () => {
  const rules = [
    { id: "R-ACTIVE", status: "active" as const },
    { id: "R-REVIEW", status: "requires_review" as const },
  ];
  it("puts verified red first, keeps unverified cards at 'dikkat' and drops repeats", () => {
    const out = topRiskyPhrases(
      [
        finding({ ruleId: "R-REVIEW", matchedText: "en iyi", severity: "info" }),
        finding({ ruleId: "R-ACTIVE", matchedText: "garantili", severity: "red" }),
        finding({ ruleId: "R-ACTIVE", matchedText: "Garantili", severity: "red" }),
        finding({ ruleId: null, matchedText: null, severity: "yellow", domain: "creative_quality" }),
        finding({ ruleId: "R-REVIEW", matchedText: "mucize", severity: "red" }),
        finding({ ruleId: "R-ACTIVE", matchedText: "%100", severity: "yellow" }),
      ],
      rules,
      3,
    );
    expect(out.map((r) => [r.phrase, r.level])).toEqual([
      ["garantili", "red"],
      ["%100", "yellow"],
      ["en iyi", "dikkat"],
    ]);
    expect(topRiskyPhrases([finding({ ruleId: "R-REVIEW", matchedText: "mucize", severity: "red" })], rules)[0].level).toBe("dikkat");
    expect(topRiskyPhrases([], rules)).toEqual([]);
  });
});

describe("pasted platform variants (P9.3)", () => {
  it("one variant per line; bullets, numbering, labels and quotes removed; repeats dropped", () => {
    const raw = "1. Yazın en hafif desteği\n- 7 günde fark gör\r\n\n• “Cildine doğal bakım”\nBaşlık 2: Hemen keşfet\n7 günde fark gör\nab\n";
    expect(parseVariantLines(raw)).toEqual(["Yazın en hafif desteği", "7 günde fark gör", "Cildine doğal bakım", "Hemen keşfet"]);
  });

  it("enforces the line limits: 20 in the panel, 5 without an account", () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `Varyant numara ${i + 1}`);
    expect(pasteProblem(lines(20), PASTE_MAX.panel)).toBeNull();
    expect(pasteProblem(lines(21), PASTE_MAX.panel)).toMatch(/en fazla 20/);
    expect(pasteProblem(lines(5), PASTE_MAX.public)).toBeNull();
    expect(pasteProblem(lines(6), PASTE_MAX.public)).toMatch(/en fazla 5/);
    expect(pasteProblem([], PASTE_MAX.public)).toMatch(/En az bir/);
    expect(pasteProblem(["x".repeat(VARIANT_MAX_CHARS + 1)], PASTE_MAX.panel)).toMatch(/karakter/);
  });

  it("copies the three safest variants, risky ones in their safe version", () => {
    const row = (n: number, red: number, yellow: number, score: number): VariantRow => ({
      n,
      text: `metin ${n}`,
      platformScore: score,
      platformLevel: "low",
      legalLevel: "low",
      red,
      yellow,
      top: null,
      safeText: `güvenli ${n}`,
    });
    expect(safestVariants([row(1, 1, 0, 60), row(2, 0, 0, 5), row(3, 0, 1, 25), row(4, 0, 0, 0), row(5, 2, 0, 90)])).toEqual(["metin 4", "metin 2", "güvenli 3"]);
  });
});
