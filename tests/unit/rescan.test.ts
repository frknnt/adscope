import { describe, expect, it } from "vitest";
import { catalogRules } from "@/lib/data/memory-repo";
import type { AnalysisSummary } from "@/lib/data/types";
import { rescanAnalyses } from "@/lib/engine/rescan";

const base: AnalysisSummary = {
  id: "a1",
  status: "completed",
  sector: "takviye_gida",
  headline: "",
  primaryText: "7 günde 5 kilo ver! Garantili sonuç.",
  metaRiskScore: 15,
  metaRiskLevel: "low",
  legalRiskLevel: "low",
  legalFindingCount: 0,
  platform: "meta",
  createdAt: "2026-10-01T10:00:00Z",
} as unknown as AnalysisSummary;

describe("rule-change rescan", () => {
  it("flags an old analysis whose text now matches active rules", () => {
    const hits = rescanAnalyses([base], catalogRules());
    expect(hits).toHaveLength(1);
    expect(hits[0].newMeta).toBeGreaterThan(15);
  });

  it("does not flag when the stored result is already as risky", () => {
    expect(rescanAnalyses([{ ...base, metaRiskScore: 100, legalFindingCount: 9 }], catalogRules())).toHaveLength(0);
    expect(rescanAnalyses([{ ...base, status: "failed" } as AnalysisSummary], catalogRules())).toHaveLength(0);
  });
});
