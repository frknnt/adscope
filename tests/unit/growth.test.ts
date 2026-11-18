import { createHmac, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

async function setup() {
  const { MemoryAdminRepo, MemoryRepo } = await import("@/lib/data/memory-repo");
  const admin = new MemoryAdminRepo();
  async function user(email: string) {
    jar.clear();
    const repo = new MemoryRepo();
    const r = await repo.signUp({ email, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    if (!r.ok || !r.userId) throw new Error("signup failed");
    return { id: r.userId, email, balance: async () => (await admin.adminListUsers(email)).find((u) => u.email === email)!.balance };
  }
  async function buy(userId: string, orderId: string, packageId = "baslangic", amountMinor = 49_900) {
    await admin.applyPurchase({ provider: "shopier", eventId: `order:${orderId}`, orderId, userId, packageId, credits: 10, amountMinor, currency: "TRY", isDemo: false });
    return admin.applyGrowthAfterPurchase({ userId, packageId, purchaseRef: `shopier:${orderId}`, amountMinor, currency: "TRY", isDemo: false, referralBonus: 5 });
  }
  return { admin, user, buy };
}

describe("growth helpers", () => {
  it("normalises e-mails so plus tags and Gmail dots count as the same person", async () => {
    const { emailHash, normalizeEmail, commissionOf, newCode } = await import("@/lib/growth/codes");
    expect(normalizeEmail("A.Da+kampanya@GoogleMail.com")).toBe("ada@gmail.com");
    expect(normalizeEmail("a.da+x@firma.com.tr")).toBe("a.da@firma.com.tr");
    expect(emailHash("ada@gmail.com")).toBe(emailHash("a.d.a+1@gmail.com"));
    expect(commissionOf(49_900, 2000)).toBe(9_980);
    expect(newCode("AD")).toMatch(/^AD-[A-Z2-9]{7}$/);
  });
});

describe("invites, coupons and commissions (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jar.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rewards both sides once on the invitee's first purchase and claws back on refund", async () => {
    const { admin, user, buy } = await setup();
    const inviter = await user("davet-eden@example.com");
    const code = await admin.ensureInviteCode(inviter.id);
    expect(await admin.ensureInviteCode(inviter.id)).toBe(code);
    const invitee = await user("gelen@example.com");
    expect(await admin.attachReferral({ inviteeId: invitee.id, inviteeEmail: invitee.email, code })).toBe("ok");
    expect(await admin.attachReferral({ inviteeId: invitee.id, inviteeEmail: invitee.email, code })).toBe("exists");

    expect((await buy(invitee.id, "1001")).referralRewarded).toBe(true);
    // Redelivery of the same purchase and a second purchase add nothing.
    expect((await buy(invitee.id, "1001")).referralRewarded).toBe(true);
    expect((await buy(invitee.id, "1002")).referralRewarded).toBe(false);
    expect(await invitee.balance()).toBe(3 + 10 + 5 + 10);
    expect(await inviter.balance()).toBe(3 + 5);
    const o = await admin.getInviteOverview(inviter.id);
    expect(o).toMatchObject({ inviteCode: code, invited: 1, rewarded: 1, earnedCredits: 5, partner: null });

    expect((await admin.applyRefund({ provider: "shopier", orderId: "1001" })).applied).toBe(true);
    expect((await admin.applyRefund({ provider: "shopier", orderId: "1001" })).applied).toBe(false);
    expect(await invitee.balance()).toBe(3 + 10 + 5 + 10 - 10 - 5);
    expect(await inviter.balance()).toBe(3);
    expect((await admin.getInviteOverview(inviter.id)).earnedCredits).toBe(0);
  });

  it("blocks self invites and a second invite of the same e-mail, even after the account is gone", async () => {
    const { admin, user } = await setup();
    const inviter = await user("ada@gmail.com");
    const code = await admin.ensureInviteCode(inviter.id);
    const alias = await user("a.da+ikinci@gmail.com");
    expect(await admin.attachReferral({ inviteeId: alias.id, inviteeEmail: alias.email, code })).toBe("self");
    expect(await admin.attachReferral({ inviteeId: inviter.id, inviteeEmail: inviter.email, code })).toBe("self");
    const first = await user("yeni@example.com");
    expect(await admin.attachReferral({ inviteeId: first.id, inviteeEmail: first.email, code })).toBe("ok");
    const again = await user("yeni+tekrar@example.com");
    expect(await admin.attachReferral({ inviteeId: again.id, inviteeEmail: again.email, code })).toBe("repeat");
    expect(await admin.attachReferral({ inviteeId: again.id, inviteeEmail: again.email, code: "AD-YOKBOYLE" })).toBe("invalid");
  });

  it("records partner commissions for every purchase and reverses them on refund", async () => {
    const { admin, user, buy } = await setup();
    const ops = await user("ops@example.com");
    const agency = await user("ajans@example.com");
    const code = await admin.grantPartnerCode({ adminId: ops.id, userId: agency.id, commissionBp: 2000 });
    expect(code).toMatch(/^ORT-/);
    const client = await user("musteri@example.com");
    expect(await admin.attachReferral({ inviteeId: client.id, inviteeEmail: client.email, code: code! })).toBe("ok");
    await buy(client.id, "2001", "baslangic", 49_900);
    await buy(client.id, "2001", "baslangic", 49_900);
    await buy(client.id, "2002", "profesyonel", 99_900);
    // The agency gets commission records, not referral credits; the client gets the first-purchase bonus.
    expect(await agency.balance()).toBe(3);
    expect(await client.balance()).toBe(3 + 10 + 5 + 10);
    let o = await admin.getInviteOverview(agency.id);
    expect(o.partner).toEqual({ code, commissionBp: 2000 });
    expect(o.commissions.map((c) => c.commissionMinor).sort()).toEqual([19_980, 9_980]);
    expect(o.pendingCommissionMinor).toBe(29_960);
    await admin.applyRefund({ provider: "shopier", orderId: "2002" });
    o = await admin.getInviteOverview(agency.id);
    expect(o.pendingCommissionMinor).toBe(9_980);
    expect((await admin.listAudit()).some((a) => a.action === "partner_code")).toBe(true);
  });

  it("enforces coupon validity, package limits and per-user limits; the bonus is granted once", async () => {
    const { admin, user, buy } = await setup();
    const ops = await user("ops3@example.com");
    const base = { packageIds: ["profesyonel"], startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: null, maxRedemptions: null, perUserLimit: 1, campaignLabel: "Kasım" };
    expect(await admin.createCoupon({ adminId: ops.id, code: "KASIM10", kind: "bonus_credits", value: 10, ...base })).toBe("ok");
    expect(await admin.createCoupon({ adminId: ops.id, code: "KASIM10", kind: "bonus_credits", value: 10, ...base })).toBe("exists");
    await admin.createCoupon({ adminId: ops.id, code: "YUZDE20", kind: "percent", value: 20, ...base, campaignLabel: null });
    await admin.createCoupon({ adminId: ops.id, code: "GECMIS", kind: "bonus_credits", value: 5, ...base, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2026-02-01T00:00:00Z" });
    const u = await user("kuponcu@example.com");
    expect(await admin.reserveCoupon({ code: "kasim10", userId: u.id, packageId: "baslangic" })).toBe("wrong_package");
    expect(await admin.reserveCoupon({ code: "YUZDE20", userId: u.id, packageId: "profesyonel" })).toBe("unsupported");
    expect(await admin.reserveCoupon({ code: "GECMIS", userId: u.id, packageId: "profesyonel" })).toBe("invalid");
    expect(await admin.reserveCoupon({ code: "YOK", userId: u.id, packageId: "profesyonel" })).toBe("invalid");
    expect(await admin.reserveCoupon({ code: "KASIM10", userId: u.id, packageId: "profesyonel" })).toBe("ok");
    expect(await admin.reserveCoupon({ code: "KASIM10", userId: u.id, packageId: "profesyonel" })).toBe("ok"); // same open reservation
    expect(await admin.getCouponReservation(u.id)).toMatchObject({ code: "KASIM10", packageId: "profesyonel", value: 10 });
    expect((await admin.listActiveCampaigns()).map((c) => c.code)).toEqual(["KASIM10"]);

    // A purchase of another package does not use the coupon.
    expect((await buy(u.id, "3001", "baslangic")).couponCredits).toBe(0);
    expect((await buy(u.id, "3002", "profesyonel")).couponCredits).toBe(10);
    expect((await buy(u.id, "3002", "profesyonel")).couponCredits).toBe(10); // redelivery: same grant, not a new one
    expect(await u.balance()).toBe(3 + 10 + 10 + 10);
    expect(await admin.reserveCoupon({ code: "KASIM10", userId: u.id, packageId: "profesyonel" })).toBe("used");
    expect((await admin.listCoupons()).find((c) => c.code === "KASIM10")?.redeemed).toBe(1);

    // Refund takes the coupon bonus back with the purchase.
    await admin.applyRefund({ provider: "shopier", orderId: "3002" });
    expect(await u.balance()).toBe(3 + 10);

    const id = (await admin.listCoupons()).find((c) => c.code === "KASIM10")!.id;
    await admin.setCouponActive({ adminId: ops.id, id, active: false });
    expect(await admin.listActiveCampaigns()).toEqual([]);
  });

  it("concurrency: a coupon with 5 uses is reserved exactly 5 times by 25 parallel buyers", async () => {
    const { admin, user } = await setup();
    const ops = await user("ops4@example.com");
    await admin.createCoupon({ adminId: ops.id, code: "ILK5", kind: "bonus_credits", value: 3, packageIds: [], startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: null, maxRedemptions: 5, perUserLimit: 1, campaignLabel: null });
    const buyers = [];
    for (let i = 0; i < 25; i++) buyers.push(await user(`alici${i}@example.com`));
    const results = await Promise.all(buyers.map((b) => admin.reserveCoupon({ code: "ILK5", userId: b.id, packageId: "baslangic" })));
    expect(results.filter((r) => r === "ok")).toHaveLength(5);
    expect(results.filter((r) => r === "exhausted")).toHaveLength(20);
  });

  it("concurrency: parallel purchases and redeliveries reward a referral exactly once", async () => {
    const { admin, user, buy } = await setup();
    const inviter = await user("paralel-davet@example.com");
    const code = await admin.ensureInviteCode(inviter.id);
    const invitee = await user("paralel-gelen@example.com");
    await admin.attachReferral({ inviteeId: invitee.id, inviteeEmail: invitee.email, code });
    const runs = await Promise.all(["a", "b", "c", "a", "b", "c"].map((o) => buy(invitee.id, `p-${o}`)));
    expect(runs.filter((r) => r.referralRewarded)).toHaveLength(2); // the winning purchase and its redelivery
    expect(await inviter.balance()).toBe(3 + 5);
    expect(await invitee.balance()).toBe(3 + 30 + 5);
  });

  it("does not give referral rewards for demo purchases outside demo mode", async () => {
    vi.stubEnv("APP_MODE", "production");
    const { afterPurchase } = await import("@/lib/growth/service");
    expect(await afterPurchase({ provider: "demo", eventId: randomUUID(), orderId: "x", userId: randomUUID(), packageId: "baslangic", amountMinor: 0, currency: "TRY", isDemo: true })).toBeNull();
  });
});

describe("Shopier refunds", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("parses a signed refund notification and rejects an unsigned one", async () => {
    vi.stubEnv("SHOPIER_ENABLED", "true");
    vi.stubEnv("SHOPIER_CALLBACK_SECRET", "test-secret-0123456789");
    vi.stubEnv("SHOPIER_LINK_BASLANGIC", "https://www.shopier.com/x/1");
    vi.stubEnv("SHOPIER_LINK_PROFESYONEL", "https://www.shopier.com/x/2");
    vi.stubEnv("SHOPIER_LINK_AJANS", "https://www.shopier.com/x/3");
    vi.resetModules();
    const { ShopierProvider } = await import("@/lib/payments/shopier");
    const p = new ShopierProvider();
    const body = JSON.stringify({ order_id: "1001", status: "refunded" });
    const sig = createHmac("sha256", "test-secret-0123456789").update(body).digest("hex");
    expect(p.parseWebhook(body, new Headers({ "x-shopier-signature": sig }))).toEqual({ kind: "refund", provider: "shopier", orderId: "1001" });
    expect(p.parseWebhook(body, new Headers({ "x-shopier-signature": "00" })).kind).toBe("invalid");
  });
});
