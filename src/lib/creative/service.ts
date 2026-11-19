import "server-only";
import { zipSync } from "fflate";
import { BRAND_FONT_IDS, normalizeHex, type BrandFontId } from "@/lib/brand/kit";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { legalRisk, metaRisk } from "@/lib/engine/scoring";
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { loadCreativeFont, type LoadedFont } from "./fonts";
import { buildPlan, DEFAULT_PRIMARY, DEFAULT_SECONDARY, planWarnings, type LayoutId, type Plan, type PlanWarning } from "./layouts";
import { renderPlanPng } from "./render";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, type CreativeSizeId } from "./sizes";
import { cleanForFont } from "./text-fit";

import { CREATIVE_CREDIT_COST } from "./costs";

export { CREATIVE_CREDIT_COST };
export const CREATIVE_LIMITS = { headline: 90, body: 220, cta: 30 } as const;

export interface CreativeRequest {
  brandId: string | null;
  platform: Platform;
  sector: Sector;
  headline: string;
  body: string;
  cta: string;
}

export interface CreativeContext {
  font: LoadedFont;
  sector: Sector;
  platform: Platform;
  brandId: string | null;
  text: { headline: string; body: string; cta: string };
  kit: { brandName: string | null; tagline: string | null; note: string; primary: string; secondary: string };
  logoDataUrl: string | null;
  /** Problems that apply to every layout (dropped characters, unusable logo). */
  notes: string[];
}

const clip = (s: string, max: number) => [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("");

export async function creativeContext(repo: DataRepo, req: CreativeRequest): Promise<CreativeContext | null> {
  const brand = req.brandId ? ((await repo.listBrands()).find((b) => b.id === req.brandId) ?? null) : null;
  if (req.brandId && !brand) return null;
  const fontId: BrandFontId = brand?.font && BRAND_FONT_IDS.includes(brand.font) ? brand.font : "manrope";
  const font = await loadCreativeFont(fontId);
  const ms = [font.regular.m, font.bold.m];
  const notes: string[] = [];
  let dropped = false;
  const clean = (s: string, max: number) => {
    const r = cleanForFont(clip(s, max), ms);
    dropped ||= r.dropped;
    return r.text;
  };
  const text = { headline: clean(req.headline, CREATIVE_LIMITS.headline), body: clean(req.body, CREATIVE_LIMITS.body), cta: clean(req.cta, CREATIVE_LIMITS.cta) };
  const kit = {
    brandName: brand ? clean(brand.name, 60) || null : null,
    tagline: brand?.tagline ? clean(brand.tagline, 80) || null : null,
    note: brand ? clean(brand.requiredPhrases.join(" "), 320) : "",
    primary: normalizeHex(brand?.primaryColor) ?? DEFAULT_PRIMARY,
    secondary: normalizeHex(brand?.secondaryColor) ?? DEFAULT_SECONDARY,
  };
  if (dropped) notes.push("Yazı tipinin çizemediği bazı karakterler (ör. emoji) görselden çıkarıldı.");
  let logoDataUrl: string | null = null;
  if (brand?.hasLogo) {
    const logo = await repo.getBrandLogo(brand.id);
    if (logo && (logo.mime === "image/png" || logo.mime === "image/jpeg")) logoDataUrl = `data:${logo.mime};base64,${Buffer.from(logo.bytes).toString("base64")}`;
    else if (logo) notes.push("Logo WebP biçiminde olduğu için görsele eklenmedi; PNG ya da JPEG logo yükleyebilirsin.");
  }
  return { font, sector: brand?.sector ?? req.sector, platform: req.platform, brandId: brand?.id ?? null, text, kit, logoDataUrl, notes };
}

export function planFor(ctx: CreativeContext, layout: LayoutId, size: CreativeSizeId): Plan {
  return buildPlan(layout, size, {
    ...ctx.text,
    ...ctx.kit,
    hasLogo: Boolean(ctx.logoDataUrl),
    regular: ctx.font.regular.m,
    bold: ctx.font.bold.m,
  });
}

export function warningsFor(ctx: CreativeContext, layout: LayoutId, size: CreativeSizeId): PlanWarning[] {
  return planWarnings(planFor(ctx, layout, size), size);
}

export interface CreativeScore {
  metaScore: number;
  metaLevel: "low" | "medium" | "high";
  legalLevel: "low" | "medium" | "high";
  issues: string[];
}

/** Rule check of the words on the image (the same engine as the analysis; wording findings only). */
export async function scoreCreative(repo: DataRepo, ctx: CreativeContext): Promise<CreativeScore> {
  const rules = (await repo.getRules(ctx.sector)).filter((r) => ruleAppliesTo(r, ctx.platform));
  const findings = runRuleEngine(
    { headline: ctx.text.headline, primaryText: [ctx.text.body, ctx.text.cta].filter(Boolean).join(" "), description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
    rules,
  ).filter((f) => f.matchedText && f.severity !== "info");
  const meta = metaRisk(ctx.sector, findings);
  return { metaScore: meta.score, metaLevel: meta.level, legalLevel: legalRisk(findings).level, issues: [...new Set(findings.map((f) => f.title))] };
}

export function renderCreative(ctx: CreativeContext, layout: LayoutId, size: CreativeSizeId, scale = 1) {
  return renderPlanPng(planFor(ctx, layout, size), ctx.font, { scale, logoDataUrl: ctx.logoDataUrl });
}

export type CreativeExportResult = { ok: true; generation: GenerationRecord; charged: number } | { ok: false; error: string };

/**
 * Renders full-size files, stores them in the caller's private folder, then records the generation
 * and charges one credit in a single step. A repeated request id returns the earlier result for free.
 */
export async function exportCreative(repo: DataRepo, p: { requestId: string; layout: LayoutId; size: CreativeSizeId | "hepsi"; req: CreativeRequest }): Promise<CreativeExportResult> {
  const existing = await repo.getGenerationByRequest(p.requestId);
  if (existing) return existing.kind === "creative" ? { ok: true, generation: existing, charged: 0 } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };
  if ((await repo.getBalance()) < CREATIVE_CREDIT_COST) return { ok: false, error: "Bu indirme için 1 kredi gerekiyor. Krediler sayfasından kredi alabilirsin." };
  const ctx = await creativeContext(repo, p.req);
  if (!ctx) return { ok: false, error: "Marka bulunamadı." };
  const sizes = p.size === "hepsi" ? CREATIVE_SIZE_IDS : [p.size];
  const pngs: { name: string; bytes: Uint8Array }[] = [];
  for (const size of sizes) {
    const { w, h } = CREATIVE_SIZES[size];
    pngs.push({ name: `adscope-${p.layout}-${w}x${h}.png`, bytes: await renderCreative(ctx, p.layout, size) });
  }
  const file =
    p.size === "hepsi"
      ? { name: `adscope-${p.layout}-tum-boyutlar.zip`, mime: "application/zip", bytes: zipSync(Object.fromEntries(pngs.map((f) => [f.name, [f.bytes, { level: 0 }]]))) }
      : { name: pngs[0].name, mime: "image/png", bytes: pngs[0].bytes };
  const path = await repo.saveGenerationFile(file.name, file.bytes, file.mime);
  if (!path) return { ok: false, error: "Dosya kaydedilemedi. Biraz sonra yeniden dene." };
  const res = await repo.recordGeneration({
    clientRequestId: p.requestId,
    kind: "creative",
    creditCost: CREATIVE_CREDIT_COST,
    brandId: ctx.brandId,
    platform: ctx.platform,
    output: { layout: p.layout, size: p.size, text: ctx.text, files: [{ path, name: file.name, mime: file.mime }] },
  });
  if (res.status === "created" || res.status === "exists") {
    if (res.status === "exists") await repo.removeGenerationFiles([path]);
    return { ok: true, generation: res.generation, charged: res.status === "created" ? CREATIVE_CREDIT_COST : 0 };
  }
  await repo.removeGenerationFiles([path]);
  return { ok: false, error: res.status === "insufficient_credits" ? "Bu indirme için 1 kredi gerekiyor." : "Marka bulunamadı." };
}
