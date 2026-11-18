import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { findPackage, type CreditPackage } from "./packages";

/** Normalised, verified payment event. Only these ever reach the credit ledger. */
export interface VerifiedPurchase {
  provider: "lemonsqueezy" | "shopier" | "demo";
  eventId: string;
  orderId: string;
  userId: string;
  pkg: CreditPackage;
  amountMinor: number;
  currency: string;
}

export type WebhookOutcome =
  | { kind: "purchase"; purchase: VerifiedPurchase }
  /** A verified refund of an earlier order: purchased and bonus credits are taken back. */
  | { kind: "refund"; provider: "lemonsqueezy" | "shopier"; orderId: string }
  | { kind: "ignored"; reason: string }
  | { kind: "invalid"; reason: string };

export interface PaymentProvider {
  readonly id: "lemonsqueezy" | "shopier";
  readonly label: string;
  /** true only when every required secret/config for this provider is present. */
  isConfigured(): boolean;
  /** Hosted checkout URL for a package, carrying our user id as custom data. */
  checkoutUrl(pkg: CreditPackage, userId: string, email: string): string | null;
  /** Verify signature and parse. Must be given the RAW request body. */
  parseWebhook(rawBody: string, headers: Headers): WebhookOutcome;
}

export function hmacHex(secret: string, body: string, algo: "sha256" = "sha256") {
  return createHmac(algo, secret).update(body, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export { findPackage };
