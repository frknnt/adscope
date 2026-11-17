"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { LAYOUT_IDS } from "@/lib/creative/layouts";
import { parseCreativeQuery } from "@/lib/creative/request";
import { exportCreative } from "@/lib/creative/service";
import { CREATIVE_SIZE_IDS } from "@/lib/creative/sizes";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

export type CreativeDownloadState = { error: string | null; href?: string; charged?: number };

const schema = z.object({
  requestId: z.uuid(),
  layout: z.enum(LAYOUT_IDS),
  size: z.enum([...CREATIVE_SIZE_IDS, "hepsi"] as const),
  query: z.string().max(4000),
});

export async function downloadCreativeAction(_prev: CreativeDownloadState, form: FormData): Promise<CreativeDownloadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "İstek okunamadı. Sayfayı yenileyip yeniden dene." };
  const d = parsed.data;
  const params = new URLSearchParams(d.query);
  const q = parseCreativeQuery((k) => params.get(k));
  if (!q.baslik) return { error: "Önce bir başlık yaz." };
  if (!rateLimit(`creative-dl:${await hashKey("creative", user.id)}`, 30, 60 * 60_000).ok) return { error: "Bir saatte en fazla 30 indirme yapılabilir. Biraz sonra tekrar dene." };
  try {
    const res = await exportCreative(getRepo(), {
      requestId: d.requestId,
      layout: d.layout,
      size: d.size,
      req: { brandId: q.marka, platform: q.platform, sector: q.sektor, headline: q.baslik, body: q.metin, cta: q.cta },
    });
    if (!res.ok) return { error: res.error };
    if (res.charged) revalidatePath("/panel", "layout");
    return { error: null, href: `/api/generations/${res.generation.id}/files/0`, charged: res.charged };
  } catch {
    console.error("creative export failed");
    return { error: "Görsel hazırlanamadı. Biraz sonra yeniden dene; kredin düşmedi." };
  }
}
