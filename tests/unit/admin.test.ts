import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

describe("admin repo (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  async function user(email: string) {
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const repo = new MemoryRepo();
    await repo.signUp({ email, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    return { repo, id: (await repo.getUser())!.id };
  }

  it("grants the admin role only to configured demo addresses and never in production", async () => {
    const { MemoryAdminRepo } = await import("@/lib/data/memory-repo");
    const admin = new MemoryAdminRepo();
    const a = await user("ops@yonetim.adscope.test");
    const b = await user("musteri@example.com");
    expect(await admin.getAppRole(a.id)).toBeNull();
    vi.stubEnv("DEMO_ADMIN_EMAILS", "@yonetim.adscope.test");
    expect(await admin.getAppRole(a.id)).toBe("admin");
    expect(await admin.getAppRole(b.id)).toBeNull();
    vi.stubEnv("APP_MODE", "production");
    expect(await admin.getAppRole(a.id)).toBeNull();
  });

  it("adjusts credits once per request, refuses negative balances and writes the audit log", async () => {
    const { MemoryAdminRepo } = await import("@/lib/data/memory-repo");
    const admin = new MemoryAdminRepo();
    const ops = await user("ops2@example.com");
    const target = await user("hedef@example.com");
    const requestId = randomUUID();
    expect(await admin.adminAdjustCredits({ adminId: ops.id, userId: target.id, delta: 7, reason: "İade", requestId })).toBe("ok");
    expect(await admin.adminAdjustCredits({ adminId: ops.id, userId: target.id, delta: 7, reason: "İade", requestId })).toBe("exists");
    expect(await admin.adminAdjustCredits({ adminId: ops.id, userId: target.id, delta: -100, reason: "Hata", requestId: randomUUID() })).toBe("negative_balance");
    expect(await admin.adminAdjustCredits({ adminId: ops.id, userId: randomUUID(), delta: 1, reason: "Yok", requestId: randomUUID() })).toBe("not_found");
    expect((await target.repo.listLedger()).some((l) => l.reason === "admin_adjustment" && l.delta === 7)).toBe(true);
    const users = await admin.adminListUsers("hedef");
    expect(users).toHaveLength(1);
    expect(users[0].balance).toBe(10);
    const audit = await admin.listAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "credit_adjustment", adminId: ops.id, targetUserId: target.id, details: { delta: 7, reason: "İade" } });
  });
});
