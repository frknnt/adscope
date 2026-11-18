import { createHash, randomInt } from "node:crypto";
import { z } from "zod";

/** Credits each side gets on the invitee's first purchase (P5.1). */
export const REFERRAL_BONUS_CREDITS = 5;
/** Default partner commission: 2000 basis points = %20 (recorded only; paid by hand). */
export const PARTNER_COMMISSION_BP = 2000;
/** A coupon reservation holds its place for two days, then lapses. */
export const COUPON_RESERVATION_MS = 2 * 24 * 60 * 60 * 1000;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

export function newCode(prefix: "AD" | "ORT") {
  let out = `${prefix}-`;
  for (let i = 0; i < 7; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export const inviteCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9-]{6,16}$/));

export const couponCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9-]{4,24}$/, "Kupon kodu 4-24 karakter olmalı; harf, rakam ve tire kullanılabilir."));

/**
 * Canonical form of an e-mail for repeat-invite checks: lower case, "+etiket" removed, and for
 * Gmail the dots removed, so ad+1@gmail.com and a.d@gmail.com count as the same person.
 */
export function normalizeEmail(email: string) {
  const [local = "", domainRaw = ""] = email.trim().toLowerCase().split("@");
  const domain = domainRaw === "googlemail.com" ? "gmail.com" : domainRaw;
  let name = local.split("+")[0];
  if (domain === "gmail.com") name = name.replaceAll(".", "");
  return `${name}@${domain}`;
}

export function emailHash(email: string) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function commissionOf(amountMinor: number, bp: number) {
  return Math.floor((Math.max(0, amountMinor) * bp) / 10_000);
}

export function purchaseRef(provider: string, orderOrEventId: string) {
  return `${provider}:${orderOrEventId}`;
}
