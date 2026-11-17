import { describe, expect, it } from "vitest";
import type { AiProvider, AiResult } from "@/lib/ai/provider";
import { AiAnalysisSchema } from "@/lib/ai/schema";
import { acceptAiFindings, runPipeline } from "@/lib/engine/pipeline";
import type { AdInput } from "@/lib/engine/types";
import { catalogRules } from "@/lib/data/memory-repo";

const rules = catalogRules().filter((r) => r.status !== "draft");
const input: AdInput = {
  sector: "genel",
  headline: "Kış koleksiyonu",
  primaryText: "Kaçırma, mucize fiyatlar sadece bugün. Hemen al.",
  description: "",
  flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
};
const meta = { provider: "fake", model: "fake-1", latencyMs: 1 };
const validData = {
  findings: [
    { rule_id: "META-UO-CLICKBAIT", field: "primary_text", matched_text: "mucize fiyatlar", explanation_tr: "Sansasyonel ifade tıklama tuzağı gibi algılanabilir.", suggestion_tr: "Somut fayda yazın." },
    { rule_id: "INVENTED-LAW-99", field: "primary_text", matched_text: "Hemen al", explanation_tr: "Uydurma kural, kabul edilmemeli.", suggestion_tr: "—————" },
    { rule_id: "META-UO-CURE", field: "primary_text", matched_text: "kanseri tedavi eder", explanation_tr: "Metinde geçmeyen bir ifade, kabul edilmemeli.", suggestion_tr: "Yok sayılmalı." },
  ],
  visual: { text_density: 7, product_visibility: 8, brand_consistency: 6, notes_tr: "Ürün net görünüyor." },
  safe_text: "Kış koleksiyonunda seçili ürünlerde bugüne özel fiyatlar. Ayrıntılar sitede.",
  variants: Array.from({ length: 5 }, (_, i) => ({ tone: `Ton ${i}`, headline: "Kış koleksiyonu", primary_text: "Seçili ürünlerde bugüne özel fiyatlar sitede.", description: "" })),
  video: null,
};

describe("AI schema validation", () => {
  it("accepts a valid response", () => {
    expect(AiAnalysisSchema.safeParse(validData).success).toBe(true);
  });
  it("rejects wrong variant count, bad enum and out-of-range scores", () => {
    expect(AiAnalysisSchema.safeParse({ ...validData, variants: validData.variants.slice(0, 4) }).success).toBe(false);
    expect(AiAnalysisSchema.safeParse({ ...validData, findings: [{ ...validData.findings[0], field: "body" }] }).success).toBe(false);
    expect(AiAnalysisSchema.safeParse({ ...validData, visual: { ...validData.visual, text_density: 11 } }).success).toBe(false);
  });
});

describe("AI findings are constrained to rule cards", () => {
  it("drops invented rule ids and quotes that are not in the ad", () => {
    const ai: AiResult = { ok: true, data: AiAnalysisSchema.parse(validData), meta };
    const accepted = acceptAiFindings(input, rules, ai, []);
    expect(accepted.map((f) => f.ruleId)).toEqual(["META-UO-CLICKBAIT"]);
    expect(accepted[0].origin).toBe("ai");
  });
});

describe("pipeline with a provider", () => {
  const provider = (result: AiResult): AiProvider => ({ name: "fake", enabled: true, analyze: async () => result });

  it("falls back to the deterministic engine when the provider fails", async () => {
    const { result, ai } = await runPipeline({ input, rules, ai: provider({ ok: false, reason: "schema_invalid", meta }) });
    expect(ai?.ok).toBe(false);
    expect(result.ai_provider).toMatch(/^deterministic/);
    expect(result.variants.filter((v) => v.kind === "variant")).toHaveLength(5);
  });

  it("uses AI visual scores and accepted findings when valid", async () => {
    const { result } = await runPipeline({ input, rules, ai: provider({ ok: true, data: AiAnalysisSchema.parse(validData), meta }) });
    expect(result.ai_provider).toBe("fake:fake-1");
    expect(result.score_breakdown.visualReviewedByAi).toBe(true);
    expect(result.findings.some((f) => f.title && f.origin === "ai")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("INVENTED-LAW-99");
  });
});
