import { describe, expect, it } from "vitest";
import { buildAppeal } from "@/lib/engine/appeal";
import { runPipeline } from "@/lib/engine/pipeline";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { creativeScore, legalRisk, metaRisk } from "@/lib/engine/scoring";
import { findMatches, fold } from "@/lib/engine/text";
import type { AdInput } from "@/lib/engine/types";
import { catalogRules } from "@/lib/data/memory-repo";
import { RULE_CATALOG, rulesForSector } from "@/lib/rules/catalog";

const rules = catalogRules();
const sample: AdInput = {
  sector: "takviye_gida",
  headline: "Yazın en etkili desteği",
  primaryText: "7 günde 5 kilo ver! Garantili sonuç, %70 indirim. En etkili detoks çayı. Hemen sipariş ver.",
  description: "",
  flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
  image: { mime: "image/png", width: 1080, height: 1080, sizeBytes: 400_000 },
};
const FORBIDDEN = [/kesin onay/i, /hukuken uygun/i, /reklam reddedilmez/i];

describe("text folding", () => {
  it("folds Turkish characters 1:1 and keeps indices aligned", () => {
    expect(fold("İŞÇİ ĞÜLÖ ılık")).toBe("isci gulo ilik");
    const original = "GARANTİLİ Sonuç";
    expect(fold(original)).toHaveLength(original.length);
    const m = findMatches(original, "garantili sonuc");
    expect(m[0].text).toBe("GARANTİLİ Sonuç");
  });
});

describe("rule catalog", () => {
  it("every rule card carries the required metadata", () => {
    for (const r of RULE_CATALOG) {
      expect(r.id).toMatch(/^[A-Z0-9-]+$/);
      expect(r.sourceUrl).toMatch(/^https:\/\//);
      expect(r.sourceOrg.length).toBeGreaterThan(2);
      expect(r.version).toBeGreaterThanOrEqual(1);
      expect(r.safeFix.length).toBeGreaterThan(5);
      if (r.status === "active") {
        expect(r.lastVerifiedAt, r.id).toBeTruthy();
        expect(r.matchPatterns.length + (r.flagTrigger ? 1 : 0), r.id).toBeGreaterThan(0);
      }
      for (const p of r.matchPatterns) expect(() => new RegExp(p, "gi")).not.toThrow();
    }
    expect(new Set(RULE_CATALOG.map((r) => r.id)).size).toBe(RULE_CATALOG.length);
  });
  it("sector selection never includes drafts", () => {
    expect(rulesForSector("takviye_gida").some((r) => r.status === "draft")).toBe(false);
  });
});

describe("rule engine", () => {
  it("flags the sample ad with red/yellow/info findings tied to rule cards", () => {
    const f = runRuleEngine(sample, rules.filter((r) => r.status !== "draft"));
    const byRule = Object.fromEntries(f.map((x) => [x.ruleId, x]));
    expect(byRule["META-UO-TIMEFRAME"].severity).toBe("red");
    expect(byRule["META-UO-TIMEFRAME"].matchedText?.toLowerCase()).toContain("7 günde 5 kilo");
    expect(byRule["TR-RY-INDIRIM-REFERANS"].severity).toBe("yellow");
    for (const x of f) expect(x.ruleId).toBeTruthy();
  });

  it("requires_review rules only produce info findings and never raise risk levels", () => {
    const f = runRuleEngine(sample, rules.filter((r) => r.status !== "draft"));
    for (const x of f.filter((x) => x.ruleStatus === "requires_review")) expect(x.severity).toBe("info");
    const onlyUnverified = f.filter((x) => x.ruleStatus === "requires_review");
    expect(legalRisk(onlyUnverified).level).toBe("low");
    expect(metaRisk("genel", onlyUnverified).score).toBe(5);
  });

  it("draft rules are ignored even if passed in", () => {
    const draft = rules.find((r) => r.status === "draft")!;
    const text = draft.riskyExamples[0] ?? "ücretsiz";
    const f = runRuleEngine({ ...sample, primaryText: text }, [draft]);
    expect(f).toHaveLength(0);
  });

  it("flag-driven rules fire from wizard checkboxes", () => {
    const f = runRuleEngine({ ...sample, flags: { influencerPost: true, aiHumanCharacter: true, aiRealPersonCopy: false } }, rules);
    expect(f.map((x) => x.ruleId)).toEqual(expect.arrayContaining(["TR-RY-ETKILEYICI-IBARE", "TR-RY-YZ-KARAKTER"]));
    const labelled = runRuleEngine({ ...sample, primaryText: `Reklam | ${sample.primaryText}`, flags: { ...sample.flags, influencerPost: true } }, rules);
    expect(labelled.map((x) => x.ruleId)).not.toContain("TR-RY-ETKILEYICI-IBARE");
  });

  it("a clean ad yields no findings", () => {
    const f = runRuleEngine({ ...sample, headline: "Yeni sezon tişörtler", primaryText: "Pamuklu yeni sezon tişörtlerimiz sitede. Beden tablosuna göz atın." }, rules);
    expect(f.filter((x) => x.severity !== "info")).toHaveLength(0);
  });
});

describe("scoring", () => {
  it("is deterministic and explainable", async () => {
    const a = await runPipeline({ input: sample, rules, ai: null });
    const b = await runPipeline({ input: sample, rules, ai: null });
    expect(a.result.meta_risk_score).toBe(b.result.meta_risk_score);
    expect(a.result.creative_score).toBe(b.result.creative_score);
    const bd = a.result.score_breakdown;
    const sum = Math.min(100, bd.meta.base + bd.meta.items.reduce((s, i) => s + i.points, 0));
    expect(a.result.meta_risk_score).toBe(sum);
    expect(bd.creative.reduce((s, c) => s + c.score, 0)).toBe(a.result.creative_score);
    expect(a.result.meta_risk_level).toBe("high");
  });

  it("creative score penalises low resolution and missing CTA", () => {
    const good = creativeScore(sample).score;
    const bad = creativeScore({ ...sample, primaryText: "Ürünümüz burada.", image: { mime: "image/png", width: 300, height: 900, sizeBytes: 1000 } }).score;
    expect(bad).toBeLessThan(good);
  });
});

describe("pipeline outputs", () => {
  it("produces safe text and exactly 5 variants that re-check without red flags", async () => {
    const { result } = await runPipeline({ input: sample, rules, ai: null });
    expect(result.safe_text.length).toBeGreaterThan(10);
    const variants = result.variants.filter((v) => v.kind === "variant");
    expect(variants).toHaveLength(5);
    for (const v of result.variants) expect(v.recheck_red).toBe(0);
    expect(result.safe_text.toLowerCase()).not.toContain("7 günde 5 kilo");
  });

  it("never emits guarantee language anywhere", async () => {
    const { result } = await runPipeline({ input: { ...sample, rejectionMessage: "Your ad was rejected for unrealistic outcomes" }, rules, ai: null });
    const blob = JSON.stringify(result);
    for (const re of FORBIDDEN) expect(blob).not.toMatch(re);
  });
});

describe("appeal assistant", () => {
  it("recommends a new ad when the rejection matches an active red finding", async () => {
    const { result } = await runPipeline({ input: { ...sample, rejectionMessage: "Your ad wasn't approved: unrealistic outcomes" }, rules, ai: null });
    expect(result.appeal?.recommendation).toBe("new_ad");
    expect(result.appeal?.draft_en).toMatch(/Hello/);
    expect(result.appeal?.draft_tr.length).toBeGreaterThan(50);
  });
  it("recommends an appeal when nothing risky was found", () => {
    const a = buildAppeal({ rejectionMessage: "Rejected: misleading", findings: [], safeText: "Yeni sezon tişörtler", headline: "Tişört" });
    expect(a.recommendation).toBe("appeal");
    for (const re of FORBIDDEN) expect(JSON.stringify(a)).not.toMatch(re);
  });
});
