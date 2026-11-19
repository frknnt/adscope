import "server-only";
import { zipSync } from "fflate";
import { productFromPage, type CopyAudience, type CopyContext } from "@/lib/copy/generate";
import { composeCopy } from "@/lib/copy/service";
import { LAYOUTS, type LayoutId } from "@/lib/creative/layouts";
import { creativeContext, renderCreative, warningsFor } from "@/lib/creative/service";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, type CreativeSizeId } from "@/lib/creative/sizes";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { buildCampaignPdf } from "@/lib/export/campaign-pdf";
import { toCsv } from "@/lib/export/csv";
import { fetchLanding } from "@/lib/landing/fetch";
import { PLATFORM_SHORT, ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { SECTOR_LABEL } from "@/lib/sectors";
import { CAMPAIGN_PACKAGE_CREDIT_COST, CAMPAIGN_PICK } from "./costs";
import { campaignCsvRows, checkVariant, variantsFromCopy, type CampaignVariant, type VariantCheck, type VariantText } from "./variants";

export type CampaignProduct = CopyContext["product"];

/** Step 1: the product page, read once with the SSRF-protected fetcher. Page text is untrusted data. */
export async function readCampaignProduct(p: { url: string | null; productName: string; description: string }): Promise<{ ok: true; product: CampaignProduct; fromPage: boolean } | { ok: false; error: string }> {
  let product: CampaignProduct = { name: p.productName.trim(), summary: p.description.trim(), points: [] };
  let fromPage = false;
  if (p.url) {
    const page = await fetchLanding(p.url);
    if (page.status === "ok") {
      const f = productFromPage(page, p.productName);
      product = { name: p.productName.trim() || f.name, summary: p.description.trim() || f.summary, points: f.points };
      fromPage = true;
    } else if (!p.description.trim()) {
      return { ok: false, error: "Sayfa okunamadı. Adresi kontrol et ya da ürünü kısaca kendin anlat." };
    }
  }
  if (!product.name && !product.summary) return { ok: false, error: "Bir ürün adresi ya da kısa bir açıklama yaz." };
  return { ok: true, product, fromPage };
}

async function rulesFor(repo: DataRepo, sector: Sector, platform: Platform) {
  return (await repo.getRules(sector)).filter((r) => ruleAppliesTo(r, platform));
}

/** Step 2: ten rule-checked ads. Nothing is stored or charged here; the package price covers it. */
export async function draftCampaign(
  repo: DataRepo,
  p: { product: CampaignProduct; brandId: string | null; platform: Platform; sector: Sector; audience: CopyAudience | null },
): Promise<{ ok: true; variants: CampaignVariant[]; source: "ai" | "template"; aiFailed: boolean; sector: Sector } | { ok: false; error: string }> {
  const composed = await composeCopy(repo, { product: p.product, pageText: "", brandId: p.brandId, platform: p.platform, sector: p.sector, audience: p.audience });
  if (!composed) return { ok: false, error: "Marka bulunamadı." };
  const variants = variantsFromCopy(composed.copy, composed.sector, await rulesFor(repo, composed.sector, p.platform));
  if (variants.length < CAMPAIGN_PICK) return { ok: false, error: "Yeterli metin çıkmadı. Ürünü biraz daha ayrıntılı anlatıp yeniden dene." };
  return { ok: true, variants, source: composed.copy.source, aiFailed: composed.aiFailed, sector: composed.sector };
}

export interface PreviewCheck {
  check: VariantCheck;
  /** Overflow, safe-area and contrast warnings per size for the chosen layout. */
  warnings: Record<CreativeSizeId, string[]>;
}

/** Step 3: rule check and layout warnings of the picked ads (the images come from the free preview route). */
export async function previewCampaign(repo: DataRepo, p: { brandId: string | null; platform: Platform; sector: Sector; layout: LayoutId; variants: VariantText[] }): Promise<PreviewCheck[] | null> {
  const out: PreviewCheck[] = [];
  for (const v of p.variants) {
    const ctx = await creativeContext(repo, { brandId: p.brandId, platform: p.platform, sector: p.sector, headline: v.headline, body: v.primaryText, cta: v.cta });
    if (!ctx) return null;
    const rules = await rulesFor(repo, ctx.sector, p.platform);
    const warnings = Object.fromEntries(CREATIVE_SIZE_IDS.map((s) => [s, warningsFor(ctx, p.layout, s).map((w) => w.message)])) as Record<CreativeSizeId, string[]>;
    out.push({ check: checkVariant(v, ctx.sector, rules), warnings });
  }
  return out;
}

export const PACKAGE_MAX_BYTES = 24 * 1024 * 1024;
export const packageImageName = (n: number, size: CreativeSizeId) => `gorseller/metin-${n}-${CREATIVE_SIZES[size].w}x${CREATIVE_SIZES[size].h}.png`;

export interface CampaignExportInput {
  requestId: string;
  brandId: string | null;
  platform: Platform;
  sector: Sector;
  layout: LayoutId;
  productName: string;
  variants: VariantText[];
  /** Indexes into `variants`: the ads that become creatives. */
  picked: number[];
}

export type CampaignExportResult = { ok: true; generation: GenerationRecord; charged: number } | { ok: false; error: string };

/**
 * Step 6: renders every size of the picked ads, writes the CSV and the PDF report, zips them into
 * the caller's private folder and only then records the package and charges once (record_generation).
 * The texts come from the browser, so every one is checked again here. A repeated request id returns
 * the earlier package for free; any failure before the record leaves the balance untouched.
 */
export async function exportCampaignPackage(repo: DataRepo, p: CampaignExportInput): Promise<CampaignExportResult> {
  const existing = await repo.getGenerationByRequest(p.requestId);
  if (existing) return existing.kind === "campaign" ? { ok: true, generation: existing, charged: 0 } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };
  const picked = [...new Set(p.picked)].filter((i) => i >= 0 && i < p.variants.length);
  if (picked.length !== CAMPAIGN_PICK) return { ok: false, error: `Görsele dönüştürmek için ${CAMPAIGN_PICK} metin seç.` };
  if ((await repo.getBalance()) < CAMPAIGN_PACKAGE_CREDIT_COST) return { ok: false, error: `Paketi indirmek için ${CAMPAIGN_PACKAGE_CREDIT_COST} kredi gerekiyor. Krediler sayfasından kredi alabilirsin; önizlemeler ücretsiz.` };

  const files: Record<string, Uint8Array> = {};
  let sector = p.sector;
  let brandName: string | null = null;
  const notes = new Set<string>();
  for (const [k, i] of picked.entries()) {
    const v = p.variants[i];
    const ctx = await creativeContext(repo, { brandId: p.brandId, platform: p.platform, sector: p.sector, headline: v.headline, body: v.primaryText, cta: v.cta });
    if (!ctx) return { ok: false, error: "Marka bulunamadı." };
    if (!ctx.text.headline) return { ok: false, error: `${i + 1}. metnin başlığı boş; başka bir metin seç.` };
    sector = ctx.sector;
    brandName = ctx.kit.brandName;
    ctx.notes.forEach((n) => notes.add(n));
    for (const size of CREATIVE_SIZE_IDS) files[packageImageName(k + 1, size)] = await renderCreative(ctx, p.layout, size);
  }

  const rules = await rulesFor(repo, sector, p.platform);
  const checked = p.variants.map((v, i) => ({ n: i + 1, ...v, ...checkVariant(v, sector, rules), picked: picked.includes(i) }));
  const createdAt = new Date().toISOString();
  files["varyantlar.csv"] = new TextEncoder().encode(toCsv(campaignCsvRows(checked, PLATFORM_SHORT[p.platform])));
  files["kontrol-raporu.pdf"] = new Uint8Array(
    await buildCampaignPdf({
      productName: p.productName,
      brandName,
      platformLabel: PLATFORM_SHORT[p.platform],
      sectorLabel: SECTOR_LABEL[sector],
      layoutLabel: LAYOUTS.find((l) => l.id === p.layout)?.label ?? p.layout,
      createdAt,
      variants: checked,
      notes: [...notes, `Görseller: ${picked.map((i) => `${i + 1}. metin`).join(", ")} (gorseller klasöründe metin-1, metin-2, metin-3 olarak, 4 boyutta).`],
    }),
  );
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, [bytes, { level: name.endsWith(".png") ? 0 : 6 }]])));
  if (zip.byteLength > PACKAGE_MAX_BYTES) return { ok: false, error: "Paket çok büyük oldu. Daha kısa metinlerle yeniden dene; kredin düşmedi." };
  const name = "adscope-kampanya-paketi.zip";
  const path = await repo.saveGenerationFile(name, zip, "application/zip");
  if (!path) return { ok: false, error: "Paket kaydedilemedi. Biraz sonra yeniden dene; kredin düşmedi." };
  const res = await repo.recordGeneration({
    clientRequestId: p.requestId,
    kind: "campaign",
    creditCost: CAMPAIGN_PACKAGE_CREDIT_COST,
    brandId: p.brandId,
    platform: p.platform,
    output: {
      productName: p.productName,
      layout: p.layout,
      picked: picked.map((i) => i + 1),
      variants: checked.map((v) => ({ n: v.n, headline: v.headline, primaryText: v.primaryText, cta: v.cta, risk: v.risk, metaScore: v.metaScore, issues: v.issues, picked: v.picked })),
      files: [{ path, name, mime: "application/zip" }],
    },
  });
  if (res.status === "created" || res.status === "exists") {
    if (res.status === "exists") await repo.removeGenerationFiles([path]);
    return { ok: true, generation: res.generation, charged: res.status === "created" ? CAMPAIGN_PACKAGE_CREDIT_COST : 0 };
  }
  await repo.removeGenerationFiles([path]);
  return { ok: false, error: res.status === "insufficient_credits" ? `Paketi indirmek için ${CAMPAIGN_PACKAGE_CREDIT_COST} kredi gerekiyor.` : res.status === "brand_not_found" ? "Marka bulunamadı." : "Paket kaydedilemedi. Kredin düşmedi; yeniden dene." };
}
