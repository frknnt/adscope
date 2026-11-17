import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkLine, processAiCopy, templateCopy, type CopyContext } from "@/lib/copy/generate";
import { fitTo } from "@/lib/copy/limits";
import { AiCopySchema } from "@/lib/copy/schema";
import { sensitiveHits } from "@/lib/audience/sensitive";
import { catalogRules } from "@/lib/data/memory-repo";
import { ruleAppliesTo } from "@/lib/platforms";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

const fakeAi = { generateCopy: vi.fn() };
vi.mock("@/lib/analysis/service", () => ({ getAiProvider: () => (fakeAi.generateCopy.getMockImplementation() ? fakeAi : null) }));

const rules = catalogRules().filter((r) => (r.sector === "genel" || r.sector === "takviye_gida") && ruleAppliesTo(r, "meta"));
const ctx = (over: Partial<CopyContext> = {}): CopyContext => ({
  sector: "takviye_gida",
  platform: "meta",
  product: { name: "Bitki çayı", summary: "Akşamları içmek için hafif bir bitki karışımı", points: ["Doğal içerik"] },
  brand: { name: "Çınar", tone: "samimi", bannedWords: ["ucuz"], requiredPhrases: [], preferredCta: null, tagline: null, audienceNote: null },
  audience: null,
  ...over,
});

const aiOut = {
  headlines: [
    { text: "7 günde 5 kilo verdiren mucize çay", framework: "fayda" },
    { text: "Akşamların yeni eşlikçisi", framework: "merak" },
    { text: "Akşamların yeni eşlikçisi", framework: "aida" },
    { text: "En ucuz bitki çayı burada, hemen dene ve farkı hisset bugün", framework: "dogrudan" },
  ],
  primary_texts: [{ text: "Akşam rutinine hafif bir bitki karışımı ekle.", framework: "fayda" }],
  descriptions: [{ text: "İçerik listesi ürün sayfasında", framework: "dogrudan" }],
  ctas: ["Ürünü incele"],
} as const;

describe("generated copy checks", () => {
  it("cuts at a word boundary within the platform limit", () => {
    expect(fitTo("Akşamların yeni eşlikçisi olan bitki çayı", 20)).toEqual({ text: "Akşamların yeni", trimmed: true });
    expect(fitTo("Kısa", 20)).toEqual({ text: "Kısa", trimmed: false });
  });

  it("removes banned words, flags risky lines and offers a safe version", () => {
    const risky = checkLine("7 günde 5 kilo verdiren mucize çay", "headline", "fayda", ctx(), rules)!;
    expect(risky.risk).not.toBe("ok");
    expect(risky.issues.length).toBeGreaterThan(0);
    if (risky.safe) expect(checkLine(risky.safe, "headline", null, ctx(), rules)!.risk).toBe("ok");
    const banned = checkLine("En ucuz bitki çayı", "headline", null, ctx(), rules)!;
    expect(banned.text.toLocaleLowerCase("tr-TR")).not.toContain("ucuz");
  });

  it("validates the model output and drops duplicates", () => {
    expect(AiCopySchema.safeParse({ ...aiOut, headlines: [{ text: "x", framework: "uydurma" }] }).success).toBe(false);
    const out = processAiCopy(AiCopySchema.parse(aiOut), ctx(), rules);
    expect(out.headlines.filter((h) => h.text === "Akşamların yeni eşlikçisi")).toHaveLength(1);
    for (const h of out.headlines) expect([...h.text].length).toBeLessThanOrEqual(40);
  });

  it("template copy fills every group, stays within limits and appends mandatory phrases", () => {
    const c = ctx({ brand: { ...ctx().brand!, requiredPhrases: ["Stoklarla sınırlıdır."] } });
    const out = templateCopy(c, rules);
    expect(out.source).toBe("template");
    expect(out.headlines.length).toBeGreaterThanOrEqual(8);
    expect(out.primaryTexts.length).toBeGreaterThanOrEqual(5);
    expect(out.descriptions.length).toBeGreaterThanOrEqual(3);
    expect(out.ctas).toHaveLength(3);
    for (const p of out.primaryTexts) expect(p.text).toContain("Stoklarla sınırlıdır.");
    for (const h of out.headlines) expect(h.risk).toBe("ok");
  });

  it("spots sensitive audience descriptions without flagging ordinary ones", () => {
    expect(sensitiveHits("Kilolu kadınlar").map((h) => h.id)).toEqual(["health"]);
    expect(sensitiveHits("Borçlu gençler").map((h) => h.id)).toEqual(["finance"]);
    expect(sensitiveHits("Roman okumayı sevenler", "transfer arayanlar", "hastane çalışanları")).toEqual([]);
  });
});

describe("copy generation credits (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
    fakeAi.generateCopy.mockReset();
  });

  async function signedIn() {
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const repo = new MemoryRepo();
    await repo.signUp({ email: "copy@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    return repo;
  }
  const req = (requestId = randomUUID()) => ({ requestId, url: null, productName: "Bitki çayı", description: "Akşam için hafif karışım", brandId: null, platform: "meta" as const, sector: "genel" as const, audience: null });

  it("charges one credit for AI copy, once per request id", async () => {
    fakeAi.generateCopy.mockResolvedValue({ ok: true, data: AiCopySchema.parse(aiOut), meta: {} });
    const repo = await signedIn();
    const { runCopyGeneration } = await import("@/lib/copy/service");
    const before = await repo.getBalance();
    const id = randomUUID();
    const a = await runCopyGeneration(repo, req(id));
    const b = await runCopyGeneration(repo, req(id));
    expect(a.ok && b.ok && a.generation.id === b.generation.id).toBe(true);
    expect(await repo.getBalance()).toBe(before - 1);
    expect(fakeAi.generateCopy).toHaveBeenCalledTimes(1);
  });

  it("falls back to free templates when the AI fails, and refuses without credit", async () => {
    fakeAi.generateCopy.mockResolvedValue({ ok: false, reason: "api_error", meta: {} });
    const repo = await signedIn();
    const { runCopyGeneration } = await import("@/lib/copy/service");
    const before = await repo.getBalance();
    const r = await runCopyGeneration(repo, req());
    expect(r.ok && (r.stored.copy.source === "template" && r.stored.aiFailed)).toBe(true);
    expect(await repo.getBalance()).toBe(before);

    fakeAi.generateCopy.mockResolvedValue({ ok: true, data: AiCopySchema.parse(aiOut), meta: {} });
    for (let i = 0; i < before; i++) await runCopyGeneration(repo, req());
    expect(await repo.getBalance()).toBe(0);
    const none = await runCopyGeneration(repo, req());
    expect(none.ok).toBe(false);
  });
});
