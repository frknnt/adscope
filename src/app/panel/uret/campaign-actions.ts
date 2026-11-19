"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audienceForGeneration } from "@/lib/audience/service";
import { draftCampaign, exportCampaignPackage, previewCampaign, readCampaignProduct, type CampaignProduct, type PreviewCheck } from "@/lib/campaign/service";
import { CAMPAIGN_PICK, CAMPAIGN_VARIANT_COUNT } from "@/lib/campaign/costs";
import type { CampaignVariant } from "@/lib/campaign/variants";
import { LAYOUT_IDS } from "@/lib/creative/layouts";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

const SIGNED_OUT = "Oturumun kapanmış. Lütfen yeniden giriş yap.";
const UUID = z.union([z.uuid(), z.literal("")]).default("");

async function limited(user: { id: string }, key: string, max: number) {
  return !rateLimit(`campaign-${key}:${await hashKey("campaign", user.id)}`, max, 60 * 60_000).ok;
}

const readSchema = z.object({
  url: z.string().trim().max(2048).default(""),
  productName: z.string().trim().max(80, "Ürün adı en fazla 80 karakter olabilir.").default(""),
  description: z.string().trim().max(600, "Açıklama en fazla 600 karakter olabilir.").default(""),
});

export type ReadResult = { ok: true; product: CampaignProduct; fromPage: boolean } | { ok: false; error: string };

/** Step 1 of the campaign package: read the product page (or take the user's description). */
export async function campaignReadAction(raw: unknown): Promise<ReadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = readSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol et." };
  const d = parsed.data;
  if (!d.url && !d.description && !d.productName) return { ok: false, error: "Ürün sayfasının adresini ya da kısa bir açıklama yaz." };
  if (d.url && !/^https?:\/\//i.test(d.url)) return { ok: false, error: "Adres https:// ile başlamalı." };
  if (await limited(user, "read", 30)) return { ok: false, error: "Bir saatte en fazla 30 sayfa okunabilir. Biraz sonra tekrar dene." };
  try {
    return await readCampaignProduct({ url: d.url || null, productName: d.productName, description: d.description });
  } catch {
    console.error("[campaign] read_failed");
    return { ok: false, error: "Sayfa okunamadı. Ürünü kısaca kendin anlatabilirsin." };
  }
}

const draftSchema = z.object({
  product: z.object({ name: z.string().trim().max(80), summary: z.string().trim().max(600), points: z.array(z.string().trim().max(120)).max(4) }),
  brandId: UUID,
  audienceId: UUID,
  platform: z.enum(PLATFORM_IDS),
  sector: z.enum(SECTOR_IDS),
});

export type DraftResult = { ok: true; variants: CampaignVariant[]; source: "ai" | "template"; aiFailed: boolean; sector: (typeof SECTOR_IDS)[number] } | { ok: false; error: string };

/** Step 2: ten ads with a risk badge each. Free; the package price covers the text. */
export async function campaignDraftAction(raw: unknown): Promise<DraftResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Ürün bilgileri okunamadı. Sayfayı yenileyip yeniden dene." };
  const d = parsed.data;
  if (!d.product.name && !d.product.summary) return { ok: false, error: "Ürün adı ya da kısa açıklama gerekli." };
  // The text step can call the model before anything is charged, so it has its own tighter limit.
  if (await limited(user, "draft", 12)) return { ok: false, error: "Bir saatte en fazla 12 paket taslağı hazırlanabilir. Biraz sonra tekrar dene." };
  const repo = getRepo();
  try {
    const audience = d.audienceId ? await audienceForGeneration(repo, d.audienceId, d.brandId || null) : null;
    if (d.audienceId && !audience) return { ok: false, error: "Seçilen hedef kitle bu markaya ait değil." };
    return await draftCampaign(repo, { product: d.product, brandId: d.brandId || null, platform: d.platform, sector: d.sector, audience });
  } catch {
    console.error("[campaign] draft_failed");
    return { ok: false, error: "Metinler hazırlanamadı. Lütfen tekrar dene." };
  }
}

const textSchema = z.object({ headline: z.string().trim().max(200), primaryText: z.string().trim().max(1200), cta: z.string().trim().max(60) });

const previewSchema = z.object({
  brandId: UUID,
  platform: z.enum(PLATFORM_IDS),
  sector: z.enum(SECTOR_IDS),
  layout: z.enum(LAYOUT_IDS),
  variants: z.array(textSchema).length(CAMPAIGN_PICK),
});

/** Step 3: rule badge and layout warnings of the three picked ads. */
export async function campaignPreviewAction(raw: unknown): Promise<{ ok: true; items: PreviewCheck[] } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = previewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `Görsel için ${CAMPAIGN_PICK} metin seç.` };
  if (await limited(user, "preview", 120)) return { ok: false, error: "Çok sık önizleme istedin. Biraz sonra tekrar dene." };
  const d = parsed.data;
  try {
    const items = await previewCampaign(getRepo(), { brandId: d.brandId || null, platform: d.platform, sector: d.sector, layout: d.layout, variants: d.variants });
    return items ? { ok: true, items } : { ok: false, error: "Marka bulunamadı." };
  } catch {
    console.error("[campaign] preview_failed");
    return { ok: false, error: "Önizleme hazırlanamadı. Lütfen tekrar dene." };
  }
}

const exportSchema = z.object({
  requestId: z.uuid(),
  brandId: UUID,
  platform: z.enum(PLATFORM_IDS),
  sector: z.enum(SECTOR_IDS),
  layout: z.enum(LAYOUT_IDS),
  productName: z.string().trim().max(80),
  variants: z.array(textSchema).min(CAMPAIGN_PICK).max(CAMPAIGN_VARIANT_COUNT),
  picked: z.array(z.number().int().min(0).max(CAMPAIGN_VARIANT_COUNT - 1)).length(CAMPAIGN_PICK),
});

export type ExportResult = { ok: true; href: string; charged: number; id: string } | { ok: false; error: string };

/** Step 6: the paid ZIP. Charged once, only after the file is written; the same request id is free. */
export async function campaignExportAction(raw: unknown): Promise<ExportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paket bilgileri okunamadı. Sayfayı yenileyip yeniden dene." };
  if (await limited(user, "export", 30)) return { ok: false, error: "Bir saatte en fazla 30 paket indirilebilir. Biraz sonra tekrar dene." };
  const d = parsed.data;
  try {
    const res = await exportCampaignPackage(getRepo(), { ...d, brandId: d.brandId || null });
    if (!res.ok) return res;
    if (res.charged) revalidatePath("/panel", "layout");
    return { ok: true, href: `/api/generations/${res.generation.id}/files/0`, charged: res.charged, id: res.generation.id };
  } catch {
    console.error("[campaign] export_failed");
    return { ok: false, error: "Paket hazırlanamadı. Kredin düşmedi; biraz sonra yeniden dene." };
  }
}
