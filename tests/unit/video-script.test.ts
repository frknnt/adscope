import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRules } from "@/lib/data/memory-repo";
import { ruleAppliesTo } from "@/lib/platforms";
import { looksLikeTestimonial, processAiScript, templateScript, timeScenes, toSrt, type ScriptContext } from "@/lib/script/generate";
import { AiScriptSchema } from "@/lib/script/schema";
import { buildTimeline, layersAt, MAX_SECONDS, MIN_SECONDS, openingTexts, SAFE_BOTTOM, SAFE_TOP, slideAt, VIDEO_W, type VideoSpec } from "@/lib/video-maker/timeline";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

const fakeAi = { generateScript: vi.fn() };
vi.mock("@/lib/analysis/service", () => ({ getAiProvider: () => (fakeAi.generateScript.getMockImplementation() ? fakeAi : null) }));

const spec = (over: Partial<VideoSpec> = {}): VideoSpec => ({
  imageCount: 3,
  durationSec: 10,
  brand: "Çınar Kozmetik",
  offer: "Yeni sezon nemlendirici",
  captions: ["Hafif doku", "Günlük bakım", ""],
  cta: "Hemen incele",
  transition: "yakinlas",
  ...over,
});

describe("video maker timeline", () => {
  it("clamps the length to 6–15 seconds and keeps slides contiguous", () => {
    expect(buildTimeline(spec({ durationSec: 2 })).duration).toBe(MIN_SECONDS);
    expect(buildTimeline(spec({ durationSec: 40 })).duration).toBe(MAX_SECONDS);
    for (const n of [1, 3, 5]) {
      const tl = buildTimeline(spec({ imageCount: n }));
      expect(tl.slides).toHaveLength(n);
      expect(tl.slides[0].start).toBe(0);
      tl.slides.forEach((s, i) => i && expect(s.start).toBe(tl.slides[i - 1].end));
      expect(tl.slides.at(-1)!.end).toBe(tl.duration - tl.endCard);
    }
  });

  it("shows the brand and the offer within the first 3 seconds and keeps every text inside the 9:16 safe area", () => {
    for (const d of [6, 10, 15]) {
      for (const n of [1, 2, 5]) {
        const tl = buildTimeline(spec({ durationSec: d, imageCount: n, captions: Array(n).fill("Altyazı satırı") }));
        const open = openingTexts(tl);
        expect(open.brand && open.offer, `${d}/${n}`).toBe(true);
        const offer = tl.layers.find((l) => l.role === "offer")!;
        expect(offer.end - offer.start).toBeGreaterThanOrEqual(3);
        for (const l of tl.layers) {
          expect(l.box.y, l.role).toBeGreaterThanOrEqual(SAFE_TOP);
          expect(l.box.y + l.box.h, l.role).toBeLessThanOrEqual(SAFE_BOTTOM);
          expect(l.box.x + l.box.w).toBeLessThanOrEqual(VIDEO_W);
          expect(l.end).toBeLessThanOrEqual(tl.duration);
        }
      }
    }
  });

  it("puts the call to action on a closing card and fades layers in and out", () => {
    const tl = buildTimeline(spec());
    expect(tl.endCard).toBeGreaterThan(0);
    const end = layersAt(tl, tl.duration - 0.5).map((x) => x.layer.role);
    expect(end).toEqual(expect.arrayContaining(["cta", "endBrand"]));
    expect(end).not.toContain("caption");
    // The very first frame already shows the opening texts; later layers fade in.
    expect(layersAt(tl, 0).find((x) => x.layer.role === "offer")!.alpha).toBe(1);
    const second = tl.layers.filter((l) => l.role === "caption")[1];
    const fading = layersAt(tl, second.start + 0.1).find((x) => x.layer === second)!;
    expect(fading.alpha).toBeGreaterThan(0);
    expect(fading.alpha).toBeLessThan(1);
    expect(buildTimeline(spec({ cta: "" })).endCard).toBe(0);
    const s = slideAt(tl, 0.1)!;
    expect(s.current.index).toBe(0);
    expect(s.progress).toBeGreaterThanOrEqual(0);
  });

  it("reports a missing offer in the opening seconds", () => {
    expect(openingTexts(buildTimeline(spec({ offer: "" }))).offer).toBe(false);
  });
});

describe("generated video review", () => {
  it("writes a hook note and runs the on-screen text through the rule cards", async () => {
    const { MemoryRepo, __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    const { reviewGeneratedVideo } = await import("@/lib/video-maker/review");
    const repo = new MemoryRepo();
    const strong = await reviewGeneratedVideo(repo, { spec: spec(), mime: "video/mp4", sizeBytes: 900_000, sector: "genel", platform: "meta" });
    expect(strong.hookStrong).toBe(true);
    expect(strong.hookNote).toContain("İlk 3 saniye");
    expect(strong.scores.length).toBeGreaterThan(0);
    const weak = await reviewGeneratedVideo(repo, { spec: spec({ offer: "", brand: "" }), mime: "video/webm", sizeBytes: 900_000, sector: "genel", platform: "meta" });
    expect(weak.hookStrong).toBe(false);
    const risky = await reviewGeneratedVideo(repo, { spec: spec({ offer: "Kesin sonuç garantili, 7 günde 10 kilo ver" }), mime: "video/mp4", sizeBytes: 900_000, sector: "takviye_gida", platform: "meta" });
    expect(risky.issues.length).toBeGreaterThan(0);
  });
});

const rules = catalogRules().filter((r) => (r.sector === "genel" || r.sector === "takviye_gida") && ruleAppliesTo(r, "meta"));
const sctx = (over: Partial<ScriptContext> = {}): ScriptContext => ({
  sector: "takviye_gida",
  platform: "meta",
  duration: 15,
  product: { name: "Bitki çayı", summary: "Akşamları içmek için hafif bir bitki karışımı" },
  brand: { name: "Çınar", bannedWords: ["ucuz"], preferredCta: "Sayfayı incele", tagline: "Doğadan" },
  audience: { name: "Yoğun çalışanlar", need: "Akşam sakinleşmek istiyor musun" },
  aiPersonOrVoice: false,
  ...over,
});

describe("video script", () => {
  it("times scenes to the exact total in half seconds", () => {
    for (const total of [15, 30, 45]) {
      const t = timeScenes([3, 5, 9, 2, 4], total);
      expect(t[0].start).toBe(0);
      expect(t.at(-1)!.end).toBe(total);
      t.forEach((x, i) => {
        expect(x.end).toBeGreaterThan(x.start);
        expect((x.end * 2) % 1).toBe(0);
        if (i) expect(x.start).toBe(t[i - 1].end);
      });
    }
  });

  it("builds 15, 30 and 45 second template scripts that open with the product within 3 seconds", () => {
    const counts = [15, 30, 45].map((d) => {
      const s = templateScript(sctx({ duration: d as 15 | 30 | 45 }), rules);
      expect(s.source).toBe("template");
      expect(s.scenes.at(-1)!.end).toBe(d);
      expect(s.scenes[0].end).toBeLessThanOrEqual(3.5);
      expect(s.scenes[0].onScreen).toContain("Bitki çayı");
      expect(s.scenes.at(-1)!.onScreen).toBe("Sayfayı incele");
      expect(s.warnings.some((w) => w.startsWith("Yapay zekâ ile üretildiğini belirt"))).toBe(false);
      return s.scenes.length;
    });
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
  });

  it("puts the AI disclosure first when an AI person or voice is used", () => {
    const s = templateScript(sctx({ aiPersonOrVoice: true }), rules);
    expect(s.warnings[0]).toMatch(/^Yapay zekâ ile üretildiğini belirt/);
    expect(s.warnings[0]).toContain("Meta");
  });

  it("removes testimonial-like lines, strips banned words and checks every line", () => {
    expect(looksLikeTestimonial("Ayşe Hanım diyor ki harika")).toBe(true);
    expect(looksLikeTestimonial("Müşteri yorumu: çok memnunum")).toBe(true);
    expect(looksLikeTestimonial("Akşamları hafif bir çay")).toBe(false);
    const raw = AiScriptSchema.parse({
      scenes: [
        { seconds: 3, visual: "Çay bardağı yakın çekim", on_screen_text: "Bitki çayı", voiceover: "Akşamın hafif eşlikçisi." },
        { seconds: 5, visual: "Mutfakta bir an", on_screen_text: "Ucuz ve lezzetli", voiceover: "Kullandım ve şikayetim kalmadı." },
        { seconds: 7, visual: "Paket ve etiket", on_screen_text: "Kesin zayıflatır", voiceover: "Bu çay hastalıkları tedavi eder." },
      ],
    });
    const s = processAiScript(raw, sctx(), rules);
    expect(s.source).toBe("ai");
    expect(s.scenes.at(-1)!.end).toBe(15);
    expect(s.scenes[1].testimonialRemoved).toBe(true);
    expect(s.scenes[1].voiceover).toBe("");
    expect(s.scenes[1].onScreen.toLocaleLowerCase("tr-TR")).not.toContain("ucuz");
    expect(s.scenes[2].check.risk).not.toBe("ok");
    expect(s.warnings.some((w) => w.includes("müşteri yorumu"))).toBe(true);
  });

  it("exports SRT subtitles and skips empty scenes", () => {
    const srt = toSrt([
      { start: 0, end: 3, voiceover: "Merhaba", onScreen: "A" },
      { start: 3, end: 7.5, voiceover: "", onScreen: "B" },
      { start: 7.5, end: 65.25, voiceover: "Hoşça kal", onScreen: "" },
    ]);
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:03,000\nMerhaba\n\n2\n00:00:07,500 --> 00:01:05,250\nHoşça kal\n");
    expect(toSrt([{ start: 3, end: 7.5, voiceover: "", onScreen: "B" }], "onScreen")).toContain("00:00:03,000 --> 00:00:07,500\nB");
  });
});

describe("script credits (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
    fakeAi.generateScript.mockReset();
  });
  async function signedIn() {
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const repo = new MemoryRepo();
    await repo.signUp({ email: "senaryo@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    return repo;
  }
  const req = (requestId = randomUUID()) => ({ requestId, productName: "Bitki çayı", description: "Akşam için hafif karışım", brandId: null, platform: "meta" as const, sector: "genel" as const, duration: 30 as const, audience: null, aiPersonOrVoice: true });
  const aiOut = { scenes: [{ seconds: 3, visual: "Yakın çekim", on_screen_text: "Bitki çayı", voiceover: "Akşamın çayı." }, { seconds: 20, visual: "Paket", on_screen_text: "Sayfada", voiceover: "Ayrıntılar sayfada." }] };

  it("is free without AI and charges one credit once per request with AI", async () => {
    const { runScriptGeneration } = await import("@/lib/script/service");
    const repo = await signedIn();
    const before = await repo.getBalance();
    const t = await runScriptGeneration(repo, req());
    expect(t.ok && t.stored.script.source === "template" && t.stored.script.warnings[0].startsWith("Yapay zekâ")).toBe(true);
    expect(await repo.getBalance()).toBe(before);

    fakeAi.generateScript.mockResolvedValue({ ok: true, data: AiScriptSchema.parse(aiOut), meta: {} });
    const id = randomUUID();
    const a = await runScriptGeneration(repo, req(id));
    const b = await runScriptGeneration(repo, req(id));
    expect(a.ok && b.ok && a.generation.id === b.generation.id && a.generation.kind === "script").toBe(true);
    expect(await repo.getBalance()).toBe(before - 1);
    expect(fakeAi.generateScript).toHaveBeenCalledTimes(1);
    if (a.ok) expect(a.stored.script.scenes.at(-1)!.end).toBe(30);
  });

  it("falls back to the free template when the AI fails", async () => {
    fakeAi.generateScript.mockResolvedValue({ ok: false, reason: "api_error", meta: {} });
    const { runScriptGeneration } = await import("@/lib/script/service");
    const repo = await signedIn();
    const before = await repo.getBalance();
    const r = await runScriptGeneration(repo, req());
    expect(r.ok && r.stored.aiFailed && r.stored.script.source === "template").toBe(true);
    expect(await repo.getBalance()).toBe(before);
  });
});
