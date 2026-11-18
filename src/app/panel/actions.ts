"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { afterPurchase } from "@/lib/growth/service";
import { SECTOR_IDS } from "@/lib/sectors";
import { regenerateAppeal } from "@/lib/analysis/service";
import { getCurrentUser, getRepo } from "@/lib/data";
import { demoPurchasesAllowed } from "@/lib/env";
import { checkoutConsentGiven, LEGAL_VERSIONS } from "@/lib/legal";
import { findPackage } from "@/lib/payments/packages";
import { getPaymentProvider } from "@/lib/payments";

export type ActionState = { error: string | null; ok?: string | null; /** One-time secret link or key, shown once after creation. */ link?: string | null };

const sector = z.enum(SECTOR_IDS);

async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/giris");
  return u;
}

const onboardingSchema = z.object({
  displayName: z.string().trim().max(80),
  companyName: z.string().trim().max(120),
  sector,
  brandName: z.string().trim().max(80),
  tone: z.enum(["samimi", "kurumsal", "genc"]),
});

export async function completeOnboardingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = onboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Lütfen alanları kontrol edin." };
  const repo = getRepo();
  const d = parsed.data;
  if (d.brandName) {
    const existing = await repo.listBrands();
    if (!existing.some((b) => b.name.toLocaleLowerCase("tr-TR") === d.brandName.toLocaleLowerCase("tr-TR"))) {
      const brand = await repo.createBrand({ name: d.brandName, sector: d.sector, tone: d.tone });
      if (!brand) return { error: "Marka kaydedilemedi. Lütfen tekrar deneyin." };
    }
  }
  const ok = await repo.updateProfile({
    displayName: d.displayName || null,
    companyName: d.companyName || null,
    defaultSector: d.sector,
    onboardingCompletedAt: new Date().toISOString(),
  });
  if (!ok) return { error: "Bilgiler kaydedilemedi. Lütfen tekrar deneyin." };
  redirect("/panel/yeni");
}

const settingsSchema = z.object({
  displayName: z.string().trim().max(80),
  companyName: z.string().trim().max(120),
  sector,
  retentionDays: z.coerce.number().int().min(7).max(365),
  seasonReminders: z.literal("on").optional(),
});

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Saklama süresi 7 ile 365 gün arasında olmalı." };
  const ok = await getRepo().updateProfile({
    displayName: parsed.data.displayName || null,
    companyName: parsed.data.companyName || null,
    defaultSector: parsed.data.sector,
    retentionDays: parsed.data.retentionDays,
    seasonReminders: parsed.data.seasonReminders === "on",
  });
  if (!ok) return { error: "Ayarlar kaydedilemedi. Lütfen tekrar deneyin." };
  revalidatePath("/panel/ayarlar");
  return { error: null, ok: "Ayarlar kaydedildi. Yeni saklama süresi bundan sonraki analizlere uygulanır." };
}

/** Turns season reminder e-mails on or off from the calendar page. */
export async function setSeasonRemindersAction(form: FormData) {
  await requireUser();
  const on = form.get("on") === "1";
  await getRepo().updateProfile({ seasonReminders: on });
  revalidatePath("/panel/takvim");
  revalidatePath("/panel/ayarlar");
}

export async function deleteAnalysisAction(form: FormData) {
  await requireUser();
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getRepo().deleteAnalysis(id.data);
  revalidatePath("/panel/gecmis");
  revalidatePath("/panel");
  if (form.get("from") === "detail") redirect("/panel/gecmis?silindi=1");
}

/** Deletes several of the user's own analyses (and their images). Returns how many were removed. */
export async function deleteAnalysesAction(ids: string[]): Promise<{ deleted: number }> {
  await requireUser();
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success) return { deleted: 0 };
  const repo = getRepo();
  let deleted = 0;
  for (const id of new Set(parsed.data)) if (await repo.deleteAnalysis(id)) deleted++;
  revalidatePath("/panel/gecmis");
  revalidatePath("/panel");
  return { deleted };
}

export async function deleteAccountAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const confirm = String(form.get("confirm") ?? "").trim().toLowerCase();
  if (!confirm || confirm !== u.email.trim().toLowerCase()) return { error: "Onaylamak için hesabının e-posta adresini aynen yazın." };
  const ok = await getRepo().deleteAccount();
  if (!ok) return { error: "Hesap silinemedi. Lütfen tekrar deneyin; sorun sürerse bize yazın." };
  redirect("/?hesap=silindi");
}

export async function demoPurchaseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!demoPurchasesAllowed()) return { error: "Demo satın alma bu ortamda kapalı." };
  const pkg = findPackage(String(form.get("packageId") ?? ""));
  if (!pkg) return { error: "Paket bulunamadı." };
  // Each click is its own demo order; the event id makes the ledger write idempotent if the action is replayed.
  const eventId = z.uuid().safeParse(form.get("eventId")).success ? String(form.get("eventId")) : randomUUID();
  const res = await getRepo().applyDemoPurchase(pkg.id, eventId);
  const growth = await afterPurchase({ provider: "demo", eventId, orderId: eventId, userId: user.id, packageId: pkg.id, amountMinor: pkg.priceMinor, currency: pkg.currency, isDemo: true }).catch(() => null);
  revalidatePath("/panel", "layout");
  const extra = growth?.couponCredits ? ` Kupon ile ${growth.couponCredits} ek kredi eklendi.` : "";
  return res.applied
    ? { error: null, ok: `${pkg.credits} demo kredisi eklendi.${extra} Gerçek ödeme alınmadı.` }
    : { error: null, ok: "Bu demo satın alma zaten işlenmişti; kredi tekrar eklenmedi." };
}

export async function startCheckoutAction(form: FormData) {
  const user = await requireUser();
  const provider = getPaymentProvider(String(form.get("provider") ?? ""));
  const pkg = findPackage(String(form.get("packageId") ?? ""));
  if (!provider || !pkg || !provider.isConfigured()) redirect("/panel/krediler?odeme=kapali");
  // The pre-information form and the distance sales contract must be accepted before every paid checkout.
  if (!checkoutConsentGiven(form)) redirect("/panel/krediler?odeme=onay-gerekli");
  const recorded = await getRepo().recordCheckoutConsent({ preInfo: LEGAL_VERSIONS.preInfo, distanceSales: LEGAL_VERSIONS.distanceSales });
  if (!recorded) redirect("/panel/krediler?odeme=hata");
  const url = provider.checkoutUrl(pkg, user.id, user.email);
  if (!url) redirect("/panel/krediler?odeme=kapali");
  redirect(url);
}

const appealSchema = z.object({
  analysisId: z.uuid(),
  rejectionMessage: z.string().trim().min(10, "Meta'nın ret mesajını yapıştırın (en az 10 karakter).").max(3000),
});

export async function appealAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = appealSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await regenerateAppeal(parsed.data.analysisId, parsed.data.rejectionMessage);
  if (!res.ok) return { error: "İtiraz taslağı hazırlanamadı. Analizin tamamlanmış olduğundan emin olun." };
  redirect(`/panel/analiz/${parsed.data.analysisId}#itiraz`);
}
