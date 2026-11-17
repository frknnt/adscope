import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { validateImage } from "@/lib/security/file-validation";
import { rateLimit } from "@/lib/security/rate-limit";

const png = new Uint8Array(readFileSync("tests/fixtures/ad.png"));
const tiny = new Uint8Array(readFileSync("tests/fixtures/tiny.png"));

describe("file validation", () => {
  it("accepts a real PNG and reads its dimensions", () => {
    const r = validateImage(png, "image/png");
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.meta.width, r.meta.height]).toEqual([1080, 1080]);
  });
  it("rejects spoofed content, MIME mismatch, oversize and tiny images", () => {
    expect(validateImage(new TextEncoder().encode("<svg onload=alert(1)>"), "image/png").ok).toBe(false);
    expect(validateImage(png, "image/jpeg").ok).toBe(false);
    expect(validateImage(new Uint8Array(6 * 1024 * 1024), "image/png").ok).toBe(false);
    expect(validateImage(tiny, "image/png").ok).toBe(false);
    expect(validateImage(png, "image/gif").ok).toBe(false);
  });
  it("error messages are user-facing Turkish without internals", () => {
    const r = validateImage(png, "image/jpeg");
    if (!r.ok) expect(r.message).not.toMatch(/stack|Error:|undefined/);
  });
});

describe("rate limit", () => {
  it("blocks after the limit within the window", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(false);
  });
});

describe("payment webhooks", () => {
  afterEach(() => vi.unstubAllEnvs());
  const user = "8b2f3c1e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";

  it("Lemon Squeezy: verifies X-Signature and parses paid orders only", async () => {
    vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "whsec_test_123456");
    vi.stubEnv("LEMONSQUEEZY_STORE_URL", "https://example.lemonsqueezy.com");
    vi.stubEnv("LEMONSQUEEZY_VARIANT_BASLANGIC", "1");
    vi.stubEnv("LEMONSQUEEZY_VARIANT_PROFESYONEL", "2");
    const { LemonSqueezyProvider } = await import("@/lib/payments/lemonsqueezy");
    const p = new LemonSqueezyProvider();
    const body = JSON.stringify({ meta: { event_name: "order_created", custom_data: { user_id: user, package_id: "baslangic" } }, data: { id: "991", attributes: { status: "paid", total: 19900, currency: "TRY" } } });
    const sig = createHmac("sha256", "whsec_test_123456").update(body).digest("hex");
    const ok = p.parseWebhook(body, new Headers({ "x-signature": sig }));
    expect(ok.kind).toBe("purchase");
    if (ok.kind === "purchase") {
      expect(ok.purchase.eventId).toBe("order_created:991");
      expect(ok.purchase.pkg.credits).toBe(30);
    }
    expect(p.parseWebhook(body, new Headers({ "x-signature": "00".repeat(32) })).kind).toBe("invalid");
    expect(p.parseWebhook(body + " ", new Headers({ "x-signature": sig })).kind).toBe("invalid");
    const unpaid = body.replace('"paid"', '"pending"');
    expect(p.parseWebhook(unpaid, new Headers({ "x-signature": createHmac("sha256", "whsec_test_123456").update(unpaid).digest("hex") })).kind).toBe("ignored");
  });

  it("Shopier skeleton stays disabled until explicitly enabled", async () => {
    const { ShopierProvider } = await import("@/lib/payments/shopier");
    const p = new ShopierProvider();
    expect(p.isConfigured()).toBe(false);
    expect(p.parseWebhook("{}", new Headers()).kind).toBe("invalid");
  });
});

describe("production guards", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("treats a Vercel production deployment as production even without APP_MODE", async () => {
    const { appMode, demoPurchasesAllowed, dataBackend } = await import("@/lib/env");
    vi.stubEnv("APP_MODE", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(appMode()).toBe("production");
    expect(demoPurchasesAllowed()).toBe(false);
    expect(() => dataBackend()).toThrow();
    vi.stubEnv("APP_MODE", "demo");
    expect(appMode()).toBe("production");
  });
  it("lets previews and local runs stay in demo mode", async () => {
    const { appMode } = await import("@/lib/env");
    vi.stubEnv("APP_MODE", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(appMode()).toBe("demo");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_MODE", "production");
    expect(appMode()).toBe("production");
  });
});
