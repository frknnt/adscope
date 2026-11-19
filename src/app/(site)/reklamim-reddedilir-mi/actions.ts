"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { runPipeline } from "@/lib/engine/pipeline";
import type { Level } from "@/lib/engine/types";
import { PLATFORM_IDS, type Platform } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { clientIp, hashKey } from "@/lib/security/rate-limit";
import { limit } from "@/lib/security/limiter";
import { checkVariantLines } from "@/lib/variants/check";
import { PASTE_MAX, parseVariantLines, pasteProblem, VARIANT_MAX_CHARS, type VariantRow } from "@/lib/variants/paste";

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
  const lim = await limit(`quick:${await hashKey("quick", ip)}`, 10, 10 * 60_000);
  if (!lim.ok) return { status: "error", message: `Kısa sürede çok fazla kontrol yaptın. ${Math.ceil(lim.retryAfterSec / 60)} dakika sonra tekrar dene ya da ücretsiz hesap aç.` };

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

export type QuickVariantState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; platform: Platform; rows: VariantRow[] };

const variantSchema = z.object({
  platform: z.enum(PLATFORM_IDS).default("meta"),
  sector: z.enum(SECTOR_IDS).default("genel"),
  texts: z.string().max(PASTE_MAX.public * (VARIANT_MAX_CHARS + 20), "Metin çok uzun."),
  website: z.string().max(0).optional(),
});

/**
 * No-signup version of the platform-variant check (P9.3): up to 5 lines, rule engine only, nothing
 * stored or logged. Shares the free check's rate limit, one run counts as one check.
 */
export async function quickVariantAction(_prev: QuickVariantState, form: FormData): Promise<QuickVariantState> {
  const parsed = variantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Formu kontrol et." };
  const d = parsed.data;
  const lines = parseVariantLines(d.texts);
  const problem = pasteProblem(lines, PASTE_MAX.public);
  if (problem) return { status: "error", message: lines.length > PASTE_MAX.public ? `${problem} Daha fazlası için ücretsiz hesap aç: panelde 20 varyanta kadar kontrol edebilirsin.` : problem };
  const ip = clientIp(await headers());
  const lim = await limit(`quick:${await hashKey("quick", ip)}`, 10, 10 * 60_000);
  if (!lim.ok) return { status: "error", message: `Kısa sürede çok fazla kontrol yaptın. ${Math.ceil(lim.retryAfterSec / 60)} dakika sonra tekrar dene ya da ücretsiz hesap aç.` };
  try {
    const rows = await checkVariantLines({ rules: await getRepo().listAllRules(), platform: d.platform, sector: d.sector }, lines);
    return { status: "done", platform: d.platform, rows };
  } catch {
    console.error("[quick-variant] failed");
    return { status: "error", message: "Kontrol şu an yapılamadı. Lütfen biraz sonra tekrar dene." };
  }
}
