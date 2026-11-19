import type { EngineFinding, RuleRecord } from "@/lib/engine/types";

export interface RiskyPhrase {
  phrase: string;
  title: string;
  /** red/yellow only come from verified (active) cards; an unverified card stays "dikkat". */
  level: "red" | "yellow" | "dikkat";
  ruleId: string | null;
  verified: boolean;
}

const ORDER = { red: 0, yellow: 1, dikkat: 2 } as const;

/** The first risky phrases on a page: wording matches only, most severe first, one per phrase. */
export function topRiskyPhrases(findings: EngineFinding[], rules: Pick<RuleRecord, "id" | "status">[], max = 3): RiskyPhrase[] {
  const status = new Map(rules.map((r) => [r.id, r.status]));
  const seen = new Set<string>();
  const out: RiskyPhrase[] = [];
  for (const f of findings) {
    if (!f.matchedText) continue;
    const verified = f.ruleId ? status.get(f.ruleId) === "active" : false;
    const level: RiskyPhrase["level"] = verified && f.severity === "red" ? "red" : verified && f.severity === "yellow" ? "yellow" : "dikkat";
    const key = f.matchedText.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ phrase: f.matchedText.slice(0, 120), title: f.title, level, ruleId: f.ruleId, verified });
  }
  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]).slice(0, max);
}
