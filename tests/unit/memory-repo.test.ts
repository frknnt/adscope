import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A swappable cookie jar stands in for next/headers so each "browser" has its own session.
const jars: Record<string, Map<string, string>> = { a: new Map(), b: new Map() };
let current = "a";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars[current].has(k) ? { name: k, value: jars[current].get(k)! } : undefined),
    set: (k: string, v: string) => void jars[current].set(k, v),
    delete: (k: string) => void jars[current].delete(k),
  }),
}));

const { MemoryRepo, MemoryAdminRepo, __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
const { runPipeline } = await import("@/lib/engine/pipeline");
const { catalogRules } = await import("@/lib/data/memory-repo");

const consents = { terms: "v1", kvkk: "v1", privacy: "v1", marketing: false };
const as = (who: "a" | "b") => { current = who; return new MemoryRepo(); };
const params = (id = randomUUID()) => ({ clientRequestId: id, brandId: null, sector: "genel" as const, headline: "", primaryText: "Merhaba", description: "", rejectionMessage: null, demo: true, hourlyLimit: 100, mediaType: "image" as const, videoMeta: null, transcript: null, landingUrl: null, creditCost: 1 });
const result = async () => (await runPipeline({ input: { sector: "genel", headline: "", primaryText: "Merhaba", description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } }, rules: catalogRules(), ai: null })).result;

describe("demo (memory) backend mirrors the database guarantees", () => {
  beforeEach(async () => {
    __resetMemoryStoreForTests();
    jars.a.clear();
    jars.b.clear();
    await as("a").signUp({ email: "a@example.com", password: "Test-sifre-123", consents });
    await as("b").signUp({ email: "b@example.com", password: "Test-sifre-123", consents });
  });

  it("grants 3 credits once and rejects a duplicate account", async () => {
    expect(await as("a").getBalance()).toBe(3);
    const u = (await as("a").getUser())!;
    MemoryRepo.regrantSignupBonusForTest(u.id);
    expect(await as("a").getBalance()).toBe(3);
    expect((await as("a").signUp({ email: "A@example.com", password: "Test-sifre-123", consents })).ok).toBe(false);
  });

  it("charges only on completion, once, and never on failure", async () => {
    const r = as("a");
    const s1 = await r.startAnalysis(params());
    if (!s1.ok) throw new Error("start failed");
    await r.failAnalysis(s1.analysisId, "engine_error");
    expect(await r.getBalance()).toBe(3);
    expect(await r.completeAnalysis(s1.analysisId, await result())).toBe("already_failed");

    const s2 = await r.startAnalysis(params());
    if (!s2.ok) throw new Error("start failed");
    const [x, y] = await Promise.all([r.completeAnalysis(s2.analysisId, await result()), r.completeAnalysis(s2.analysisId, await result())]);
    expect([x, y].sort()).toEqual(["already_completed", "completed"]);
    expect(await r.getBalance()).toBe(2);
  });

  it("deduplicates a double click with the same request id", async () => {
    const id = randomUUID();
    const [x, y] = await Promise.all([as("a").startAnalysis(params(id)), as("a").startAnalysis(params(id))]);
    expect(x.ok && y.ok && x.analysisId === y.analysisId).toBe(true);
  });

  it("isolates users from each other's analyses", async () => {
    const s = await as("a").startAnalysis(params());
    if (!s.ok) throw new Error("start failed");
    expect(await as("b").getAnalysis(s.analysisId)).toBeNull();
    expect(await as("b").deleteAnalysis(s.analysisId)).toBe(false);
    expect(await as("b").getAssetBytes(s.analysisId)).toBeNull();
    expect(await as("a").getAnalysis(s.analysisId)).not.toBeNull();
  });

  it("applies a demo purchase and a webhook event once", async () => {
    const ev = randomUUID();
    expect((await as("a").applyDemoPurchase("baslangic", ev)).applied).toBe(true);
    expect((await as("a").applyDemoPurchase("baslangic", ev)).applied).toBe(false);
    expect(await as("a").getBalance()).toBe(33);
    const u = (await as("b").getUser())!;
    const admin = new MemoryAdminRepo();
    const p = { provider: "lemonsqueezy", eventId: "order_created:1", orderId: "1", userId: u.id, packageId: "profesyonel", credits: 100, amountMinor: 49900, currency: "TRY", isDemo: false };
    const [r1, r2] = await Promise.all([admin.applyPurchase(p), admin.applyPurchase(p)]);
    expect([r1.applied, r2.applied].filter(Boolean)).toHaveLength(1);
    expect(await as("b").getBalance()).toBe(103);
  });

  it("refuses to start without credits", async () => {
    const r = as("a");
    for (let i = 0; i < 3; i++) {
      const s = await r.startAnalysis(params());
      if (s.ok) await r.completeAnalysis(s.analysisId, await result());
    }
    const s = await r.startAnalysis(params());
    expect(s.ok ? "ok" : s.code).toBe("insufficient_credits");
  });

  it("stores video frames separately and serves each one only to its owner", async () => {
    const r = as("a");
    const videoMeta = { mime: "video/mp4" as const, durationSec: 12, width: 1080, height: 1920, sizeBytes: 5_000_000, frameCount: 2 };
    const s = await r.startAnalysis({ ...params(), mediaType: "video", videoMeta, transcript: "Merhaba", landingUrl: "https://ornek.com/" });
    if (!s.ok) throw new Error("start failed");
    const meta = { mime: "image/jpeg" as const, width: 1080, height: 1920, sizeBytes: 3 };
    expect(await r.uploadAsset(s.analysisId, new Uint8Array([1, 2, 3]), meta, "jpg", "x", { kind: "video_frame", frameIndex: 0, frameTimeMs: 300 })).toBe(true);
    expect(await r.uploadAsset(s.analysisId, new Uint8Array([4, 5, 6]), meta, "jpg", "y", { kind: "video_frame", frameIndex: 1, frameTimeMs: 6000 })).toBe(true);
    expect(await r.uploadAsset(s.analysisId, new Uint8Array([7]), meta, "jpg", "z", { kind: "video_frame", frameIndex: 1, frameTimeMs: 6000 })).toBe(false);
    const d = (await r.getAnalysis(s.analysisId))!;
    expect(d.mediaType).toBe("video");
    expect(d.asset).toBeNull();
    expect(d.frames.map((f) => [f.index, f.timeMs])).toEqual([[0, 300], [1, 6000]]);
    expect(d.videoMeta?.durationSec).toBe(12);
    expect(d.transcript).toBe("Merhaba");
    expect(d.landingUrl).toBe("https://ornek.com/");
    expect([...(await r.getAssetBytes(s.analysisId, 1))!.bytes]).toEqual([4, 5, 6]);
    expect(await r.getAssetBytes(s.analysisId)).toBeNull();
    expect(await as("b").getAssetBytes(s.analysisId, 0)).toBeNull();
  });

  it("charges a video analysis two credits and refuses it when only one is left", async () => {
    const r = as("a");
    const videoMeta = { mime: "video/mp4" as const, durationSec: 12, width: 1080, height: 1920, sizeBytes: 5_000_000, frameCount: 1 };
    const v = await r.startAnalysis({ ...params(), mediaType: "video", videoMeta, creditCost: 2 });
    if (!v.ok) throw new Error("start failed");
    expect(await r.completeAnalysis(v.analysisId, await result())).toBe("completed");
    expect(await r.completeAnalysis(v.analysisId, await result())).toBe("already_completed");
    expect(await r.getBalance()).toBe(1);
    expect((await r.getAnalysis(v.analysisId))?.creditCost).toBe(2);
    const ledger = await r.listLedger();
    expect(ledger.find((l) => l.analysisId === v.analysisId)).toMatchObject({ delta: -2, note: "Video analizi tamamlandı" });
    const again = await r.startAnalysis({ ...params(), mediaType: "video", videoMeta, creditCost: 2 });
    expect(again.ok ? "ok" : again.code).toBe("insufficient_credits");
    expect((await r.startAnalysis(params())).ok).toBe(true); // an image (1 credit) still fits
  });

  it("stores one landing screenshot and the speech transcript only for the owner", async () => {
    const r = as("a");
    const s = await r.startAnalysis(params());
    if (!s.ok) throw new Error("start failed");
    const meta = { mime: "image/png" as const, width: 1280, height: 2000, sizeBytes: 2 };
    expect(await r.uploadAsset(s.analysisId, new Uint8Array([9, 9]), meta, "png", "s", { kind: "landing_screenshot" })).toBe(true);
    expect(await r.uploadAsset(s.analysisId, new Uint8Array([8]), meta, "png", "t", { kind: "landing_screenshot" })).toBe(false);
    expect(await r.setSpeechTranscript(s.analysisId, "Merhaba dünya")).toBe(true);
    expect(await as("b").setSpeechTranscript(s.analysisId, "x")).toBe(false);
    const d = (await as("a").getAnalysis(s.analysisId))!;
    expect(d.hasLandingScreenshot).toBe(true);
    expect(d.speechTranscript).toBe("Merhaba dünya");
    expect([...(await as("a").getAssetBytes(s.analysisId, "screenshot"))!.bytes]).toEqual([9, 9]);
    expect(await as("b").getAssetBytes(s.analysisId, "screenshot")).toBeNull();
  });

  it("lists only opted-in users for season reminders and claims each event once", async () => {
    const admin = new MemoryAdminRepo();
    expect(await admin.listSeasonReminderRecipients()).toEqual([]);
    expect(await as("a").updateProfile({ seasonReminders: true })).toBe(true);
    const list = await admin.listSeasonReminderRecipients();
    expect(list.map((u) => u.email)).toEqual(["a@example.com"]);
    const id = list[0].userId;
    expect(await admin.claimSeasonReminder(id, "efsane-cuma-2027")).toBe(true);
    expect(await admin.claimSeasonReminder(id, "efsane-cuma-2027")).toBe(false);
    await admin.releaseSeasonReminder(id, "efsane-cuma-2027");
    expect(await admin.claimSeasonReminder(id, "efsane-cuma-2027")).toBe(true);
  });
});

describe("checkout consent (memory backend)", () => {
  it("needs a signed-in user and records both documents", async () => {
    __resetMemoryStoreForTests();
    jars.a.clear();
    await expect(as("a").recordCheckoutConsent({ preInfo: "v1", distanceSales: "v1" })).rejects.toThrow();
    await as("a").signUp({ email: "c@example.com", password: "Test-sifre-123", consents });
    expect(await as("a").recordCheckoutConsent({ preInfo: "v1", distanceSales: "v1" })).toBe(true);
  });
});
