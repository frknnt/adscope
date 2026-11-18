import "server-only";

/**
 * Runtime configuration. Two independent switches:
 *
 *  APP_MODE      demo | production
 *    demo        -> "Demo modu" banner, demo purchases allowed (no real payment), deterministic
 *                   analysis unless an AI key is set.
 *    production  -> demo purchases disabled, Supabase required, banner hidden.
 *                   Forced on Vercel production deployments (VERCEL_ENV=production).
 *
 *  Data backend  supabase when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *                + SUPABASE_SECRET_KEY are set; otherwise an in-memory demo store
 *                (only allowed when APP_MODE=demo).
 */

export type AppMode = "demo" | "production";

export function appMode(): AppMode {
  // A Vercel production deployment is always production: a forgotten APP_MODE must never turn on demo
  // purchases (free credits) or the in-memory store on the live domain. Previews may still run as demo.
  if (process.env.VERCEL_ENV === "production") return "production";
  return process.env.APP_MODE === "production" ? "production" : "demo";
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (url && publishableKey && secretKey) return { url, publishableKey, secretKey };
  return null;
}

export function dataBackend(): "supabase" | "memory" {
  if (supabaseConfig()) return "supabase";
  if (appMode() === "production") {
    throw new Error("APP_MODE=production requires Supabase environment variables.");
  }
  return "memory";
}

export function demoPurchasesAllowed() {
  return appMode() === "demo";
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function retentionDefaultDays() {
  const n = Number(process.env.RETENTION_DAYS_DEFAULT ?? 90);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.round(n) : 90;
}

export function hourlyAnalysisLimit() {
  const n = Number(process.env.ANALYSIS_HOURLY_LIMIT ?? 20);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 20;
}

export function demoSessionSecret() {
  // Only used by the in-memory demo backend. A per-process fallback keeps local dev working.
  const g = globalThis as unknown as { __adscopeDemoSecret?: string };
  if (process.env.DEMO_SESSION_SECRET) return process.env.DEMO_SESSION_SECRET;
  if (!g.__adscopeDemoSecret) g.__adscopeDemoSecret = crypto.randomUUID() + crypto.randomUUID();
  return g.__adscopeDemoSecret;
}

/** Search engines may index public pages only when SITE_INDEXABLE=true and the app runs in production. */
export function siteIndexable() {
  return process.env.SITE_INDEXABLE === "true" && appMode() === "production";
}
