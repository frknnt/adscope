import type { AiProvider, AiResult } from "@/lib/ai/provider";
import { buildAppeal } from "./appeal";
import { landingChecks } from "./landing";
import { videoFindings } from "./video";
import { buildSafeText, buildVariants } from "./rewrite";
import { runRuleEngine, severityFor } from "./rule-engine";
import { buildBreakdown, type VisualAssessment } from "./scoring";
import { fold, tidy } from "./text";
import type { AdInput, AnalysisResult, EngineFinding, LandingReport, RuleRecord, VariantOut } from "./types";

export const ENGINE_VERSION = "adscope-engine/1.0.0";

export interface PipelineOutput {
  result: AnalysisResult;
  ai: AiResult | null;
}

function fieldValue(input: AdInput, field: string) {
  if (field === "headline") return input.headline;
  if (field === "primary_text") return input.primaryText;
  if (field === "description") return input.description;
  if (field === "transcript") return input.transcript ?? "";
  return "";
}

/** Accept AI findings only if they cite a supplied rule and quote text that is actually in the ad. */
export function acceptAiFindings(input: AdInput, rules: RuleRecord[], ai: AiResult, existing: EngineFinding[]): EngineFinding[] {
  if (!ai.ok) return [];
  const byId = new Map(rules.map((r) => [r.id, r]));
  const seen = new Set(existing.map((f) => f.ruleId));
  const out: EngineFinding[] = [];
  for (const f of ai.data.findings) {
    const rule = byId.get(f.rule_id);
    if (!rule || seen.has(rule.id)) continue;
    if (rule.status !== "active" && rule.status !== "requires_review") continue;
    if (f.field !== "image") {
      // Text findings must quote the ad itself; a quote that is not there is dropped.
      if (!f.matched_text) continue;
      if (!fold(fieldValue(input, f.field)).includes(fold(f.matched_text))) continue;
    }
    seen.add(rule.id);
    const unverified = rule.status !== "active";
    out.push({
      ruleId: rule.id,
      ruleVersionId: rule.versionId,
      ruleStatus: rule.status,
      domain: rule.domain,
      severity: severityFor(rule),
      field: f.field,
      matchedText: f.matched_text,
      title: rule.title,
      explanation: unverified
        ? `${f.explanation_tr} (Bu kural henüz resmî kaynaktan doğrulanmadı; yalnızca bilgilendirme amaçlıdır.)`
        : f.explanation_tr,
      suggestion: f.suggestion_tr,
      origin: "ai",
    });
  }
  return out;
}

export async function runPipeline(params: {
  input: AdInput;
  rules: RuleRecord[];
  ai?: AiProvider | null;
  /** The image creative, or a video's frames in time order. Sent to the AI provider only. */
  images?: { base64: string; mime: "image/jpeg" | "image/png" | "image/webp"; label?: string }[];
}): Promise<PipelineOutput> {
  const { input } = params;
  // Never let draft/retired rules into the engine.
  const rules = params.rules.filter((r) => r.status === "active" || r.status === "requires_review");

  let findings = runRuleEngine(input, rules);

  let ai: AiResult | null = null;
  if (params.ai?.enabled) {
    ai = await params.ai.analyze({
      input,
      rules: rules.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        riskyExamples: r.riskyExamples,
        domain: r.domain,
        status: r.status,
      })),
      images: params.images ?? [],
    });
    findings = [...findings, ...acceptAiFindings(input, rules, ai, findings)];
  }

  // Video and landing page notes (creative_quality heuristics, never policy/legal violations).
  findings = [...findings, ...videoFindings(input)];
  let landingReport: LandingReport | null = null;
  if (input.landing) {
    const lc = landingChecks(input, input.landing);
    landingReport = lc.report;
    findings = [...findings, ...lc.findings];
  }

  const order = { red: 0, yellow: 1, info: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const visual: VisualAssessment | null =
    ai?.ok
      ? {
          textDensity: ai.data.visual.text_density,
          productVisibility: ai.data.visual.product_visibility,
          brandConsistency: ai.data.visual.brand_consistency,
          notes: ai.data.visual.notes_tr,
        }
      : null;

  const { breakdown, meta, legal, creative } = buildBreakdown(input, findings, visual, landingReport);

  // Safe text: deterministic by default; AI text accepted only if it passes the rule re-check.
  const activeRules = rules.filter((r) => r.status === "active");
  let safeText = buildSafeText(input, findings, rules);
  if (ai?.ok) {
    const candidate = tidy(ai.data.safe_text);
    const recheck = runRuleEngine({ headline: "", primaryText: candidate, description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } }, activeRules);
    if (!recheck.some((f) => f.severity !== "info")) safeText = candidate;
  }

  let variants: VariantOut[] = buildVariants(input, safeText, rules);
  if (ai?.ok) {
    variants = variants.map((fallback, idx) => {
      const v = ai.data.variants[idx];
      if (!v) return fallback;
      const recheck = runRuleEngine(
        { headline: v.headline, primaryText: v.primary_text, description: v.description, flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
        activeRules,
      );
      const red = recheck.filter((f) => f.severity === "red").length;
      if (red > 0) return fallback;
      return {
        kind: "variant",
        position: fallback.position,
        tone: v.tone,
        headline: v.headline,
        primary_text: v.primary_text,
        description: v.description,
        recheck_red: 0,
        recheck_yellow: recheck.filter((f) => f.severity === "yellow").length,
      };
    });
  }
  const safeVariant: VariantOut = {
    kind: "safe",
    position: 0,
    tone: "Güvenli metin",
    headline: variants[0]?.headline ?? input.headline,
    primary_text: safeText,
    description: input.description,
    recheck_red: 0,
    recheck_yellow: 0,
  };

  const appeal = input.rejectionMessage?.trim()
    ? buildAppeal({ rejectionMessage: input.rejectionMessage, findings, safeText, headline: input.headline })
    : undefined;

  const result: AnalysisResult = {
    engine_version: ENGINE_VERSION,
    ai_provider: ai?.ok ? `${ai.meta.provider}:${ai.meta.model}` : ai ? "deterministic (YZ yanıtı kullanılamadı)" : "deterministic",
    meta_risk_score: meta.score,
    meta_risk_level: meta.level,
    legal_risk_level: legal.level,
    legal_finding_count: legal.count,
    creative_score: creative,
    score_breakdown: breakdown,
    safe_text: safeText,
    findings: findings.map((f) => ({
      domain: f.domain,
      severity: f.severity,
      field: f.field,
      title: f.title,
      explanation: f.explanation,
      suggestion: f.suggestion,
      origin: f.origin,
      rule_version_id: f.ruleVersionId,
      matched_text: f.matchedText,
    })),
    variants: [safeVariant, ...variants],
    appeal,
  };
  return { result, ai };
}
