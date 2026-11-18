import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Customer webhook signatures. Header: `X-AdScope-Signature: t=<unix seconds>,v1=<hex>` where
 * v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). Receivers should reject timestamps older than 5 minutes.
 */
export const SIGNATURE_HEADER = "X-AdScope-Signature";
export const SIGNATURE_TOLERANCE_SEC = 300;

export function newWebhookSecret() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhook(secret: string, body: string, nowSec = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${nowSec}.${body}`).digest("hex");
  return `t=${nowSec},v1=${v1}`;
}

/** Reference verifier (also documented for customers). */
export function verifyWebhook(secret: string, body: string, header: string, nowSec = Math.floor(Date.now() / 1000)) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(parts.v1 ?? "")) return false;
  if (Math.abs(nowSec - t) > SIGNATURE_TOLERANCE_SEC) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"), "hex");
  return timingSafeEqual(want, Buffer.from(parts.v1, "hex"));
}

/** Customer webhook URLs: https, port 443, no credentials, public host names only. */
export function validateWebhookUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || /^\[|^\d+\.\d+\.\d+\.\d+$/.test(host) || /(^|\.)(localhost|local|internal|home|lan)$/.test(host)) return null;
  u.hash = "";
  const s = u.toString();
  return s.length <= 500 ? s : null;
}

/** Retry schedule after a failed delivery attempt (attempt is 1-based). */
export function retryDelayMs(attempt: number) {
  return [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000][Math.min(attempt, 5) - 1];
}
