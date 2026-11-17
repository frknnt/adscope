"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { suggestAudiencesFromSite, type AudienceSuggestion } from "@/lib/audience/service";
import { sensitiveHits, sensitiveMessage } from "@/lib/audience/sensitive";
import { getCurrentUser, getRepo } from "@/lib/data";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";
import type { ActionState } from "../actions";

const schema = z.object({
  brandId: z.uuid(),
  name: z.string().trim().min(2, "Profil adı en az 2 karakter olmalı.").max(60),
  ageMin: z.coerce.number().int().min(18, "Yaş en az 18 olmalı.").max(80),
  ageMax: z.coerce.number().int().min(18).max(80, "Yaş en fazla 80 olabilir."),
  need: z.string().trim().min(2, "İhtiyacı kısaca yaz.").max(300),
  objections: z.string().trim().max(300).default(""),
  tone: z.string().trim().max(120).default(""),
});

export async function saveAudienceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol et." };
  const d = parsed.data;
  if (d.ageMin > d.ageMax) return { error: "Yaş aralığının başı sonundan büyük olamaz." };
  const hits = sensitiveHits(d.name, d.need, d.objections, d.tone);
  if (hits.length) return { error: sensitiveMessage(hits) };
  const a = await getRepo().createAudience(d);
  if (!a) return { error: "Profil kaydedilemedi. Bir markada en fazla 20 profil olabilir." };
  revalidatePath("/panel/markalar");
  return { error: null, ok: `“${a.name}” profili eklendi.` };
}

export async function deleteAudienceAction(form: FormData) {
  if (!(await getCurrentUser())) return;
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getRepo().deleteAudience(id.data);
  revalidatePath("/panel/markalar");
}

export type AudienceSuggestState = { error: string | null; items?: AudienceSuggestion[]; dropped?: number };

/** Three suggestions from the brand's website with the AI; nothing is saved until the user saves a profile. */
export async function suggestAudiencesAction(brandId: string): Promise<AudienceSuggestState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const brand = (await getRepo().listBrands()).find((b) => b.id === brandId);
  if (!brand) return { error: "Marka bulunamadı." };
  if (!brand.website) return { error: "Önce markanın web sitesini marka kitine ekle." };
  const limit = rateLimit(`audience-ai:${await hashKey("audience-ai", user.id)}`, 5, 60 * 60_000);
  if (!limit.ok) return { error: "Bir saatte en fazla 5 öneri alınabilir." };
  const res = await suggestAudiencesFromSite(brand.website, brand.sector);
  return res.ok ? { error: null, items: res.items, dropped: res.dropped } : { error: res.error };
}
