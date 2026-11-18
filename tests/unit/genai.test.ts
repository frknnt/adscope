import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

const PNG = readFileSync("tests/fixtures/tiny.png");
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42"), Buffer.alloc(40, 1)]);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("APP_MODE", "demo");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gemini adapter", () => {
  it("reads media from the REST steps shape and the SDK-like shape", async () => {
    const { findMedia } = await import("@/lib/genai/gemini");
    expect(findMedia({ steps: [{ type: "thought", content: [{ type: "image", data: "x" }] }, { type: "model_output", content: [{ type: "text" }, { type: "image", data: "AAA" }] }] }, "image")?.data).toBe("AAA");
    expect(findMedia({ output_video: { uri: "https://g/v1beta/files/1" } }, "video")?.uri).toBe("https://g/v1beta/files/1");
    expect(findMedia({ steps: [] }, "image")).toBeNull();
  });

  it("sends the key in a header, the product photo as inline data and asks for one image at 1K", async () => {
    const { GeminiProvider } = await import("@/lib/genai/gemini");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: PNG.toString("base64") }] }] }), { status: 200 });
    });
    const g = new GeminiProvider("k-123", "https://gemini.test", "gemini-nano-banana-2.1", "gemini-omni-1.1-flash");
    const r = await g.image({ prompt: "p", refs: [{ bytes: new Uint8Array(PNG), mime: "image/png" }], aspect: "4:5" });
    expect(r).toMatchObject({ ok: true, mime: "image/png" });
    expect(calls[0].url).toBe("https://gemini.test/v1beta/interactions");
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k-123");
    expect(calls[0].url).not.toContain("k-123");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ model: "gemini-nano-banana-2.1", response_format: { type: "image", aspect_ratio: "4:5", image_size: "1K" } });
    expect(body.input[0]).toMatchObject({ type: "image", mime_type: "image/png" });
    expect(body.input[1]).toEqual({ type: "text", text: "p" });
  });

  it("downloads a video URI only from the API's own host and checks the bytes are MP4", async () => {
    const { GeminiProvider } = await import("@/lib/genai/gemini");
    const seen: string[] = [];
    let uri = "https://gemini.test/v1beta/files/abc:download";
    vi.stubGlobal("fetch", async (url: URL | string) => {
      seen.push(String(url));
      if (String(url).endsWith("/interactions")) return new Response(JSON.stringify({ output_video: { uri } }), { status: 200 });
      return new Response(MP4, { status: 200 });
    });
    const g = new GeminiProvider("k", "https://gemini.test", "i", "v");
    expect(await g.video({ prompt: "p", start: null, aspect: "9:16" })).toMatchObject({ ok: true, mime: "video/mp4" });
    expect(seen[1]).toBe("https://gemini.test/v1beta/files/abc:download?alt=media");
    uri = "https://evil.example/steal";
    seen.length = 0;
    expect(await g.video({ prompt: "p", start: null, aspect: "9:16" })).toEqual({ ok: false, reason: "unavailable" });
    expect(seen).toHaveLength(1);
  });

  it("maps 429 to rate_limited, safety blocks (no media) to rejected and wrong bytes to unavailable", async () => {
    const { GeminiProvider } = await import("@/lib/genai/gemini");
    const g = new GeminiProvider("k", "https://gemini.test", "i", "v");
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 429 }));
    expect(await g.image({ prompt: "p", refs: [], aspect: "1:1" })).toEqual({ ok: false, reason: "rate_limited" });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: "blocked" }] }] }), { status: 200 }));
    expect(await g.image({ prompt: "p", refs: [], aspect: "1:1" })).toEqual({ ok: false, reason: "rejected" });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ output_image: { data: MP4.toString("base64") } }), { status: 200 }));
    expect(await g.image({ prompt: "p", refs: [], aspect: "1:1" })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("is off without a key; the endpoint override is ignored in production", async () => {
    const { geminiFromEnv } = await import("@/lib/genai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(geminiFromEnv()).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "x");
    vi.stubEnv("GEMINI_API_BASE", "http://127.0.0.1:1");
    vi.stubEnv("APP_MODE", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://p.supabase.co");
    const g = geminiFromEnv();
    expect(g?.imageModel).toBe("gemini-nano-banana-2.1");
    expect(g?.videoModel).toBe("gemini-omni-1.1-flash");
    expect((g as unknown as { base: string }).base).toBe("https://generativelanguage.googleapis.com");
  });
});

describe("prompts", () => {
  it("cleans contact details and keeps the fixed safety rules in front of the advertiser's words", async () => {
    const { imagePrompt, videoPrompt, cleanDescription } = await import("@/lib/genai/prompt");
    expect(cleanDescription("Ara 0532 123 45 67, ali@ornek.com, https://x.com <b>şişe</b>")).toBe("Ara , b şişe b");
    const p = imagePrompt("Mermer tezgâhta şişe", true, 1);
    expect(p).toContain("keep the product exactly as it is");
    expect(p).toContain('"Mermer tezgâhta şişe"');
    expect(p).toContain("Do not add any text");
    expect(p).toContain("Variation 2");
    expect(videoPrompt("yavaş yakınlaşma", false)).toContain("no voice-over");
  });
});

describe("runGenaiJob (memory backend)", () => {
  async function setup() {
    const { MemoryRepo, __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jar.clear();
    const repo = new MemoryRepo();
    const r = await repo.signUp({ email: `g-${Math.random()}@ornek.com`, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    if (!r.ok || !r.userId) throw new Error("signup failed");
    const { MemoryAdminRepo } = await import("@/lib/data/memory-repo");
    await new MemoryAdminRepo().adminAdjustCredits({ adminId: r.userId, userId: r.userId, delta: 20, reason: "test", requestId: crypto.randomUUID() });
    return repo;
  }
  function fakeProvider(results: ("ok" | "fail")[]) {
    let i = 0;
    return {
      name: "Google Gemini",
      imageModel: "img",
      videoModel: "vid",
      image: async () => (results[i++ % results.length] === "ok" ? { ok: true as const, bytes: new Uint8Array(PNG), mime: "image/png" as const } : { ok: false as const, reason: "rejected" as const }),
      video: async () => (results[0] === "ok" ? { ok: true as const, bytes: new Uint8Array(MP4), mime: "video/mp4" as const } : { ok: false as const, reason: "unavailable" as const }),
    };
  }

  it("charges one credit per delivered image, nothing on failure, and once per request id", async () => {
    const repo = await setup();
    const { runGenaiJob } = await import("@/lib/genai/service");
    const start = await repo.getBalance();
    const id = crypto.randomUUID();
    const job = { op: "ai_image" as const, description: "Mermer tezgâhta şişe", aspect: "1:1" as const, count: 4 };
    const r = await runGenaiJob(repo, fakeProvider(["ok", "fail", "ok", "ok"]) as never, { requestId: id, job, reference: null });
    if (!r.ok) throw new Error(r.error);
    expect(r).toMatchObject({ ok: true, charged: 3, partial: true });
    expect(await repo.getBalance()).toBe(start - 3);
    expect(await runGenaiJob(repo, fakeProvider(["ok"]) as never, { requestId: id, job, reference: null })).toMatchObject({ ok: true, charged: 0 });
    expect(await runGenaiJob(repo, fakeProvider(["fail"]) as never, { requestId: crypto.randomUUID(), job, reference: null })).toMatchObject({ ok: false });
    expect(await repo.getBalance()).toBe(start - 3);
  });

  it("stores a video as MP4 for 8 credits and refuses without enough credit", async () => {
    const repo = await setup();
    const { runGenaiJob } = await import("@/lib/genai/service");
    const start = await repo.getBalance();
    const job = { op: "ai_video" as const, description: "Kamera ürüne yaklaşıyor", aspect: "9:16" as const };
    const r = await runGenaiJob(repo, fakeProvider(["ok"]) as never, { requestId: crypto.randomUUID(), job, reference: { bytes: new Uint8Array(PNG), mime: "image/png" } });
    expect(r).toMatchObject({ ok: true, charged: 8 });
    if (r.ok) expect((r.generation.output.files as { mime: string }[])[0].mime).toBe("video/mp4");
    expect(await repo.getBalance()).toBe(start - 8);
    for (let i = 0; i < 2; i++) await runGenaiJob(repo, fakeProvider(["ok"]) as never, { requestId: crypto.randomUUID(), job, reference: null });
    expect(await runGenaiJob(repo, fakeProvider(["ok"]) as never, { requestId: crypto.randomUUID(), job, reference: null })).toMatchObject({ ok: false, error: "Bu işlem 8 kredi. Krediler sayfasından paket alabilirsin." });
  });

  it("rejects a reference file that is not really an image", async () => {
    const repo = await setup();
    const { runGenaiJob } = await import("@/lib/genai/service");
    const r = await runGenaiJob(repo, fakeProvider(["ok"]) as never, { requestId: crypto.randomUUID(), job: { op: "ai_image", description: "Mermer tezgâhta şişe", aspect: "1:1", count: 1 }, reference: { bytes: new Uint8Array(MP4), mime: "image/png" } });
    expect(r.ok).toBe(false);
  });
});
