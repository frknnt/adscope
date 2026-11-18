"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminRepo } from "@/lib/data";
import { couponCodeSchema } from "@/lib/growth/codes";
import { CREDIT_PACKAGES } from "@/lib/payments/packages";
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

// Coupons and partner codes (P5.1, P5.2) ----------------------------------------------------------
export type GrowthState = { error: string | null; ok?: string };

const optionalInt = (max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(1).max(max).nullable());
const optionalDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarihi YYYY-AA-GG biçiminde gir.").nullable());

const couponSchema = z
  .object({
    code: couponCodeSchema,
    kind: z.enum(["bonus_credits", "percent", "fixed"]),
    value: z.coerce.number().int("Tam sayı gir.").min(1, "Değer en az 1 olmalı.").max(1_000_000),
    startsAt: optionalDate,
    expiresAt: optionalDate,
    maxRedemptions: optionalInt(1_000_000),
    perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
    campaignLabel: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(120, "Kampanya adı en fazla 120 karakter olabilir.").nullable()),
  })
  .refine((c) => c.kind !== "percent" || c.value <= 100, { message: "Yüzde indirim 1 ile 100 arasında olmalı." })
  .refine((c) => c.kind !== "bonus_credits" || c.value <= 1000, { message: "Ek kredi en fazla 1000 olabilir." })
  .refine((c) => !c.startsAt || !c.expiresAt || c.expiresAt > c.startsAt, { message: "Bitiş tarihi başlangıçtan sonra olmalı." });

/** "YYYY-AA-GG" in Türkiye time: starts at 00:00, ends at 23:59:59 of that day. */
function trDay(d: string, end: boolean) {
  return new Date(`${d}T${end ? "23:59:59" : "00:00:00"}+03:00`).toISOString();
}

export async function createCouponAction(_prev: GrowthState, form: FormData): Promise<GrowthState> {
  const admin = await requireAdmin();
  const parsed = couponSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Alanları kontrol et." };
  const c = parsed.data;
  const packageIds = form.getAll("packageIds").map(String).filter((id) => CREDIT_PACKAGES.some((p) => p.id === id));
  const r = await getAdminRepo().createCoupon({
    adminId: admin.id,
    code: c.code,
    kind: c.kind,
    value: c.value,
    packageIds,
    startsAt: c.startsAt ? trDay(c.startsAt, false) : new Date().toISOString(),
    expiresAt: c.expiresAt ? trDay(c.expiresAt, true) : null,
    maxRedemptions: c.maxRedemptions,
    perUserLimit: c.perUserLimit,
    campaignLabel: c.campaignLabel,
  });
  if (r === "exists") return { error: "Bu kodla bir kupon zaten var." };
  if (r === "error") return { error: "Kupon kaydedilemedi. Tekrar dene." };
  revalidatePath("/yonetim/kuponlar");
  revalidatePath("/fiyatlandirma");
  return { error: null, ok: `${c.code} kuponu oluşturuldu.` };
}

export async function toggleCouponAction(form: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await getAdminRepo().setCouponActive({ adminId: admin.id, id: id.data, active: form.get("active") === "1" });
  revalidatePath("/yonetim/kuponlar");
  revalidatePath("/fiyatlandirma");
}

const partnerSchema = z.object({
  email: z.email("Geçerli bir e-posta gir.").transform((v) => v.toLowerCase()),
  percent: z.coerce.number().min(0.01, "Komisyon en az %0,01 olmalı.").max(50, "Komisyon en fazla %50 olabilir."),
});

export async function grantPartnerAction(_prev: GrowthState, form: FormData): Promise<GrowthState> {
  const admin = await requireAdmin();
  const parsed = partnerSchema.safeParse({ email: form.get("email"), percent: String(form.get("percent") ?? "").replace(",", ".") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Alanları kontrol et." };
  const repo = getAdminRepo();
  const user = (await repo.adminListUsers(parsed.data.email)).find((u) => u.email === parsed.data.email);
  if (!user) return { error: "Bu e-postayla bir kullanıcı bulunamadı." };
  const code = await repo.grantPartnerCode({ adminId: admin.id, userId: user.id, commissionBp: Math.round(parsed.data.percent * 100) });
  if (!code) return { error: "Ortaklık kodu oluşturulamadı." };
  revalidatePath("/yonetim/kuponlar");
  return { error: null, ok: `${user.email} için ortaklık kodu: ${code}` };
}
