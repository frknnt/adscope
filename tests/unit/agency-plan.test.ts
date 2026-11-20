import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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

const { MemoryRepo, MemoryAdminRepo, __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
const { AGENCY_PACKAGES, AGENCY_PER_BRAND_CREDITS, AGENCY_PER_BRAND_MINOR, CREDIT_PACKAGES, findPackage, isPlanPackage, PLAN_REMINDER_DAYS } = await import("@/lib/payments/packages");
const { addOneMonth, nextPeriod, planStatus } = await import("@/lib/payments/plan");
const { buildPlanReminderEmail, sendPlanReminders } = await import("@/lib/payments/plan-reminder");
const { MemoryOutbox } = await import("@/lib/email/provider");
const { LEGAL_VERSIONS } = await import("@/lib/legal");

type Store = { planPeriods?: { id: string; endsAt: string; startsAt: string; userId: string }[] };
const store = () => (globalThis as unknown as { __adscopeStore: Store }).__adscopeStore;
const DAY = 86_400_000;

async function user() {
  const repo = new MemoryRepo();
  const r = await repo.signUp({ email: `plan-${randomUUID()}@example.com`, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
  if (!r.ok || !r.userId) throw new Error("signup failed");
  return { repo, id: r.userId };
}

function buy(userId: string, packageId: string, order = randomUUID()) {
  const pkg = findPackage(packageId)!;
  return new MemoryAdminRepo().applyPurchase({ provider: "shopier", eventId: `order:${order}`, orderId: order, userId, packageId, credits: pkg.credits, amountMinor: pkg.priceMinor, currency: "TRY", isDemo: false });
}

/** Moves every period of the user so that the last one ends `days` from now. */
function shiftToEndIn(userId: string, days: number) {
  const mine = (store().planPeriods ?? []).filter((p) => p.userId === userId);
  const last = Math.max(...mine.map((p) => Date.parse(p.endsAt)));
  const delta = Date.now() + days * DAY - last;
  for (const p of mine) {
    p.startsAt = new Date(Date.parse(p.startsAt) + delta).toISOString();
    p.endsAt = new Date(Date.parse(p.endsAt) + delta).toISOString();
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("APP_MODE", "demo");
  __resetMemoryStoreForTests();
  jar.clear();
  MemoryOutbox.messages().length = 0;
});

describe("agency package pricing", () => {
  it("prices per brand with monthly credits per brand, in three tiers", () => {
    expect(AGENCY_PACKAGES.map((p) => p.id)).toEqual(["ajans_3", "ajans_5", "ajans_10"]);
    for (const p of AGENCY_PACKAGES) {
      expect(p.priceMinor).toBe(p.plan!.brands * AGENCY_PER_BRAND_MINOR);
      expect(p.credits).toBe(p.plan!.brands * AGENCY_PER_BRAND_CREDITS);
      expect(p.description).toMatch(/Kendiliğinden yenilenmez/);
      expect(p.description).toMatch(/Müşteri onay bağlantısı ve Düzenleyici rolü dahil/);
    }
    expect(isPlanPackage("ajans_5")).toBe(true);
    expect(isPlanPackage("profesyonel")).toBe(false);
    expect(isPlanPackage("ajans")).toBe(false);
    expect(CREDIT_PACKAGES.filter((p) => !p.plan).map((p) => p.id)).toEqual(["baslangic", "profesyonel"]);
  });

  it("legal texts were versioned for the new package table", () => {
    expect(LEGAL_VERSIONS.distanceSales).toBe("2026-11-20");
    expect(LEGAL_VERSIONS.preInfo).toBe("2026-11-20");
    const contract = readFileSync("src/app/(site)/mesafeli-satis-sozlesmesi/page.tsx", "utf8");
    expect(contract).toContain("kendiliğinden yenilenmez");
    expect(contract).toContain('updated="20.11.2026"');
    expect(readFileSync("src/app/(site)/on-bilgilendirme-formu/page.tsx", "utf8")).toContain("Ajans paketi (aylık)");
  });
});

describe("plan periods", () => {
  it("adds one calendar month in UTC and clamps to the month's end", () => {
    expect(addOneMonth(new Date("2026-11-20T10:00:00Z")).toISOString()).toBe("2026-12-20T10:00:00.000Z");
    expect(addOneMonth(new Date("2027-01-31T08:30:00Z")).toISOString()).toBe("2027-02-28T08:30:00.000Z");
    expect(addOneMonth(new Date("2028-01-31T00:00:00Z")).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addOneMonth(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("starts now, or right after a period that has not ended yet", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    expect(nextPeriod(null, now).startsAt).toEqual(now);
    expect(nextPeriod(new Date("2026-11-01T00:00:00Z"), now).startsAt).toEqual(now);
    const later = new Date("2026-11-25T00:00:00Z");
    expect(nextPeriod(later, now)).toEqual({ startsAt: later, endsAt: new Date("2026-12-25T00:00:00Z") });
  });

  it("reports the current period and the renewal window", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const p = (id: string, start: string, end: string, status: "active" | "refunded" = "active") => ({ id, packageId: "ajans_3", brands: 3, credits: 450, startsAt: start, endsAt: end, status, reminderSentAt: null });
    expect(planStatus([], now)).toMatchObject({ current: null, last: null, daysLeft: 0, renewSoon: false });
    const a = p("a", "2026-10-22T00:00:00Z", "2026-11-22T00:00:00Z");
    expect(planStatus([a], now)).toMatchObject({ current: { id: "a" }, daysLeft: 2, renewSoon: true });
    const b = p("b", "2026-11-22T00:00:00Z", "2026-12-22T00:00:00Z");
    expect(planStatus([b, a], now)).toMatchObject({ current: { id: "a" }, last: { id: "b" }, renewSoon: false });
    expect(planStatus([p("r", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", "refunded")], now)).toMatchObject({ current: null, last: null });
    expect(PLAN_REMINDER_DAYS).toBe(3);
  });
});

describe("agency package purchases (memory backend)", () => {
  it("writes monthly credits with their own ledger reason and opens one period per paid order", async () => {
    const { repo, id } = await user();
    const order = randomUUID();
    const [r1, r2] = await Promise.all([buy(id, "ajans_3", order), buy(id, "ajans_3", order)]);
    expect([r1.applied, r2.applied].filter(Boolean)).toHaveLength(1);
    expect(await repo.getBalance()).toBe(3 + 390);
    const ledger = await repo.listLedger();
    expect(ledger.filter((l) => l.reason === "monthly_credits")).toHaveLength(1);
    expect(ledger.find((l) => l.reason === "monthly_credits")?.note).toBe("Ajans aylık paketi (3 marka)");
    const periods = await repo.listPlanPeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ packageId: "ajans_3", brands: 3, credits: 390, status: "active", reminderSentAt: null });
    expect(periods[0].endsAt).toBe(addOneMonth(new Date(periods[0].startsAt)).toISOString());

    // A one-time package opens no period and keeps the old reason.
    await buy(id, "baslangic");
    expect((await repo.listLedger()).some((l) => l.reason === "purchase")).toBe(true);
    expect(await repo.listPlanPeriods()).toHaveLength(1);
  });

  it("an early renewal starts when the running month ends", async () => {
    const { repo, id } = await user();
    await buy(id, "ajans_3");
    await buy(id, "ajans_5");
    const [later, first] = await repo.listPlanPeriods();
    expect(later.packageId).toBe("ajans_5");
    expect(later.startsAt).toBe(first.endsAt);
    expect(await repo.getBalance()).toBe(3 + 390 + 650);
  });

  it("a refund ends the month, takes its credits back once and stops the reminder", async () => {
    const { repo, id } = await user();
    const order = randomUUID();
    await buy(id, "ajans_3", order);
    shiftToEndIn(id, 2);
    expect(await new MemoryAdminRepo().applyRefund({ provider: "shopier", orderId: order })).toEqual({ applied: true });
    expect(await new MemoryAdminRepo().applyRefund({ provider: "shopier", orderId: order })).toEqual({ applied: false });
    expect(await repo.getBalance()).toBe(3);
    expect((await repo.listPlanPeriods())[0].status).toBe("refunded");
    expect(await new MemoryAdminRepo().listPlanRenewalsDue(new Date(), PLAN_REMINDER_DAYS)).toEqual([]);
  });

  it("periods are private to their owner", async () => {
    const a = await user();
    await buy(a.id, "ajans_10");
    const b = await user();
    expect(await b.repo.listPlanPeriods()).toEqual([]);
  });
});

describe("renewal reminders", () => {
  it("sends one e-mail three days before the end, never twice, and not after a renewal", async () => {
    const { id } = await user();
    await buy(id, "ajans_3");
    const admin = new MemoryAdminRepo();
    const outbox = new MemoryOutbox();
    shiftToEndIn(id, 10);
    expect(await sendPlanReminders(admin, outbox, "https://adscope.test")).toEqual({ sent: 0, failed: 0 });
    shiftToEndIn(id, 2.5);
    expect(await sendPlanReminders(admin, outbox, "https://adscope.test")).toEqual({ sent: 1, failed: 0 });
    expect(await sendPlanReminders(admin, outbox, "https://adscope.test")).toEqual({ sent: 0, failed: 0 });
    const mail = MemoryOutbox.messages()[0];
    expect(mail.subject).toMatch(/Ajans paketin .* tarihinde bitiyor/);
    expect(mail.text).toContain("https://adscope.test/panel/krediler?yenile=ajans_3#ajans-paketi");
    expect(mail.text).toContain("kendiliğinden yenilenmez");
    expect(mail.text).toContain("Risk değerlendirmesidir, hukuki görüş değildir.");
    expect(mail.idempotencyKey).toMatch(/^plan-renewal:/);

    // Renewed before the window: the old month gets no reminder, the new one later gets its own.
    const other = await user();
    await buy(other.id, "ajans_5");
    await buy(other.id, "ajans_5");
    const periods = (store().planPeriods ?? []).filter((p) => p.userId === other.id).sort((x, y) => Date.parse(x.endsAt) - Date.parse(y.endsAt));
    const shift = Date.now() + 2 * DAY - Date.parse(periods[0].endsAt);
    for (const p of periods) {
      p.startsAt = new Date(Date.parse(p.startsAt) + shift).toISOString();
      p.endsAt = new Date(Date.parse(p.endsAt) + shift).toISOString();
    }
    expect(await admin.listPlanRenewalsDue(new Date(), PLAN_REMINDER_DAYS)).toEqual([]);
  });

  it("a failed send is released and retried on the next run", async () => {
    const { id } = await user();
    await buy(id, "ajans_3");
    shiftToEndIn(id, 1);
    const admin = new MemoryAdminRepo();
    const broken = { name: "broken", send: async () => ({ ok: false as const, reason: "api_error" as const }) };
    expect(await sendPlanReminders(admin, broken, "https://adscope.test")).toEqual({ sent: 0, failed: 1 });
    expect(await sendPlanReminders(admin, new MemoryOutbox(), "https://adscope.test")).toEqual({ sent: 1, failed: 0 });
  });

  it("the e-mail promises nothing and escapes the display name", () => {
    const due = { periodId: "p", userId: "u", email: "x@example.com", displayName: "<b>Ajans</b>", packageId: "ajans_10", endsAt: "2026-12-20T09:00:00.000Z" };
    const m = buildPlanReminderEmail(due, "https://adscope.test");
    expect(m.html).toContain("&lt;b&gt;Ajans&lt;/b&gt;");
    expect(m.html).not.toContain("<b>Ajans</b>");
    expect(`${m.subject} ${m.text}`).toContain("20 Aralık 2026");
    expect(m.text).not.toMatch(/garanti|kesin onay|hukuken uygun|reddedilmez|süresiz|son kullanma/i);
  });
});
