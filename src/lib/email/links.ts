import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appMode, demoSessionSecret } from "@/lib/env";

/** Secret for one-click e-mail preference links. Demo mode falls back to the demo session secret. */
function linkSecret() {
  const s = process.env.EMAIL_LINK_SECRET ?? "";
  if (s.length >= 32) return s;
  return appMode() === "demo" ? demoSessionSecret() : null;
}

function sign(userId: string, secret: string) {
  return createHmac("sha256", secret).update(`email-optout:${userId}`).digest("hex").slice(0, 40);
}

/** Link that turns off every non-essential e-mail without signing in; falls back to Ayarlar. */
export function unsubscribeUrl(siteUrl: string, userId: string) {
  const secret = linkSecret();
  if (!secret) return `${siteUrl}/panel/ayarlar`;
  return `${siteUrl}/e-posta-tercihleri?u=${encodeURIComponent(userId)}&t=${sign(userId, secret)}`;
}

export function verifyUnsubscribe(userId: unknown, token: unknown): userId is string {
  const secret = linkSecret();
  if (!secret || typeof userId !== "string" || typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f]{40}$/.test(token)) return false;
  const want = Buffer.from(sign(userId, secret));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
