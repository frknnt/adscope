import "server-only";
import { findPackage, hmacHex, isUuid, safeEqualHex, type PaymentProvider, type WebhookOutcome } from "./provider";

/**
 * Shopier adapter — SKELETON ONLY.
 *
 * Shopier's seller terms and callback/API documentation could not be read during verification
 * (2026-11-16), so the payload format and signature scheme below are placeholders that must be
 * replaced with the official specification before enabling. Until SHOPIER_ENABLED=true and the
 * secrets are set, this provider reports itself as not configured and the UI shows it as "Yakında".
 *
 * Expected shape (to be confirmed): a server-to-server callback carrying an order id, our user id
 * and package id, signed with a shared secret. We verify an HMAC-SHA256 hex signature in
 * `x-shopier-signature` as a conservative default.
 */
export class ShopierProvider implements PaymentProvider {
  readonly id = "shopier" as const;
  readonly label = "Shopier (Türkiye kartları, TL)";

  private enabled = process.env.SHOPIER_ENABLED === "true";
  private secret = process.env.SHOPIER_CALLBACK_SECRET ?? "";
  private links: Record<string, string | undefined> = {
    baslangic: process.env.SHOPIER_LINK_BASLANGIC,
    profesyonel: process.env.SHOPIER_LINK_PROFESYONEL,
  };

  isConfigured() {
    return this.enabled && Boolean(this.secret && this.links.baslangic && this.links.profesyonel);
  }

  checkoutUrl(pkg: { id: string }, userId: string) {
    const link = this.links[pkg.id];
    if (!this.isConfigured() || !link) return null;
    const url = new URL(link);
    url.searchParams.set("ref", userId);
    return url.toString();
  }

  parseWebhook(rawBody: string, headers: Headers): WebhookOutcome {
    if (!this.isConfigured()) return { kind: "invalid", reason: "not_configured" };
    const signature = headers.get("x-shopier-signature") ?? "";
    if (!safeEqualHex(hmacHex(this.secret, rawBody), signature)) return { kind: "invalid", reason: "bad_signature" };
    let body: { order_id?: string; status?: string; user_id?: string; package_id?: string; total?: number; currency?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { kind: "invalid", reason: "bad_json" };
    }
    if (body.status !== "success") return { kind: "ignored", reason: "not_paid" };
    const pkg = findPackage(String(body.package_id ?? ""));
    if (!isUuid(body.user_id) || !pkg || !body.order_id) return { kind: "invalid", reason: "missing_fields" };
    return {
      kind: "purchase",
      purchase: {
        provider: "shopier",
        eventId: `order:${body.order_id}`,
        orderId: String(body.order_id),
        userId: body.user_id,
        pkg,
        amountMinor: Number(body.total ?? pkg.priceMinor),
        currency: String(body.currency ?? "TRY"),
      },
    };
  }
}
