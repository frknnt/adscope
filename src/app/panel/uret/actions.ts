"use server";

import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { runCopyGeneration } from "@/lib/copy/service";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";
import { audienceForGeneration } from "@/lib/audience/service";

export type CopyActionState = { error: string | null; id?: string };

const schema = z.object({
  requestId: z.uuid(),
  url: z.string().trim().max(2048).default(""),
  productName: z.string().trim().max(80, "Ürün adı en fazla 80 karakter olabilir.").default(""),
  description: z.string().trim().max(600, "Açıklama en fazla 600 karakter olabilir.").default(""),
  brandId: z.union([z.uuid(), z.literal("")]).default(""),
  audienceId: z.union([z.uuid(), z.literal("")]).default(""),
  platform: z.enum(PLATFORM_IDS),
  sector: z.enum(SECTOR_IDS),
});

export async function generateCopyAction(_prev: CopyActionState, form: FormData): Promise<CopyActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol et." };
  const d = parsed.data;
  if (!d.url && !d.description && !d.productName) return { error: "Bir ürün adresi ya da kısa bir açıklama yaz." };
  if (d.url && !/^https?:\/\//i.test(d.url)) return { error: "Adres https:// ile başlamalı." };
  const limit = rateLimit(`copy:${await hashKey("copy", user.id)}`, 20, 60 * 60_000);
  if (!limit.ok) return { error: "Bir saatte en fazla 20 üretim yapılabilir. Biraz sonra tekrar dene." };
  const repo = getRepo();
  try {
    const audience = d.audienceId ? await audienceForGeneration(repo, d.audienceId, d.brandId || null) : null;
    if (d.audienceId && !audience) return { error: "Seçilen hedef kitle bu markaya ait değil." };
    const res = await runCopyGeneration(repo, {
      requestId: d.requestId,
      url: d.url || null,
      productName: d.productName,
      description: d.description,
      brandId: d.brandId || null,
      platform: d.platform,
      sector: d.sector,
      audience,
    });
    if (!res.ok) return { error: res.error };
    return { error: null, id: res.generation.id };
  } catch {
    console.error("[copy] generation_failed");
    return { error: "Üretim tamamlanamadı. Kredi düşülmedi; lütfen tekrar dene." };
  }
}
