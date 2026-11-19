import { describe, expect, it } from "vitest";
import { RULE_CATALOG, type RuleCardDef } from "@/lib/rules/catalog";
import { matchesRuleStatusFilter, parseRuleStatusFilter, ruleTrustStats } from "@/lib/rules/stats";

const card = (over: Partial<RuleCardDef>): RuleCardDef => ({ ...RULE_CATALOG[0], ...over });

describe("rule trust stats", () => {
  it("counts the catalog itself, without drafts or retired cards", () => {
    const s = ruleTrustStats(RULE_CATALOG);
    const pub = RULE_CATALOG.filter((r) => r.status === "active" || r.status === "requires_review");
    expect(s.total).toBe(pub.length);
    expect(s.active).toBe(RULE_CATALOG.filter((r) => r.status === "active").length);
    expect(s.inReview).toBe(RULE_CATALOG.filter((r) => r.status === "requires_review").length);
    expect(s.active + s.inReview).toBe(s.total);
    expect(s.lawyerReviewed).toBe(pub.filter((r) => r.legalReviewStatus === "reviewed").length);
    expect(s.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("counts lawyer approvals and takes the latest verification date", () => {
    const s = ruleTrustStats([
      card({ status: "active", legalReviewStatus: "reviewed", lastVerifiedAt: "2026-11-20" }),
      card({ status: "active", legalReviewStatus: "pending", lastVerifiedAt: "2026-11-16" }),
      card({ status: "requires_review", legalReviewStatus: "changes_requested", lastVerifiedAt: "2026-11-18" }),
      card({ status: "draft", legalReviewStatus: "reviewed", lastVerifiedAt: "2027-01-01" }),
      card({ status: "retired", legalReviewStatus: "reviewed", lastVerifiedAt: "2027-01-02" }),
    ]);
    expect(s).toEqual({ total: 3, active: 2, inReview: 1, lawyerReviewed: 1, lastUpdated: "2026-11-20" });
    expect(ruleTrustStats([]).lastUpdated).toBeNull();
  });

  it("filters by status and ignores unknown filter values", () => {
    expect(parseRuleStatusFilter("dogrulandi")).toBe("dogrulandi");
    expect(parseRuleStatusFilter("inceleme")).toBe("inceleme");
    expect(parseRuleStatusFilter("draft")).toBe("hepsi");
    expect(parseRuleStatusFilter(["dogrulandi"])).toBe("hepsi");
    expect(matchesRuleStatusFilter({ status: "active" }, "dogrulandi")).toBe(true);
    expect(matchesRuleStatusFilter({ status: "requires_review" }, "dogrulandi")).toBe(false);
    expect(matchesRuleStatusFilter({ status: "requires_review" }, "inceleme")).toBe(true);
    expect(matchesRuleStatusFilter({ status: "draft" }, "hepsi")).toBe(false);
  });
});
