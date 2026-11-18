import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDigest, isoWeek, summarize, type WatchedAd } from "@/lib/competitors/summary";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

const ad = (id: string, start: string | null, over: Partial<WatchedAd> = {}): WatchedAd => ({ id, pageName: `Sayfa ${id}`, titles: ["Başlık"], bodies: ["Metin"], deliveryStart: start, deliveryStop: null, libraryUrl: `https://www.facebook.com/ads/library/?id=${id}`, ...over });
const today = new Date("2026-11-18T09:00:00Z");

describe("competitor summary", () => {
  it("records ads on the first check and counts only unseen ones afterwards", () => {
    const first = summarize([ad("1", "2026-10-01"), ad("2", "2026-11-10")], [], today);
    expect(first.summary.newCount).toBe(0);
    expect(first.seenIds).toEqual(["1", "2"]);
    const second = summarize([ad("1", "2026-10-01"), ad("3", "2026-11-16"), ad("4", null)], first.seenIds, today);
    expect(second.summary).toMatchObject({ newCount: 2, activeCount: 3 });
    expect(second.summary.longest.map((x) => [x.id, x.days])).toEqual([["1", 48], ["3", 2]]);
    expect(second.seenIds).toEqual(["1", "2", "3", "4"]);
    expect(JSON.stringify(second)).not.toContain("snapshot");
    expect(summarize([ad("9", null)], Array.from({ length: 1000 }, (_, i) => String(i)), today, 1000).seenIds).toHaveLength(1000);
  });

  it("keys digests by ISO week and keeps the EU-only note", () => {
    expect(isoWeek(new Date("2026-11-18T00:00:00Z"))).toBe("2026-W47");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    const d = buildDigest({ displayName: "Ece", siteUrl: "https://adscope.example", watches: [{ term: "kahve <b>", summary: { newCount: 3, activeCount: 9, longest: [] } }] });
    expect(d.subject).toBe("Rakip izleme: bu hafta 3 yeni reklam");
    expect(d.text).toContain("yalnızca Türkiye'de yayınlanan ticari reklamlar bu özette yer almaz");
    expect(d.html).toContain("kahve &lt;b&gt;");
  });
});

describe("weekly competitor check (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
  });

  it("checks each watch, saves the summary and sends one digest per user per week", async () => {
    const { MemoryRepo, MemoryAdminRepo } = await import("@/lib/data/memory-repo");
    const { runCompetitorCheck } = await import("@/lib/competitors/service");
    const { MemoryOutbox } = await import("@/lib/email/provider");
    const repo = new MemoryRepo();
    await repo.signUp({ email: "rakip@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    expect(await repo.addWatch("Kahve", "DE")).toBe("ok");
    expect(await repo.addWatch("kahve", "DE")).toBe("exists");
    for (let i = 0; i < 9; i++) await repo.addWatch(`terim ${i}`, "NL");
    expect(await repo.addWatch("fazla", "NL")).toBe("limit");
    const search = vi.fn(async () => ({ ok: true as const, ads: [ad("1", "2026-10-01"), ad("2", "2026-11-01")], after: null }));
    const library = { enabled: true, search } as unknown as import("@/lib/ads-library/meta").MetaAdLibrary;
    const outbox = new MemoryOutbox();
    const before = MemoryOutbox.messages().length;
    const admin = new MemoryAdminRepo();
    const r1 = await runCompetitorCheck(admin, library, outbox, "https://x", today);
    expect(r1).toMatchObject({ checked: 10, failed: 0, sent: 1 });
    const r2 = await runCompetitorCheck(admin, library, outbox, "https://x", today);
    expect(r2.sent).toBe(0);
    expect(MemoryOutbox.messages().length - before).toBe(1);
    const w = (await repo.listWatches()).find((x) => x.term === "Kahve")!;
    expect(w.lastSummary?.activeCount).toBe(2);
    expect(w.lastCheckedAt).not.toBeNull();
  });
});
