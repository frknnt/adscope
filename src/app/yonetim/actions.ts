"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminRepo } from "@/lib/data";
import { requireAdmin } from "./guard";

export type AdjustState = { error: string | null; ok?: string };

const schema = z.object({
  requestId: z.uuid(),
  userId: z.uuid(),
  delta: z.coerce.number().int("Tam sayı gir.").refine((n) => n !== 0 && Math.abs(n) <= 10_000, "−10.000 ile 10.000 arasında, sıfırdan farklı bir sayı gir."),
  reason: z.string().trim().min(5, "Gerekçe en az 5 karakter olmalı.").max(300, "Gerekçe en fazla 300 karakter olabilir."),
});

export async function adjustCreditsAction(_prev: AdjustState, form: FormData): Promise<AdjustState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Alanları kontrol et." };
  const d = parsed.data;
  const r = await getAdminRepo().adminAdjustCredits({ adminId: admin.id, userId: d.userId, delta: d.delta, reason: d.reason, requestId: d.requestId });
  if (r === "not_found") return { error: "Kullanıcı bulunamadı." };
  if (r === "negative_balance") return { error: "Bakiye eksiye düşemez." };
  if (r === "error") return { error: "Kayıt yazılamadı. Tekrar dene." };
  revalidatePath("/yonetim/kullanicilar");
  return { error: null, ok: r === "exists" ? "Bu düzeltme zaten kaydedilmiş." : `${d.delta > 0 ? "+" : ""}${d.delta} kredi deftere yazıldı.` };
}
