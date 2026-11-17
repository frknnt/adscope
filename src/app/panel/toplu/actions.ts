"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { runPipeline } from "@/lib/engine/pipeline";
import type { Level } from "@/lib/engine/types";
import { PLATFORM_IDS, ruleAppliesTo, type Platform } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

const BULK_MAX = 20;

export interface BulkRow {
  n: number;
  text: string;
  platformScore: number;
  platformLevel: Level;
  legalLevel: Level;
  red: number;
  yellow: number;
  info: number;
  top: { title: string; matched: string | null; ruleId: string | null }[];
  safeText: string;
}

export type BulkState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; platform: Platform; rows: BulkRow[] };

const schema = z.object({
  platform: z.enum(PLATFORM_IDS).default("meta"),
  sector: z.enum(SECTOR_IDS).default("genel"),
  brandId: z.string().max(64).optional(),
  texts: z.string().max(BULK_MAX * 2300, "Metin çok uzun."),
});

/** Splits on blank lines or lines that contain only --- . */
export async function splitAds(raw: string): Promise<string[]> {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*(?:-{3,}\s*)?\n|\n-{3,}\n/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 10);
}

/**
 * Bulk text check for catalogues and agency batches: rule engine only, no AI, no credits, nothing
 * stored. Up to 20 ads per run, 30 runs per hour per user.
 */
export async function bulkCheckAction(_prev: BulkState, form: FormData): Promise<BulkState> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Formu kontrol et." };
  const d = parsed.data;
  const ads = await splitAds(d.texts);
  if (!ads.length) return { status: "error", message: "En az bir reklam metni yaz (en az 10 karakter). Reklamları boş bir satırla ayır." };
  if (ads.length > BULK_MAX) return { status: "error", message: `Tek seferde en fazla ${BULK_MAX} reklam kontrol edilebilir; ${ads.length} reklam bulundu.` };
  if (ads.some((a) => a.length > 2200)) return { status: "error", message: "Her reklam en fazla 2200 karakter olabilir." };
  const limit = rateLimit(`bulk:${await hashKey("bulk", user.id)}`, 30, 60 * 60_000);
  if (!limit.ok) return { status: "error", message: "Bir saatte en fazla 30 toplu kontrol yapılabilir. Biraz sonra tekrar dene." };

  try {
    const repo = getRepo();
    const [rules, brands] = await Promise.all([repo.listAllRules(), repo.listBrands()]);
    const brand = brands.find((b) => b.id === d.brandId) ?? null;
    const sector = brand?.sector ?? d.sector;
    const usable = rules.filter((r) => (r.sector === "genel" || r.sector === sector) && ruleAppliesTo(r, d.platform));
    const byVersion = new Map(rules.map((r) => [r.versionId, r]));
    const rows: BulkRow[] = [];
    for (const [i, text] of ads.entries()) {
      const { result } = await runPipeline({
        input: {
          sector,
          platform: d.platform,
          headline: "",
          primaryText: text,
          description: "",
          brandVoice: brand ? { bannedWords: brand.bannedWords, preferredCta: brand.preferredCta, voiceNotes: brand.voiceNotes } : null,
          flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
        },
        rules: usable,
        ai: null,
      });
      const f = result.findings.filter((x) => x.domain !== "creative_quality" || x.severity !== "info");
      rows.push({
        n: i + 1,
        text,
        platformScore: result.meta_risk_score,
        platformLevel: result.meta_risk_level,
        legalLevel: result.legal_risk_level,
        red: f.filter((x) => x.severity === "red").length,
        yellow: f.filter((x) => x.severity === "yellow").length,
        info: f.filter((x) => x.severity === "info").length,
        top: f
          .filter((x) => x.severity !== "info")
          .slice(0, 3)
          .map((x) => ({ title: x.title, matched: x.matched_text, ruleId: x.rule_version_id ? (byVersion.get(x.rule_version_id)?.id ?? null) : null })),
        safeText: result.safe_text,
      });
    }
    return { status: "done", platform: d.platform, rows };
  } catch {
    console.error("[bulk-check] failed");
    return { status: "error", message: "Kontrol şu an yapılamadı. Lütfen biraz sonra tekrar dene." };
  }
}
