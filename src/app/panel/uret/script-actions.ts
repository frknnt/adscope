"use server";

import { z } from "zod";
import { audienceForGeneration } from "@/lib/audience/service";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PLATFORM_IDS } from "@/lib/platforms";
import { runScriptGeneration } from "@/lib/script/service";
import { SECTOR_IDS } from "@/lib/sectors";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

export type ScriptActionState = { error: string | null; id?: string };

const schema = z.object({
  requestId: z.uuid(),
  productName: z.string().trim().max(80, "Ürün adı en fazla 80 karakter olabilir.").default(""),
  description: z.string().trim().max(600, "Açıklama en fazla 600 karakter olabilir.").default(""),
  brandId: z.union([z.uuid(), z.literal("")]).default(""),
  audienceId: z.union([z.uuid(), z.literal("")]).default(""),
  platform: z.enum(PLATFORM_IDS),
  sector: z.enum(SECTOR_IDS),
  duration: z.enum(["15", "30", "45"]),
  aiPerson: z.literal("on").optional(),
});

export async function generateScriptAction(_prev: ScriptActionState, form: FormData): Promise<ScriptActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol et." };
  const d = parsed.data;
  if (!d.productName && !d.description) return { error: "Ürünü ya da hizmeti kısaca anlat." };
  if (!rateLimit(`script:${await hashKey("script", user.id)}`, 20, 60 * 60_000).ok) return { error: "Bir saatte en fazla 20 senaryo üretilebilir. Biraz sonra tekrar dene." };
  const repo = getRepo();
  try {
    const audience = d.audienceId ? await audienceForGeneration(repo, d.audienceId, d.brandId || null) : null;
    if (d.audienceId && !audience) return { error: "Seçilen hedef kitle bu markaya ait değil." };
    const res = await runScriptGeneration(repo, {
      requestId: d.requestId,
      productName: d.productName,
      description: d.description,
      brandId: d.brandId || null,
      platform: d.platform,
      sector: d.sector,
      duration: Number(d.duration) as 15 | 30 | 45,
      audience,
      aiPersonOrVoice: d.aiPerson === "on",
    });
    if (!res.ok) return { error: res.error };
    return { error: null, id: res.generation.id };
  } catch {
    console.error("[script] generation_failed");
    return { error: "Senaryo üretilemedi. Kredi düşülmedi; lütfen tekrar dene." };
  }
}
