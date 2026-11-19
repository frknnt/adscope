/**
 * Live compliance hints (P10.2): the same rule engine as the report, run in the browser on the
 * bundled catalog while the user types. Informational only: no credit, no request to the server.
 * Levels match the report: a card that is not `active` yields "info", never a violation.
 */
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import { RULE_CATALOG, type Sector } from "@/lib/rules/catalog";
import { sanitize } from "./rewrite";
import { runRuleEngine } from "./rule-engine";
import type { RuleRecord, Severity } from "./types";

export interface LiveFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  /** The phrase as written in the text. */
  matchedText: string;
  explanation: string;
  suggestion: string;
  /** True when the card is still awaiting expert review (shown as information). */
  unverified: boolean;
  /** The whole text with this card's safe replacements applied; null when there is no ready replacement. */
  safeText: string | null;
}

const cache = new Map<string, RuleRecord[]>();

/** Usable cards for a sector and platform, in the shape the server's repositories return. */
export function liveRules(sector: Sector, platform: Platform): RuleRecord[] {
  const key = `${sector}:${platform}`;
  let rules = cache.get(key);
  if (!rules) {
    rules = RULE_CATALOG.filter((r) => (r.status === "active" || r.status === "requires_review") && (r.sector === "genel" || r.sector === sector) && ruleAppliesTo(r, platform)).map((r) => ({ ...r, versionId: `demo-${r.id}-v${r.version}` }));
    cache.set(key, rules);
  }
  return rules;
}

export function liveCheck(text: string, sector: Sector, platform: Platform): LiveFinding[] {
  if (!text.trim()) return [];
  const rules = liveRules(sector, platform);
  const byId = new Map(rules.map((r) => [r.id, r]));
  const findings = runRuleEngine({ headline: "", primaryText: text, description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } }, rules);
  const out: LiveFinding[] = [];
  for (const f of findings) {
    const rule = f.ruleId ? byId.get(f.ruleId) : undefined;
    if (!rule || !f.matchedText) continue;
    const safe = sanitize(text, [rule]);
    out.push({
      ruleId: rule.id,
      title: f.title,
      severity: f.severity,
      matchedText: f.matchedText,
      explanation: f.explanation,
      suggestion: f.suggestion,
      unverified: rule.status !== "active",
      safeText: safe && safe !== text.trim() && safe !== text ? safe : null,
    });
  }
  return out;
}
