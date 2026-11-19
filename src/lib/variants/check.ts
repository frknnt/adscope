import "server-only";
import { runPipeline } from "@/lib/engine/pipeline";
import type { RuleRecord } from "@/lib/engine/types";
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import type { VariantRow } from "./paste";

const RANK = { red: 0, yellow: 1, info: 2 } as const;

/**
 * Rule check of pasted platform variants: the same engine as the bulk check, no AI, no credits and
 * nothing stored. Texts are untrusted input and are only text-matched.
 */
export async function checkVariantLines(
  p: { rules: RuleRecord[]; platform: Platform; sector: Sector; brandVoice?: { bannedWords: string[]; preferredCta: string | null; voiceNotes: string | null } | null },
  lines: string[],
): Promise<VariantRow[]> {
  const usable = p.rules.filter((r) => (r.sector === "genel" || r.sector === p.sector) && ruleAppliesTo(r, p.platform));
  const byVersion = new Map(p.rules.map((r) => [r.versionId, r]));
  const rows: VariantRow[] = [];
  for (const [i, text] of lines.entries()) {
    const { result } = await runPipeline({
      input: { sector: p.sector, platform: p.platform, headline: "", primaryText: text, description: "", brandVoice: p.brandVoice ?? null, flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
      rules: usable,
      ai: null,
    });
    const ruled = result.findings.filter((f) => f.rule_version_id).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    const top = ruled[0];
    const rule = top?.rule_version_id ? byVersion.get(top.rule_version_id) : undefined;
    rows.push({
      n: i + 1,
      text,
      platformScore: result.meta_risk_score,
      platformLevel: result.meta_risk_level,
      legalLevel: result.legal_risk_level,
      red: ruled.filter((f) => f.severity === "red").length,
      yellow: ruled.filter((f) => f.severity === "yellow").length,
      top: top ? { title: top.title, matched: top.matched_text, ruleId: rule?.id ?? null, verified: rule?.status === "active" } : null,
      safeText: result.safe_text,
    });
  }
  return rows;
}
