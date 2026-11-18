import "server-only";
import { NextResponse } from "next/server";
import { getAdminRepo } from "@/lib/data";
import type { AnalysisDetail, DataRepo, SessionUser } from "@/lib/data/types";
import { hashToken } from "@/lib/security/tokens";
import { limit } from "@/lib/security/limiter";

export const API_DISCLAIMER = "Risk değerlendirmesidir, hukuki görüş değildir.";

export function apiJson(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export function apiError(status: number, code: string, message: string, extra: Record<string, string> = {}) {
  return apiJson(status, { ok: false, error: { code, message } }, extra);
}

/** Resolves "Authorization: Bearer ads_live_…" to the key owner and a repo acting as them. */
export async function authenticate(req: Request): Promise<{ user: SessionUser; repo: DataRepo } | Response> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(ads_live_[A-Za-z0-9_-]{30,80})$/.exec(header.trim());
  if (!m) return apiError(401, "unauthorized", "Geçerli bir API anahtarı gönderin (Authorization: Bearer …).");
  const hash = hashToken(m[1]);
  const limited = await limit(`api:${hash.slice(0, 24)}`, 30, 60_000);
  if (!limited.ok) return apiError(429, "rate_limited", "Dakikada en fazla 30 istek.", { "Retry-After": String(limited.retryAfterSec) });
  const admin = getAdminRepo();
  const user = await admin.resolveApiKey(hash);
  if (!user) return apiError(401, "unauthorized", "API anahtarı geçersiz veya iptal edilmiş.");
  return { user, repo: admin.repoForUser(user) };
}

/** Public JSON shape of a report (stable field names, no internal ids beyond the analysis id). */
export function serializeAnalysis(a: AnalysisDetail) {
  return {
    id: a.id,
    status: a.status,
    failure_code: a.failureCode,
    created_at: a.createdAt,
    completed_at: a.completedAt,
    platform: a.platform,
    sector: a.sector,
    media_type: a.mediaType,
    credit_cost: a.creditCost,
    scores:
      a.status === "completed"
        ? {
            platform_risk: { score: a.metaRiskScore, level: a.metaRiskLevel },
            legal_risk: { level: a.legalRiskLevel, verified_findings: a.legalFindingCount },
            creative_score: a.creativeScore,
          }
        : null,
    findings: a.findings.map((f) => ({
      severity: f.severity,
      domain: f.domain,
      field: f.field,
      matched_text: f.matchedText,
      title: f.title,
      explanation: f.explanation,
      suggestion: f.suggestion,
      origin: f.origin,
      rule: f.rule
        ? { id: f.rule.id, version: f.rule.version, status: f.rule.status, source: { org: f.rule.sourceOrg, title: f.rule.sourceTitle, url: f.rule.sourceUrl }, last_verified_at: f.rule.lastVerifiedAt }
        : null,
    })),
    safe_text: a.safeText,
    variants: a.variants.map((v) => ({ kind: v.kind, tone: v.tone, headline: v.headline, primary_text: v.primaryText, description: v.description, recheck: { red: v.recheckRed, yellow: v.recheckYellow } })),
    dm: a.scoreBreakdown?.dm ?? null,
    disclaimer: API_DISCLAIMER,
  };
}
