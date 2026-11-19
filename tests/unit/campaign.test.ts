import { randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAMPAIGN_COPY_PART, CAMPAIGN_PACKAGE_CREDIT_COST, CAMPAIGN_PICK, CAMPAIGN_VARIANT_COUNT } from "@/lib/campaign/costs";
import { campaignCsvRows, checkVariant, defaultPicks, variantsFromCopy } from "@/lib/campaign/variants";
import { templateCopy } from "@/lib/copy/generate";
import { CREATIVE_CREDIT_COST } from "@/lib/creative/costs";
import type { RuleRecord } from "@/lib/engine/types";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

async function signedIn() {
  const { MemoryRepo } = await import("@/lib/data/memory-repo");
  const repo = new MemoryRepo();
  await repo.signUp({ email: "paket@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
  return repo;
}

async function rules(): Promise<RuleRecord[]> {
  const { MemoryRepo } = await import("@/lib/data/memory-repo");
  return new MemoryRepo().getRules("takviye_gida");
}

const TEXTS = Array.from({ length: CAMPAIGN_VARIANT_COUNT }, (_, i) => ({ headline: `Sabah kahvesi ${i + 1}`, primaryText: "Taze çekilmiş kahve, filtre için hazır.", cta: "Hemen incele" }));

describe("campaign package price", () => {
  it("is never below one copy run plus one creative set per picked text", async () => {
    const { COPY_CREDIT_COST } = await import("@/lib/copy/service");
    expect(CAMPAIGN_COPY_PART).toBeGreaterThanOrEqual(COPY_CREDIT_COST);
    expect(CAMPAIGN_PACKAGE_CREDIT_COST).toBeGreaterThanOrEqual(COPY_CREDIT_COST + CAMPAIGN_PICK * CREATIVE_CREDIT_COST);
    expect(CAMPAIGN_PICK).toBe(3);
  });
});

describe("campaign variants", () => {
  it("pairs template copy into up to ten checked ads", async () => {
    const r = await rules();
    const copy = templateCopy({ sector: "takviye_gida", platform: "meta", product: { name: "Vita Plus", summary: "Günlük vitamin desteği", points: [] }, brand: null, audience: null }, r);
    const v = variantsFromCopy(copy, "takviye_gida", r);
    expect(v.length).toBeGreaterThanOrEqual(CAMPAIGN_PICK);
    expect(v.length).toBeLessThanOrEqual(CAMPAIGN_VARIANT_COUNT);
    expect(v.map((x) => x.n)).toEqual(v.map((_, i) => i + 1));
    for (const x of v) expect(x.headline.length).toBeGreaterThan(0);
  });

  it("flags risky wording and offers a safe version; only verified cards can make it red", async () => {
    const r = await rules();
    const risky = checkVariant({ headline: "7 günde 5 kilo ver", primaryText: "Garantili sonuç, kesin zayıflama.", cta: "Hemen al" }, "takviye_gida", r);
    expect(risky.risk).not.toBe("ok");
    expect(risky.issues.length).toBeGreaterThan(0);
    expect(risky.safe).not.toBeNull();
    const activeTitles = new Set(r.filter((x) => x.status === "active").map((x) => x.title));
    if (risky.risk === "red") expect(risky.issues.some((t) => activeTitles.has(t))).toBe(true);
    expect(checkVariant({ headline: "Sabah kahvesi", primaryText: "Taze çekilmiş kahve.", cta: "İncele" }, "genel", r).risk).toBe("ok");
  });

  it("starts with the three least risky ads", () => {
    const v = [
      { risk: "red" as const, metaScore: 80 },
      { risk: "ok" as const, metaScore: 5 },
      { risk: "yellow" as const, metaScore: 30 },
      { risk: "ok" as const, metaScore: 5 },
      { risk: "ok" as const, metaScore: 0 },
    ];
    expect(defaultPicks(v, 3)).toEqual([1, 3, 4]);
  });

  it("CSV rows carry the disclaimer and protect against formulas through toCsv", async () => {
    const { toCsv } = await import("@/lib/export/csv");
    const rows = campaignCsvRows([{ n: 1, headline: "=HYPERLINK()", primaryText: "a", cta: "b", risk: "ok", metaScore: 0, metaLevel: "low", issues: [], safe: null, picked: true }], "Meta");
    const csv = toCsv(rows);
    expect(csv).toContain("'=HYPERLINK()");
    expect(csv).toContain("hukuki görüş değildir");
    expect(rows).toHaveLength(2);
  });
});

describe("campaign package export (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
  });

  const input = (requestId: string) => ({ requestId, brandId: null, platform: "meta" as const, sector: "genel" as const, layout: "manset" as const, productName: "Çınar Kahve", variants: TEXTS, picked: [0, 2, 4] });

  it("writes PNGs in four sizes, the CSV and the PDF into one ZIP and charges once per request", async () => {
    const { exportCampaignPackage } = await import("@/lib/campaign/service");
    const repo = await signedIn();
    // The signup gift is 3 credits and the package costs more, so a demo package is bought first.
    expect((await repo.applyDemoPurchase("baslangic", randomUUID())).applied).toBe(true);
    const before = await repo.getBalance();
    expect(before).toBeGreaterThanOrEqual(CAMPAIGN_PACKAGE_CREDIT_COST);
    const id = randomUUID();
    const a = await exportCampaignPackage(repo, input(id));
    const b = await exportCampaignPackage(repo, input(id));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.charged).toBe(CAMPAIGN_PACKAGE_CREDIT_COST);
    expect(b.charged).toBe(0);
    expect(b.generation.id).toBe(a.generation.id);
    expect(await repo.getBalance()).toBe(before - CAMPAIGN_PACKAGE_CREDIT_COST);
    const files = a.generation.output.files as { path: string }[];
    const zip = unzipSync((await repo.readGenerationFile(a.generation.id, files[0].path))!.bytes);
    const names = Object.keys(zip).sort();
    expect(names.filter((n) => n.endsWith(".png"))).toHaveLength(CAMPAIGN_PICK * 4);
    expect(names).toContain("gorseller/metin-1-1080x1920.png");
    expect(names).toContain("varyantlar.csv");
    expect(names).toContain("kontrol-raporu.pdf");
    const csv = new TextDecoder().decode(zip["varyantlar.csv"]);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(TEXTS.length + 1);
    expect(new TextDecoder().decode(zip["kontrol-raporu.pdf"].subarray(0, 5))).toBe("%PDF-");
    expect(await repo.listGenerations("campaign")).toHaveLength(1);
  });

  it("is free when it fails: too few credits, wrong picks or an unknown brand store and charge nothing", async () => {
    const { exportCampaignPackage } = await import("@/lib/campaign/service");
    const repo = await signedIn();
    const before = await repo.getBalance();
    expect(before).toBeLessThan(CAMPAIGN_PACKAGE_CREDIT_COST);
    expect((await exportCampaignPackage(repo, input(randomUUID()))).ok).toBe(false);
    expect((await exportCampaignPackage(repo, { ...input(randomUUID()), picked: [0, 0, 1] })).ok).toBe(false);
    expect((await exportCampaignPackage(repo, { ...input(randomUUID()), brandId: randomUUID() })).ok).toBe(false);
    expect(await repo.getBalance()).toBe(before);
    expect(await repo.listGenerations("campaign")).toHaveLength(0);
  });
});
