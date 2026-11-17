import "server-only";
import { getAiProvider } from "@/lib/analysis/service";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { fetchLanding } from "@/lib/landing/fetch";
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { productFromPage, processAiCopy, templateCopy, type CopyAudience, type CopyContext, type CopyOutput } from "./generate";
import { COPY_LIMITS } from "./limits";

/** AI copy costs one credit; template suggestions (AI off or failed) are free. */
export const COPY_CREDIT_COST = 1;

export interface CopyRequest {
  requestId: string;
  url: string | null;
  productName: string;
  description: string;
  brandId: string | null;
  platform: Platform;
  sector: Sector;
  audience: CopyAudience | null;
}

export interface CopyStored {
  input: { url: string | null; productName: string; audience: string | null };
  copy: CopyOutput;
  aiFailed?: boolean;
}

export type CopyResult = { ok: true; generation: GenerationRecord; stored: CopyStored; charged: number } | { ok: false; error: string };

export async function runCopyGeneration(repo: DataRepo, req: CopyRequest): Promise<CopyResult> {
  const existing = await repo.getGenerationByRequest(req.requestId);
  if (existing) return { ok: true, generation: existing, stored: existing.output as unknown as CopyStored, charged: 0 };

  const ai = getAiProvider();
  const aiOn = Boolean(ai?.generateCopy);
  if (aiOn && (await repo.getBalance()) < COPY_CREDIT_COST) return { ok: false, error: "Kredin yetersiz. Yapay zekâ ile üretim 1 kredi; Krediler sayfasından paket alabilirsin." };

  const brand = req.brandId ? ((await repo.listBrands()).find((b) => b.id === req.brandId) ?? null) : null;
  if (req.brandId && !brand) return { ok: false, error: "Marka bulunamadı." };
  const sector = brand?.sector ?? req.sector;

  let product: CopyContext["product"] = { name: req.productName.trim(), summary: req.description.trim(), points: [] };
  let pageText = "";
  if (req.url) {
    const page = await fetchLanding(req.url);
    if (page.status === "ok") {
      const fromPage = productFromPage(page, req.productName);
      product = { name: req.productName.trim() || fromPage.name, summary: req.description.trim() || fromPage.summary, points: fromPage.points };
      pageText = page.text;
    } else if (!req.description.trim()) {
      return { ok: false, error: "Sayfa okunamadı. Adresi kontrol et ya da ürünü kısaca kendin anlat." };
    }
  }
  if (!product.name && !product.summary) return { ok: false, error: "Bir ürün adresi ya da kısa bir açıklama yaz." };

  const ctx: CopyContext = {
    sector,
    platform: req.platform,
    product,
    brand: brand
      ? { name: brand.name, tone: brand.tone, bannedWords: brand.bannedWords, requiredPhrases: brand.requiredPhrases, preferredCta: brand.preferredCta, tagline: brand.tagline, audienceNote: brand.audienceNote }
      : null,
    audience: req.audience,
  };
  const rules = (await repo.getRules(sector)).filter((r) => ruleAppliesTo(r, req.platform));

  let copy: CopyOutput | null = null;
  let aiFailed = false;
  if (ai?.generateCopy) {
    const res = await ai.generateCopy({
      platform: req.platform,
      sector,
      limits: COPY_LIMITS[req.platform],
      product: { ...product, pageText },
      brand: ctx.brand ? { ...ctx.brand } : null,
      audience: req.audience,
      avoid: rules.filter((r) => r.status === "active").flatMap((r) => r.riskyExamples),
    });
    if (res.ok) copy = processAiCopy(res.data, ctx, rules);
    else aiFailed = true;
    // A model answer with nothing usable left after the checks falls back to templates, free of charge.
    if (copy && (!copy.headlines.length || !copy.primaryTexts.length)) {
      copy = null;
      aiFailed = true;
    }
  }
  if (!copy) copy = templateCopy(ctx, rules);

  const cost = copy.source === "ai" ? COPY_CREDIT_COST : 0;
  const stored: CopyStored = { input: { url: req.url, productName: product.name, audience: req.audience?.name ?? null }, copy, ...(aiFailed ? { aiFailed } : {}) };
  const rec = await repo.recordGeneration({
    clientRequestId: req.requestId,
    kind: "copy",
    creditCost: cost,
    brandId: brand?.id ?? null,
    platform: req.platform,
    output: stored as unknown as Record<string, unknown>,
  });
  if (rec.status === "insufficient_credits") return { ok: false, error: "Kredin yetersiz. Üretim kaydedilmedi ve kredi düşülmedi." };
  if (rec.status !== "created" && rec.status !== "exists") return { ok: false, error: "Üretim kaydedilemedi. Kredi düşülmedi; lütfen tekrar dene." };
  return { ok: true, generation: rec.generation, stored: rec.generation.output as unknown as CopyStored, charged: rec.status === "created" ? cost : 0 };
}
