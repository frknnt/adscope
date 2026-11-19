import type { RuleCardDef } from "./catalog";

export interface RuleTrustStats {
  /** Public cards: everything except drafts and retired cards. */
  total: number;
  /** Cards whose substance was read on an official source page (may produce red/yellow findings). */
  active: number;
  /** Cards still waiting for verification (info notes only). */
  inReview: number;
  /** Cards approved in the expert (lawyer) review table. */
  lawyerReviewed: number;
  /** Latest verification or review date among public cards (YYYY-MM-DD), or null. */
  lastUpdated: string | null;
}

/**
 * Trust counters for the public pages. Always derived from the catalog, never typed by hand, so the
 * numbers on the landing page and /kurallar change with every card that is added, verified or retired.
 */
export function ruleTrustStats(cards: readonly RuleCardDef[]): RuleTrustStats {
  const pub = cards.filter((c) => c.status === "active" || c.status === "requires_review");
  const dates = pub.map((c) => c.lastVerifiedAt).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d));
  return {
    total: pub.length,
    active: pub.filter((c) => c.status === "active").length,
    inReview: pub.filter((c) => c.status === "requires_review").length,
    lawyerReviewed: pub.filter((c) => c.legalReviewStatus === "reviewed").length,
    lastUpdated: dates.length ? dates.map((d) => d.slice(0, 10)).sort().at(-1)! : null,
  };
}

export type RuleStatusFilter = "hepsi" | "dogrulandi" | "inceleme";

export function parseRuleStatusFilter(v: string | string[] | undefined): RuleStatusFilter {
  return v === "dogrulandi" || v === "inceleme" ? v : "hepsi";
}

export function matchesRuleStatusFilter(card: Pick<RuleCardDef, "status">, f: RuleStatusFilter): boolean {
  if (f === "dogrulandi") return card.status === "active";
  if (f === "inceleme") return card.status === "requires_review";
  return card.status === "active" || card.status === "requires_review";
}
