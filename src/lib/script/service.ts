import "server-only";
import { getAiProvider } from "@/lib/analysis/service";
import type { CopyAudience } from "@/lib/copy/generate";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { processAiScript, templateScript, type ScriptContext, type ScriptOutput } from "./generate";
import type { ScriptDuration } from "./schema";

/** AI scripts cost one credit; template scripts (AI off or failed) are free. */
export const SCRIPT_CREDIT_COST = 1;

export interface ScriptRequest {
  requestId: string;
  productName: string;
  description: string;
  brandId: string | null;
  platform: Platform;
  sector: Sector;
  duration: ScriptDuration;
  audience: CopyAudience | null;
  aiPersonOrVoice: boolean;
}

export interface ScriptStored {
  input: { productName: string; audience: string | null; aiPersonOrVoice: boolean; sector?: Sector };
  script: ScriptOutput;
  aiFailed?: boolean;
}

export type ScriptResult = { ok: true; generation: GenerationRecord; stored: ScriptStored; charged: number } | { ok: false; error: string };

export async function runScriptGeneration(repo: DataRepo, req: ScriptRequest): Promise<ScriptResult> {
  const existing = await repo.getGenerationByRequest(req.requestId);
  if (existing) return existing.kind === "script" ? { ok: true, generation: existing, stored: existing.output as unknown as ScriptStored, charged: 0 } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };
  const ai = getAiProvider();
  if (ai?.generateScript && (await repo.getBalance()) < SCRIPT_CREDIT_COST) return { ok: false, error: "Kredin yetersiz. Yapay zekâ ile senaryo 1 kredi; Krediler sayfasından paket alabilirsin." };
  const brand = req.brandId ? ((await repo.listBrands()).find((b) => b.id === req.brandId) ?? null) : null;
  if (req.brandId && !brand) return { ok: false, error: "Marka bulunamadı." };
  if (!req.productName.trim() && !req.description.trim()) return { ok: false, error: "Ürünü ya da hizmeti kısaca anlat." };
  const sector = brand?.sector ?? req.sector;
  const ctx: ScriptContext = {
    sector,
    platform: req.platform,
    duration: req.duration,
    product: { name: req.productName.trim(), summary: req.description.trim() },
    brand: brand ? { name: brand.name, bannedWords: brand.bannedWords, preferredCta: brand.preferredCta, tagline: brand.tagline } : null,
    audience: req.audience ? { name: req.audience.name, need: req.audience.need } : null,
    aiPersonOrVoice: req.aiPersonOrVoice,
  };
  const rules = (await repo.getRules(sector)).filter((r) => ruleAppliesTo(r, req.platform));

  let script: ScriptOutput | null = null;
  let aiFailed = false;
  if (ai?.generateScript) {
    const res = await ai.generateScript({
      platform: req.platform,
      sector,
      duration: req.duration,
      product: ctx.product,
      brand: ctx.brand,
      audience: ctx.audience,
      aiPersonOrVoice: req.aiPersonOrVoice,
      avoid: rules.filter((r) => r.status === "active").flatMap((r) => r.riskyExamples),
    });
    if (res.ok) script = processAiScript(res.data, ctx, rules);
    else aiFailed = true;
  }
  if (!script) script = templateScript(ctx, rules);

  const cost = script.source === "ai" ? SCRIPT_CREDIT_COST : 0;
  const stored: ScriptStored = { input: { productName: ctx.product.name, audience: req.audience?.name ?? null, aiPersonOrVoice: req.aiPersonOrVoice, sector }, script, ...(aiFailed ? { aiFailed } : {}) };
  const rec = await repo.recordGeneration({ clientRequestId: req.requestId, kind: "script", creditCost: cost, brandId: brand?.id ?? null, platform: req.platform, output: stored as unknown as Record<string, unknown> });
  if (rec.status === "insufficient_credits") return { ok: false, error: "Kredin yetersiz. Senaryo kaydedilmedi ve kredi düşülmedi." };
  if (rec.status !== "created" && rec.status !== "exists") return { ok: false, error: "Senaryo kaydedilemedi. Kredi düşülmedi; lütfen tekrar dene." };
  return { ok: true, generation: rec.generation, stored: rec.generation.output as unknown as ScriptStored, charged: rec.status === "created" ? cost : 0 };
}
