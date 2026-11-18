import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const FORBIDDEN_PHRASES = [/kesin onay/i, /hukuken uygundur/i, /reklam reddedilmez/i, /garantili/i];

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

const ctx = { siteUrl: "https://adscope.test", displayName: "Ada <b>", sector: "takviye_gida" as const, balance: 2, unsubscribeUrl: "https://adscope.test/e-posta-tercihleri?u=x&t=y" };

describe("welcome series", () => {
  it("schedules each step once, catches up one missed day and never bursts older steps", async () => {
    const { dueStep } = await import("@/lib/email/welcome");
    const created = "2026-11-01T09:00:00Z";
    const at = (h: number) => new Date(Date.parse(created) + h * 3_600_000);
    expect(dueStep(created, at(1))).toBe(0);
    expect(dueStep(created, at(25))).toBe(1);
    expect(dueStep(created, at(49))).toBe(1); // day 2: day-1 mail one day late
    expect(dueStep(created, at(73))).toBe(3);
    expect(dueStep(created, at(24 * 6))).toBeNull(); // day 6: day-3 mail is too old
    expect(dueStep(created, at(24 * 7 + 1))).toBe(7);
    expect(dueStep(created, at(24 * 14 + 1))).toBe(14);
    expect(dueStep(created, at(24 * 16 + 1))).toBeNull();
    expect(dueStep(created, at(-5))).toBeNull();
  });

  it("every e-mail has an opt-out link, the disclaimer, escaped names and no guarantee language", async () => {
    const { buildWelcomeEmail, WELCOME_STEPS, COMMERCIAL_STEPS } = await import("@/lib/email/welcome");
    for (const step of WELCOME_STEPS) {
      const m = buildWelcomeEmail(step, ctx);
      expect(m.text).toContain(ctx.unsubscribeUrl);
      expect(m.html).toContain("e-posta-tercihleri?u=x&amp;t=y");
      expect(m.text).toContain("hukuki görüş değildir");
      expect(m.html).not.toContain("<b>");
      for (const re of FORBIDDEN_PHRASES) expect(`${m.subject}\n${m.text}`).not.toMatch(re);
      expect(m.commercial).toBe(COMMERCIAL_STEPS.has(step));
    }
    expect(buildWelcomeEmail(3, ctx).text).toContain("/rehber/takviye-gida");
    expect(buildWelcomeEmail(7, ctx).subject).toContain("Kalan kredin: 2");
    expect(buildWelcomeEmail(3, { ...ctx, sector: null }).subject).toContain("Genel");
  });

  it("unsubscribe links are signed per user", async () => {
    const { unsubscribeUrl, verifyUnsubscribe } = await import("@/lib/email/links");
    const id = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
    const url = new URL(unsubscribeUrl("https://adscope.test", id));
    expect(url.pathname).toBe("/e-posta-tercihleri");
    expect(verifyUnsubscribe(url.searchParams.get("u"), url.searchParams.get("t"))).toBe(true);
    expect(verifyUnsubscribe("7f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b", url.searchParams.get("t"))).toBe(false);
    expect(verifyUnsubscribe(id, "0".repeat(40))).toBe(false);
  });

  describe("cron (memory backend, demo outbox)", () => {
    beforeEach(async () => {
      const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
      __resetMemoryStoreForTests();
      const { MemoryOutbox } = await import("@/lib/email/provider");
      MemoryOutbox.messages().length = 0;
      vi.stubEnv("CRON_SECRET", "unit-cron-secret-0123456789");
      // Memory backend and demo outbox, whatever .env.local holds.
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("RESEND_API_KEY", "");
    });

    afterEach(() => vi.unstubAllEnvs());

    async function run() {
      const { GET } = await import("@/app/api/cron/welcome/route");
      const { NextRequest } = await import("next/server");
      const res = await GET(new NextRequest("http://x/api/cron/welcome", { headers: { authorization: "Bearer unit-cron-secret-0123456789" } }));
      return (await res.json()) as { sent: number; skippedConsent: number };
    }

    it("sends day 0 once, sends the package mail only with marketing consent, and stops after opt-out", async () => {
      const { MemoryRepo, MemoryAdminRepo } = await import("@/lib/data/memory-repo");
      const { MemoryOutbox } = await import("@/lib/email/provider");
      const repo = new MemoryRepo();
      const a = await repo.signUp({ email: "onayli@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: true } });
      jar.clear();
      const b = await repo.signUp({ email: "onaysiz@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
      const first = await run();
      expect(first.sent).toBe(2);
      expect((await run()).sent).toBe(0);
      expect(MemoryOutbox.messages().map((m) => m.idempotencyKey).sort()).toEqual([`welcome:${a.ok && a.userId}:0`, `welcome:${b.ok && b.userId}:0`].sort());

      // Seven days later only the consenting user gets the package e-mail.
      vi.useFakeTimers({ now: Date.now() + 7 * 86_400_000 + 3_600_000, toFake: ["Date"] });
      const r = await run();
      expect(r).toMatchObject({ sent: 1, skippedConsent: 1 });
      expect(MemoryOutbox.messages().at(-1)?.to).toBe("onayli@example.com");
      vi.useRealTimers();

      await new MemoryAdminRepo().unsubscribeEmails(a.ok ? a.userId! : "");
      vi.useFakeTimers({ now: Date.now() + 14 * 86_400_000 + 3_600_000, toFake: ["Date"] });
      expect((await run()).sent).toBe(1); // only the user who did not opt out
      vi.useRealTimers();
    });

    it("rejects calls without the cron secret", async () => {
      const { GET } = await import("@/app/api/cron/welcome/route");
      const { NextRequest } = await import("next/server");
      expect((await GET(new NextRequest("http://x/api/cron/welcome"))).status).toBe(401);
    });
  });
});
