import type { CopyLine, CopyOutput } from "@/lib/copy/generate";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { sanitize } from "@/lib/engine/rewrite";
import { metaRisk } from "@/lib/engine/scoring";
import { fold } from "@/lib/engine/text";
import type { Level, RuleRecord } from "@/lib/engine/types";
import type { Sector } from "@/lib/rules/catalog";
import { CAMPAIGN_VARIANT_COUNT } from "./costs";

/** One ad of a campaign package: the words that go on the creative and into the CSV. */
export interface VariantText {
  headline: string;
  primaryText: string;
  cta: string;
}

export interface VariantCheck {
  /** Worst wording finding of the rule engine (only verified cards can be red; see severityFor). */
  risk: "ok" | "yellow" | "red";
  metaScore: number;
  metaLevel: Level;
  issues: string[];
  /** Same ad with the risky wording replaced, when there is something to replace. */
  safe: VariantText | null;
}

export interface CampaignVariant extends VariantText, VariantCheck {
  n: number;
  /** A risky generated line was swapped for its checked safe version. */
  safeApplied: boolean;
}

const NO_FLAGS = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };

/**
 * Rule check of one ad's words (headline, text and call to action together), the same engine as
 * the analysis and the creative studio. Rules that fire on what is missing do not apply here.
 */
export function checkVariant(v: VariantText, sector: Sector, rules: RuleRecord[]): VariantCheck {
  const findings = runRuleEngine({ headline: v.headline, primaryText: [v.primaryText, v.cta].filter(Boolean).join(" "), description: "", flags: NO_FLAGS }, rules).filter(
    (f) => f.matchedText && f.severity !== "info",
  );
  const risk: VariantCheck["risk"] = findings.some((f) => f.severity === "red") ? "red" : findings.length ? "yellow" : "ok";
  const meta = metaRisk(sector, findings);
  let safe: VariantText | null = null;
  if (risk !== "ok") {
    const matched = rules.filter((r) => findings.some((f) => f.ruleId === r.id));
    const s = { headline: sanitize(v.headline, matched), primaryText: sanitize(v.primaryText, matched), cta: sanitize(v.cta, matched) };
    if (fold(`${s.headline} ${s.primaryText} ${s.cta}`) !== fold(`${v.headline} ${v.primaryText} ${v.cta}`)) safe = s;
  }
  return { risk, metaScore: meta.score, metaLevel: meta.level, issues: [...new Set(findings.map((f) => f.title))], safe };
}

const lineText = (l: CopyLine | undefined) => (l ? { text: l.risk !== "ok" && l.safe ? l.safe : l.text, swapped: l.risk !== "ok" && Boolean(l.safe) } : { text: "", swapped: false });

/**
 * Pairs the generated headlines and texts into up to ten ads. A risky line that has a checked safe
 * version is replaced by it; every ad is then checked again as a whole.
 */
export function variantsFromCopy(copy: CopyOutput, sector: Sector, rules: RuleRecord[]): CampaignVariant[] {
  const count = Math.min(CAMPAIGN_VARIANT_COUNT, Math.max(copy.headlines.length, copy.primaryTexts.length));
  const out: CampaignVariant[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const h = lineText(copy.headlines[i % Math.max(1, copy.headlines.length)]);
    const p = lineText(copy.primaryTexts[i % Math.max(1, copy.primaryTexts.length)]);
    const c = lineText(copy.ctas[i % Math.max(1, copy.ctas.length)]);
    if (!h.text) continue;
    const key = fold(`${h.text}|${p.text}`);
    if (seen.has(key)) continue;
    seen.add(key);
    const text = { headline: h.text, primaryText: p.text, cta: c.text };
    out.push({ n: out.length + 1, ...text, ...checkVariant(text, sector, rules), safeApplied: h.swapped || p.swapped || c.swapped });
  }
  return out;
}

/** The three ads a package starts with: the least risky first, in their original order. */
export function defaultPicks(variants: Pick<CampaignVariant, "risk" | "metaScore">[], count: number): number[] {
  const rank = { ok: 0, yellow: 1, red: 2 } as const;
  return variants
    .map((v, i) => ({ i, r: rank[v.risk], s: v.metaScore }))
    .sort((a, b) => a.r - b.r || a.s - b.s || a.i - b.i)
    .slice(0, count)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

export const RISK_LABEL = { ok: "Eşleşen kural yok", yellow: "Sarı bayrak", red: "Kırmızı bayrak" } as const;
export const PACKAGE_NOTE = "Risk değerlendirmesidir, hukuki görüş değildir. Platformun reklamı onaylayacağını garanti etmez.";

/** Rows of the variant CSV inside the package. */
export function campaignCsvRows(variants: (VariantText & VariantCheck & { n: number; picked: boolean })[], platformLabel: string): unknown[][] {
  return [
    ["Sıra", "Görsele dönüştü", "Başlık", "Ana metin", "Çağrı", `${platformLabel} kural puanı`, "Risk", "Eşleşen kural kartları", "Güvenli başlık", "Güvenli ana metin", "Not"],
    ...variants.map((v) => [
      v.n,
      v.picked ? "Evet" : "Hayır",
      v.headline,
      v.primaryText,
      v.cta,
      v.metaScore,
      RISK_LABEL[v.risk],
      v.issues.join(" | "),
      v.safe?.headline ?? "",
      v.safe?.primaryText ?? "",
      PACKAGE_NOTE,
    ]),
  ];
}
