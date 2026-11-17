import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** SHA-256 (hex) of a high-entropy random token; only the hash is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A URL-safe random token with 256 bits of entropy, optionally prefixed (e.g. "ads_live_"). */
export function newToken(prefix = ""): { token: string; hash: string } {
  const token = prefix + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,120}$/;
