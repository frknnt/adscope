import "server-only";
import { findPackage, hmacHex, isUuid, safeEqualHex, type PaymentProvider, type WebhookOutcome } from "./provider";
import type { CreditPackage } from "./packages";

/**
 * Lemon Squeezy adapter (skeleton, verified against docs on 2026-11-16):
 *  - Webhook signature: HMAC-SHA256 hex digest of the raw body with the signing secret, sent in `X-Signature`.
 *  - One-time purchases: `order_created`; refunds: `order_refunded` (ignored here, handled manually for now).
 *  - Checkout links carry `checkout[custom][user_id]`, echoed back in `meta.custom_data`.
 * Variant ids per package come from env so no ids are hard-coded.
 */
export class LemonSqueezyProvider implements PaymentProvider {
  readonly id = "lemonsqueezy" as const;
  readonly label = "Lemon Squeezy (uluslararası kart)";

  private secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";
  private storeUrl = process.env.LEMONSQUEEZY_STORE_URL ?? "";
  private variants: Record<string, string | undefined> = {
    baslangic: process.env.LEMONSQUEEZY_VARIANT_BASLANGIC,
    profesyonel: process.env.LEMONSQUEEZY_VARIANT_PROFESYONEL,
    ajans: process.env.LEMONSQUEEZY_VARIANT_AJANS,
  };

  isConfigured() {
    return Boolean(this.secret && this.storeUrl && this.variants.baslangic && this.variants.profesyonel);
  }

  checkoutUrl(pkg: CreditPackage, userId: string, email: string) {
    const variant = this.variants[pkg.id];
    if (!this.isConfigured() || !variant) return null;
    const url = new URL(`/checkout/buy/${encodeURIComponent(variant)}`, this.storeUrl);
    url.searchParams.set("checkout[custom][user_id]", userId);
    url.searchParams.set("checkout[custom][package_id]", pkg.id);
    url.searchParams.set("checkout[email]", email);
    return url.toString();
  }

  parseWebhook(rawBody: string, headers: Headers): WebhookOutcome {
    if (!this.secret) return { kind: "invalid", reason: "not_configured" };
    const signature = headers.get("x-signature") ?? "";
    if (!safeEqualHex(hmacHex(this.secret, rawBody), signature)) return { kind: "invalid", reason: "bad_signature" };

    let body: {
      meta?: { event_name?: string; custom_data?: Record<string, unknown>; webhook_id?: string };
      data?: { id?: string; attributes?: { status?: string; total?: number; currency?: string; identifier?: string } };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { kind: "invalid", reason: "bad_json" };
    }
    const event = body.meta?.event_name;
    if (event !== "order_created") return { kind: "ignored", reason: `event:${event ?? "unknown"}` };
    const attrs = body.data?.attributes;
    if (attrs?.status !== "paid") return { kind: "ignored", reason: "not_paid" };
    const userId = body.meta?.custom_data?.user_id;
    const pkg = findPackage(String(body.meta?.custom_data?.package_id ?? ""));
    const orderId = String(body.data?.id ?? "");
    if (!isUuid(userId) || !pkg || !orderId) return { kind: "invalid", reason: "missing_custom_data" };
    return {
      kind: "purchase",
      purchase: {
        provider: "lemonsqueezy",
        eventId: `order_created:${orderId}`,
        orderId,
        userId,
        pkg,
        amountMinor: Number(attrs?.total ?? 0),
        currency: String(attrs?.currency ?? "USD"),
      },
    };
  }
}
