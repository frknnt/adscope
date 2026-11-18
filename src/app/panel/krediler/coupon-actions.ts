"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAdminRepo } from "@/lib/data";
import { couponCodeSchema } from "@/lib/growth/codes";
import { findPackage } from "@/lib/payments/packages";
import { clientIp, hashKey } from "@/lib/security/rate-limit";
import { limit } from "@/lib/security/limiter";
import { requirePanelUser } from "@/app/panel/guard";

export type CouponState = { error: string | null; ok?: string; code?: string; packageId?: string };

const MESSAGES: Record<string, string> = {
  invalid: "Bu kupon geçerli değil ya da süresi dolmuş.",
  wrong_package: "Bu kupon seçtiğin pakette kullanılamıyor.",
  unsupported: "Bu kupon türü şu an ödeme sayfasında uygulanamıyor.",
  used: "Bu kuponu kullanım hakkını doldurdun.",
  exhausted: "Bu kuponun kullanım sınırı doldu.",
};

export async function reserveCouponAction(_prev: CouponState, form: FormData): Promise<CouponState> {
  const user = await requirePanelUser();
  const code = couponCodeSchema.safeParse(form.get("code"));
  const pkg = findPackage(String(form.get("packageId") ?? ""));
  // Typed values come back so the form keeps them after an error.
  const keep = { code: String(form.get("code") ?? "").slice(0, 24), packageId: pkg?.id };
  if (!code.success) return { error: code.error.issues[0]?.message ?? "Kupon kodunu kontrol et.", ...keep };
  if (!pkg) return { error: "Bir paket seç.", ...keep };
  // Guessing codes is slowed down per user and per IP.
  const h = await headers();
  const [a, b] = await Promise.all([limit(await hashKey("coupon", user.id), 10, 10 * 60_000), limit(await hashKey("coupon-ip", clientIp(h)), 30, 10 * 60_000)]);
  if (!a.ok || !b.ok) return { error: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.", ...keep };
  const status = await getAdminRepo().reserveCoupon({ code: code.data, userId: user.id, packageId: pkg.id });
  if (status !== "ok") return { error: MESSAGES[status] ?? MESSAGES.invalid, ...keep };
  revalidatePath("/panel/krediler");
  return { error: null, ok: `${code.data} kuponu ${pkg.name} paketi için ayrıldı. Bu paketi iki gün içinde aldığında ek kredi otomatik eklenir.` };
}

export async function releaseCouponAction() {
  const user = await requirePanelUser();
  await getAdminRepo().releaseCouponReservation(user.id);
  revalidatePath("/panel/krediler");
}
