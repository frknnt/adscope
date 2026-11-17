"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { runPipeline } from "@/lib/engine/pipeline";
import type { Level } from "@/lib/engine/types";
import { PLATFORM_IDS, type Platform } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { clientIp, hashKey, rateLimit } from "@/lib/security/rate-limit";

export interface QuickFinding {
  severity: "red" | "yellow" | "info";
  title: string;
  matchedText: string | null;
  explanation: string;
  suggestion: string;
  verified: boolean;
  source: { org: string; title: string; url: string; ruleId: string } | null;
}

export type QuickCheckState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      platform: Platform;
      platformScore: number;
      platformLevel: Level;
      legalLevel: Level;
      legalCount: number;
      findings: QuickFinding[];
      hiddenCount: number;
      safeText: string;
    };

const schema = z.object({
  platform: z.enum(PLATFORM_IDS).default("meta"),
  sector: z.enum(SECTOR_IDS).default("genel"),
  headline: z.string().trim().max(255).default(""),
  primaryText: z.string().trim().min(10, "Reklam metnini yaz (en az 10 karakter).").max(2200, "Metin en fazla 2200 karakter olabilir."),
  // Honeypot: real users never fill it.
  website: z.string().max(0).optional(),
});

/**
 * Free, no-signup text check. Rule engine only (no AI, no credits). Nothing is stored and the
 * text is never logged; the result exists only in this response.
 */
export async function quickCheckAction(_prev: QuickCheckState, form: FormData): Promise<QuickCheckState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Formu kontrol et." };
  const ip = clientIp(await headers());
  const limit = rateLimit(`quick:${await hashKey("quick", ip)}`, 10, 10 * 60_000);
  if (!limit.ok) return { status: "error", message: `Kısa sürede çok fazla kontrol yaptın. ${Math.ceil(limit.retryAfterSec / 60)} dakika sonra tekrar dene ya da ücretsiz hesap aç.` };

  const d = parsed.data;
  try {
    const rules = await getRepo().listAllRules();
    const byVersion = new Map(rules.map((r) => [r.versionId, r]));
    const { result } = await runPipeline({
      input: {
        sector: d.sector,
        platform: d.platform,
        headline: d.headline,
        primaryText: d.primaryText,
        description: "",
        flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
      },
      rules: rules.filter((r) => r.sector === "genel" || r.sector === d.sector),
      ai: null,
    });
    // Rule-based findings only; image and creative heuristics need the full analysis.
    const ruled = result.findings.filter((f) => f.rule_version_id);
    const shown = ruled.slice(0, 6).map((f): QuickFinding => {
      const r = f.rule_version_id ? byVersion.get(f.rule_version_id) : undefined;
      return {
        severity: f.severity,
        title: f.title,
        matchedText: f.matched_text,
        explanation: f.explanation,
        suggestion: f.suggestion,
        verified: r?.status === "active",
        source: r ? { org: r.sourceOrg, title: r.sourceTitle, url: r.sourceUrl, ruleId: r.id } : null,
      };
    });
    return {
      status: "done",
      platform: d.platform,
      platformScore: result.meta_risk_score,
      platformLevel: result.meta_risk_level,
      legalLevel: result.legal_risk_level,
      legalCount: result.legal_finding_count,
      findings: shown,
      hiddenCount: Math.max(0, ruled.length - shown.length),
      safeText: result.safe_text,
    };
  } catch {
    console.error("[quick-check] failed");
    return { status: "error", message: "Kontrol şu an yapılamadı. Lütfen biraz sonra tekrar dene." };
  }
}
