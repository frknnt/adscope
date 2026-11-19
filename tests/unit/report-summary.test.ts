import { describe, expect, it } from "vitest";
import type { FindingView } from "@/lib/data/types";
import { fixFirst, resultSentence } from "@/lib/report/summary";

const f = (over: Partial<FindingView>): FindingView => ({ id: Math.random().toString(36), severity: "yellow", domain: "meta_policy", title: "Başlık", explanation: "", suggestion: "Öneri", matchedText: null, rule: null, ...over }) as FindingView;
const active = { id: "r", version: 1, status: "active" } as FindingView["rule"];
const review = { id: "r2", version: 1, status: "requires_review" } as FindingView["rule"];

describe("report summary", () => {
  it("names a legal violation only when an active rule card backs it", () => {
    expect(resultSentence({ platform: "meta", metaRiskLevel: "high", findings: [f({ severity: "red", domain: "tr_law", rule: active })] })).toMatch(/doğrulanmış bir mevzuat kuralına takılan 1 ifade/);
    const s = resultSentence({ platform: "meta", metaRiskLevel: "high", findings: [f({ severity: "red", domain: "tr_law", rule: review })] });
    expect(s).not.toMatch(/mevzuat/);
    expect(s).toMatch(/Meta incelemesinde ret riski yüksek/);
  });

  it("does not call a finding a legal violation without an active card behind it", () => {
    const cases = [
      f({ severity: "red", domain: "tr_law", rule: null }),
      f({ severity: "yellow", domain: "tr_law", rule: active }),
      f({ severity: "red", domain: "meta_policy", rule: active }),
    ];
    for (const finding of cases) expect(resultSentence({ platform: "meta", metaRiskLevel: "medium", findings: [finding] })).not.toMatch(/mevzuat/);
  });

  it("never promises approval", () => {
    const quiet = resultSentence({ platform: "tiktok", metaRiskLevel: "low", findings: [] });
    expect(quiet).toMatch(/onaylanacağı anlamına gelmez/);
    expect(resultSentence({ platform: "google_ads", metaRiskLevel: "low", findings: [f({})] })).toMatch(/1 ifade dikkat gerektiriyor/);
    for (const s of [quiet]) expect(s).not.toMatch(/kesin onay|hukuken uygun|reddedilmez/i);
  });

  it("puts a verified legal red first, then platform reds, then yellows", () => {
    const y = f({ title: "sarı" });
    const pr = f({ severity: "red", title: "platform kırmızı" });
    const lr = f({ severity: "red", domain: "tr_law", rule: active, title: "mevzuat kırmızı" });
    expect(fixFirst([y, pr, lr])?.title).toBe("mevzuat kırmızı");
    expect(fixFirst([y, pr])?.title).toBe("platform kırmızı");
    expect(fixFirst([f({ severity: "info" })])).toBeNull();
  });
});
