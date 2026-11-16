import { findMatches, fold } from "./text";
import type { AdInput, EngineFinding, Field, RuleRecord, Severity } from "./types";

const TEXT_FIELDS: { key: Field; get: (i: Pick<AdInput, "headline" | "primaryText" | "description">) => string }[] = [
  { key: "headline", get: (i) => i.headline },
  { key: "primary_text", get: (i) => i.primaryText },
  { key: "description", get: (i) => i.description },
];

export function severityFor(rule: Pick<RuleRecord, "status" | "riskLevel">): Severity {
  if (rule.status !== "active") return "info";
  if (rule.riskLevel === "high") return "red";
  if (rule.riskLevel === "medium") return "yellow";
  return "info";
}

function hasAdLabel(input: Pick<AdInput, "headline" | "primaryText" | "description">) {
  const all = fold(`${input.headline} ${input.primaryText} ${input.description}`);
  return /(^|[^a-z])(reklam|tanitim)([^a-z]|$)/.test(all);
}

function toFinding(rule: RuleRecord, field: Field, matchedText: string | null): EngineFinding {
  const unverified = rule.status !== "active";
  return {
    ruleId: rule.id,
    ruleVersionId: rule.versionId,
    ruleStatus: rule.status,
    domain: rule.domain,
    severity: severityFor(rule),
    field,
    matchedText,
    title: rule.title,
    explanation: unverified
      ? `${rule.description} Bu kural henüz resmî kaynaktan doğrulanmadığı için yalnızca bilgilendirme amaçlıdır; ihlal olarak sayılmaz.`
      : rule.description,
    suggestion: rule.safeFix,
    origin: "rule_engine",
  };
}

/**
 * Deterministic rule matching. Only rules passed in are considered; callers pass the
 * active + requires_review rules for the sector. Draft/retired rules must never be passed.
 */
export function runRuleEngine(
  input: Pick<AdInput, "headline" | "primaryText" | "description" | "flags">,
  rules: RuleRecord[],
): EngineFinding[] {
  const findings: EngineFinding[] = [];
  const labelled = hasAdLabel(input);

  for (const rule of rules) {
    if (rule.status !== "active" && rule.status !== "requires_review") continue;

    // Flag-driven rules (wizard checkboxes)
    if (rule.flagTrigger === "ai_human_character" && input.flags.aiHumanCharacter) {
      const disclosed = /yapay zeka ile (olusturul|uretil)/.test(
        fold(`${input.headline} ${input.primaryText} ${input.description}`),
      );
      if (!disclosed) findings.push(toFinding(rule, "image", null));
      continue;
    }
    if (rule.flagTrigger === "ai_real_person_copy") {
      if (input.flags.aiRealPersonCopy) findings.push(toFinding(rule, "image", null));
      continue;
    }

    let matched: EngineFinding | null = null;
    for (const field of TEXT_FIELDS) {
      const value = field.get(input);
      if (!value) continue;
      for (const pattern of rule.matchPatterns) {
        const hit = findMatches(value, pattern, 1)[0];
        if (hit) {
          matched = toFinding(rule, field.key, hit.text.trim());
          break;
        }
      }
      if (matched) break;
    }

    if (rule.flagTrigger === "influencer_post") {
      // Influencer rule fires when the post is marked as influencer content OR uses
      // collaboration wording, and no "Reklam"/"Tanıtım" label is present.
      if (labelled) continue;
      if (!matched && input.flags.influencerPost) matched = toFinding(rule, "general", null);
    }

    if (matched) findings.push(matched);
  }

  const order: Record<Severity, number> = { red: 0, yellow: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
