import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers(),
}));
const deliveries: { url: string; body: string }[] = [];
let deliveryResult: { ok: true; status: number } | { ok: false; status: number | null; code: "http" | "network" | "invalid_url" } = { ok: true, status: 200 };
vi.mock("@/lib/webhooks/deliver", () => ({
  deliverWebhook: async (url: string, _secret: string, body: string) => {
    deliveries.push({ url, body });
    return deliveryResult;
  },
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("APP_MODE", "demo");
});

describe("webhook signatures and URLs", () => {
  it("signs t.body with HMAC-SHA256 and rejects tampering and old timestamps", async () => {
    const { signWebhook, verifyWebhook, newWebhookSecret } = await import("@/lib/webhooks/sign");
    const secret = newWebhookSecret();
    expect(secret).toMatch(/^whsec_[A-Za-z0-9_-]{32}$/);
    const header = signWebhook(secret, '{"a":1}', 1_800_000_000);
    expect(header).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(verifyWebhook(secret, '{"a":1}', header, 1_800_000_100)).toBe(true);
    expect(verifyWebhook(secret, '{"a":2}', header, 1_800_000_100)).toBe(false);
    expect(verifyWebhook("whsec_other", '{"a":1}', header, 1_800_000_100)).toBe(false);
    expect(verifyWebhook(secret, '{"a":1}', header, 1_800_000_400)).toBe(false);
    expect(verifyWebhook(secret, '{"a":1}', "t=x,v1=zz")).toBe(false);
  });

  it("accepts only public https URLs on port 443", async () => {
    const { validateWebhookUrl } = await import("@/lib/webhooks/sign");
    expect(validateWebhookUrl("https://hooks.ornek.com/adscope?x=1#frag")).toBe("https://hooks.ornek.com/adscope?x=1");
    for (const bad of ["http://ornek.com/h", "https://ornek.com:8443/h", "https://user:pw@ornek.com/h", "https://localhost/h", "https://10.0.0.5/h", "https://[::1]/h", "https://metadata.internal/h", "https://intranet/h", "ftp://ornek.com"]) {
      expect(validateWebhookUrl(bad), bad).toBeNull();
    }
  });

  it("backs off 1 min, 5 min, 30 min, 2 h, 6 h", async () => {
    const { retryDelayMs } = await import("@/lib/webhooks/sign");
    expect([1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 21_600_000]);
  });
});

describe("error monitoring scrubbing", () => {
  it("removes e-mails, keys, tokens, phone numbers, ids, IPs, URLs and long quoted text", async () => {
    const { scrubText, routeOf } = await import("@/lib/monitoring/scrub");
    const out = scrubText(
      'ada@ornek.com failed with ads_live_abcdefghijklmnopqrstuvwxyz012345 Bearer abc.def eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl 0532 123 45 67 12345678901 ' +
        '6f1c2e9a-1b2c-4d3e-8f90-123456789abc 192.168.1.10 https://site.com/a?b=c "Bu reklam metni kesinlikle zayıflatır ve hemen sonuç verir"',
    );
    for (const leaked of ["ada@", "ads_live_", "eyJ", "0532", "12345678901", "6f1c2e9a", "192.168", "site.com", "zayıflatır"]) expect(out).not.toContain(leaked);
    expect(routeOf("/panel/analiz/6f1c2e9a-1b2c-4d3e-8f90-123456789abc?x=1")).toBe("/panel/analiz/[id]");
  });

  it("builds a Sentry event without request data", async () => {
    const { buildErrorEvent } = await import("@/lib/monitoring/report");
    const e = Object.assign(new Error("user ada@ornek.com: boom"), { digest: "123" });
    const ev = buildErrorEvent(e, { path: "/api/v1/analyses", kind: "route" });
    expect(ev.exception.values[0]).toEqual({ type: "Error", value: "user [email]: boom" });
    expect(ev.tags.route).toBe("/api/v1/analyses");
    expect(JSON.stringify(ev)).not.toContain("ada@ornek.com");
    expect(Object.keys(ev)).not.toContain("request");
    expect(Object.keys(ev)).not.toContain("user");
  });
});

describe("OpenAPI document", () => {
  it("describes the analysis endpoints, the webhook and the schemas the routes validate with", async () => {
    const { openApiDocument } = await import("@/lib/api/openapi");
    const doc = JSON.parse(JSON.stringify(openApiDocument("https://adscope.example")));
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(["/api/v1/analyses", "/api/v1/analyses/{id}"]);
    expect(doc.webhooks["analysis.completed"]).toBeTruthy();
    const req = doc.components.schemas.AnalysisRequest;
    expect(req.required).toEqual(expect.arrayContaining(["primary_text", "image"]));
    expect(req.properties.platform.enum).toEqual(expect.arrayContaining(["meta", "google_ads", "tiktok"]));
    expect(doc.components.schemas.Analysis.properties.disclaimer.const).toBe("Risk değerlendirmesidir, hukuki görüş değildir.");
  });
});

describe("job queue and webhooks (memory backend)", () => {
  async function setup() {
    const { MemoryAdminRepo, MemoryRepo, __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jar.clear();
    const repo = new MemoryRepo();
    const r = await repo.signUp({ email: `api-${Math.random()}@ornek.com`, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    if (!r.ok || !r.userId) throw new Error("signup failed");
    return { admin: new MemoryAdminRepo(), userId: r.userId };
  }

  it("dedupes, locks claimed jobs, retries with a delay and gives up after max attempts", async () => {
    const { admin } = await setup();
    const id = await admin.enqueueJob({ userId: null, kind: "webhook_delivery", payload: { x: 1 }, dedupeKey: "k1", maxAttempts: 2 });
    expect(id).toBeTruthy();
    expect(await admin.enqueueJob({ userId: null, kind: "webhook_delivery", payload: {}, dedupeKey: "k1" })).toBeNull();
    const [a, b] = await Promise.all([admin.claimJobs(5, 60), admin.claimJobs(5, 60)]);
    expect(a.length + b.length).toBe(1);
    const job = [...a, ...b][0];
    expect(job.attempts).toBe(1);
    await admin.finishJob(job.id, { ok: false, error: "delivery_http", retryAt: new Date(Date.now() + 60_000).toISOString() });
    expect(await admin.claimJobs(5, 60)).toHaveLength(0);
    await admin.finishJob(job.id, { ok: false, error: "x", retryAt: new Date(Date.now() - 1).toISOString() });
    const again = await admin.claimJobs(5, 60);
    expect(again[0]?.attempts).toBe(2);
    await admin.finishJob(job.id, { ok: false, error: "delivery_http", retryAt: null });
    expect(await admin.claimJobs(5, 60)).toHaveLength(0);
    expect((await admin.adminFunnel(new Date(Date.now() - 86400_000).toISOString())).failedJobs).toBe(1);
  });

  it("delivers analysis.completed once per webhook with a minimal payload and records the status", async () => {
    const { admin, userId } = await setup();
    const { queueAnalysisWebhooks, processJobs } = await import("@/lib/jobs/runner");
    expect(await admin.createWebhook(userId, "https://hooks.ornek.com/a", "whsec_" + "x".repeat(32))).toBe("ok");
    const hooks = await admin.listWebhooks(userId);
    expect(hooks).toHaveLength(1);
    expect(JSON.stringify(hooks)).not.toContain("whsec_");
    // A completed analysis owned by the user.
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const userRepo = new MemoryRepo({ id: userId, email: "" });
    const started = await userRepo.startAnalysis({ clientRequestId: crypto.randomUUID(), brandId: null, sector: "genel", platform: "meta", headline: "Gizli başlık", primaryText: "Gizli reklam metni", description: "", rejectionMessage: null, flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false }, mediaType: "image" } as never);
    expect(started.ok).toBe(true);
    const analysisId = (started as { analysisId: string }).analysisId;
    deliveries.length = 0;
    deliveryResult = { ok: true, status: 204 };
    expect(await queueAnalysisWebhooks(userId, analysisId)).toBe(1);
    expect(await queueAnalysisWebhooks(userId, analysisId)).toBe(0);
    const r = await processJobs(10);
    expect(r).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(deliveries).toHaveLength(1);
    const body = JSON.parse(deliveries[0].body);
    expect(body).toMatchObject({ type: "analysis.completed", data: { analysis_id: analysisId } });
    expect(deliveries[0].body).not.toContain("Gizli");
    expect((await admin.listWebhooks(userId))[0].lastStatus).toBe("204");
  });

  it("retries a failed delivery later instead of dropping it", async () => {
    const { admin, userId } = await setup();
    const { processJobs } = await import("@/lib/jobs/runner");
    await admin.createWebhook(userId, "https://hooks.ornek.com/b", "whsec_" + "y".repeat(32));
    const hook = (await admin.listWebhooks(userId))[0];
    await admin.enqueueJob({ userId, kind: "webhook_delivery", payload: { webhookId: hook.id, analysisId: crypto.randomUUID() } });
    // Missing analysis: permanent failure, no retry.
    expect(await processJobs(5)).toMatchObject({ claimed: 1, failed: 1 });
    expect(await admin.deleteWebhook(userId, hook.id)).toBe(true);
    expect(await admin.deleteWebhook(userId, hook.id)).toBe(false);
  });

  it("limits webhooks per user, counts API usage per Istanbul day and rate limits per key", async () => {
    const { admin, userId } = await setup();
    for (let i = 0; i < 3; i++) expect(await admin.createWebhook(userId, `https://h${i}.ornek.com/`, "whsec_" + "z".repeat(32))).toBe("ok");
    expect(await admin.createWebhook(userId, "https://h9.ornek.com/", "whsec_" + "z".repeat(32))).toBe("limit");
    const usage = await admin.getApiUsage(userId, 14);
    expect(usage).toHaveLength(14);
    expect(usage.every((u) => u.count === 0)).toBe(true);
    const key = `t-${Math.random()}`;
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await admin.rateLimitHit(key, 3, 60));
    expect(hits.map((h) => h.ok)).toEqual([true, true, true, false]);
    expect(hits[3].retryAfterSec).toBeGreaterThan(0);
    const { lastDays } = await import("@/lib/data/days");
    expect(lastDays(3, new Date("2026-11-18T22:30:00Z"))).toEqual(["2026-11-17", "2026-11-18", "2026-11-19"]);
  });
});
