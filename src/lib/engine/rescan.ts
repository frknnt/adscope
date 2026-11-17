import type { AnalysisSummary } from "@/lib/data/types";
import { ruleAppliesTo } from "@/lib/platforms";
import { runRuleEngine } from "./rule-engine";
import { metaRisk } from "./scoring";
import type { RuleRecord } from "./types";

export interface RescanHit {
  id: string;
  label: string;
  createdAt: string;
  oldMeta: number;
  newMeta: number;
  oldLegal: number;
  newLegal: number;
  /** Titles of active rules that match today but did not raise the stored score. */
  titles: string[];
}

/**
 * "Kurallar değişti, eski reklamın artık risk taşıyor": re-runs today's active rules on the
 * text of past completed analyses. Only text is re-checked (no image, no AI), so a hit is reported
 * only when today's text-only result is strictly worse than the stored full result.
 */
export function rescanAnalyses(items: AnalysisSummary[], rules: RuleRecord[]): RescanHit[] {
  const active = rules.filter((r) => r.status === "active");
  const hits: RescanHit[] = [];
  for (const a of items) {
    if (a.status !== "completed" || a.metaRiskScore === null) continue;
    const set = active.filter((r) => (r.sector === "genel" || r.sector === a.sector) && ruleAppliesTo(r, a.platform));
    const found = runRuleEngine(
      { headline: a.headline, primaryText: a.primaryText, description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
      set,
    );
    const meta = metaRisk(a.sector, found).score;
    const legal = found.filter((f) => f.domain === "tr_law" && f.ruleStatus === "active").length;
    const oldLegal = a.legalFindingCount ?? 0;
    if (meta > a.metaRiskScore || legal > oldLegal) {
      hits.push({
        id: a.id,
        label: a.headline || a.primaryText.slice(0, 70),
        createdAt: a.createdAt,
        oldMeta: a.metaRiskScore,
        newMeta: Math.max(meta, a.metaRiskScore),
        oldLegal,
        newLegal: Math.max(legal, oldLegal),
        titles: found.filter((f) => f.severity !== "info").map((f) => f.title).slice(0, 3),
      });
    }
  }
  return hits;
}
