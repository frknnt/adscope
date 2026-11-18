import "server-only";
import { getAdminRepo } from "@/lib/data";
import { appMode } from "@/lib/env";
import { REFERRAL_BONUS_CREDITS, inviteCodeSchema, purchaseRef } from "./codes";

/**
 * Runs after a verified purchase was written to the ledger: coupon bonus, first-purchase referral
 * reward and partner commission. Every step is idempotent per purchase reference, so webhook
 * redeliveries and retries are safe. Demo purchases count only in demo mode (no free credits on a
 * real database).
 */
export async function afterPurchase(p: { provider: string; eventId: string; orderId: string; userId: string; packageId: string; amountMinor: number; currency: string; isDemo: boolean }) {
  if (p.isDemo && appMode() !== "demo") return null;
  return getAdminRepo().applyGrowthAfterPurchase({
    userId: p.userId,
    packageId: p.packageId,
    purchaseRef: purchaseRef(p.provider, p.orderId || p.eventId),
    amountMinor: p.amountMinor,
    currency: p.currency,
    isDemo: p.isDemo,
    referralBonus: REFERRAL_BONUS_CREDITS,
  });
}

/** Links a freshly created account to an invite or partner code. Never blocks the signup. */
export async function attachInvite(p: { inviteeId: string; inviteeEmail: string; rawCode: unknown }) {
  const code = inviteCodeSchema.safeParse(p.rawCode);
  if (!code.success) return "invalid" as const;
  try {
    return await getAdminRepo().attachReferral({ inviteeId: p.inviteeId, inviteeEmail: p.inviteeEmail, code: code.data });
  } catch {
    console.warn("[growth] referral_attach_failed");
    return "invalid" as const;
  }
}
