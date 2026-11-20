import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pcmToWav, readWav, trimWav } from "@/lib/speech/wav";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** A 24 kHz mono tone of the given length, as the provider returns it. */
function tone(seconds: number, rate = 24_000) {
  const pcm = new Uint8Array(Math.round(seconds * rate) * 2);
  const v = new DataView(pcm.buffer);
  for (let i = 0; i < pcm.length / 2; i++) v.setInt16(i * 2, Math.round(Math.sin(i / 8) * 8000), true);
  return pcm;
}

describe("WAV helpers", () => {
  it("wraps PCM, reads the header back and trims with a fade-out", () => {
    const wav = pcmToWav(tone(8), 24_000);
    expect(readWav(wav)).toMatchObject({ sampleRate: 24_000, channels: 1, bitsPerSample: 16, durationSec: 8 });
    const cut = trimWav(wav, 5)!;
    expect(readWav(cut)!.durationSec).toBe(5);
    const v = new DataView(cut.buffer);
    expect(v.getInt16(cut.length - 2, true)).toBe(0);
    expect(readWav(trimWav(pcmToWav(tone(2), 24_000), 5)!)!.durationSec).toBe(2);
  });

  it("rejects anything that is not 16-bit PCM", () => {
    expect(readWav(new Uint8Array(100))).toBeNull();
    const wav = pcmToWav(tone(1), 24_000);
    const float = wav.slice();
    new DataView(float.buffer).setUint16(20, 3, true);
    expect(readWav(float)).toBeNull();
  });
});

describe("Gemini TTS adapter", () => {
  it("sends only the line, a prebuilt voice and a style note; reads WAV or raw PCM back", async () => {
    const { GeminiTtsProvider, findAudio } = await import("@/lib/speech/gemini-tts");
    const calls: { url: string; init: RequestInit }[] = [];
    let answer: Uint8Array = pcmToWav(tone(2), 24_000);
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ steps: [{ type: "thought" }, { type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: Buffer.from(answer).toString("base64") }] }] }), { status: 200 });
    });
    const g = new GeminiTtsProvider("k-1", "https://gemini.test", "gemini-3.8-flash-tts");
    const r = await g.synthesize({ text: "Yeni sezon setleri sitede.", voice: "Kore", speed: "hizli" });
    expect(r).toMatchObject({ ok: true, durationSec: 2 });
    expect(calls[0].url).toBe("https://gemini.test/v1beta/interactions");
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k-1");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toEqual({
      model: "gemini-3.8-flash-tts",
      input: [{ type: "user_input", content: [{ type: "text", text: "Yeni sezon setleri sitede.", annotations: [{ type: "speech_metadata", style: expect.stringContaining("brisk") }] }] }],
      response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24_000 },
      generation_config: { speech_config: [{ voice: "Kore" }] },
    });
    // Headerless PCM from older models is wrapped.
    answer = tone(1.5);
    const raw = await g.synthesize({ text: "Merhaba", voice: "Puck", speed: "normal" });
    expect(raw.ok && readWav(raw.wav)?.durationSec).toBe(1.5);
    expect(findAudio({ output_audio: { data: "AA" } })?.data).toBe("AA");
    expect(findAudio({ steps: [] })).toBeNull();
  });

  it("maps provider errors and missing audio without charging anything", async () => {
    const { GeminiTtsProvider } = await import("@/lib/speech/gemini-tts");
    const g = new GeminiTtsProvider("k", "https://gemini.test", "m");
    for (const [status, reason] of [[429, "rate_limited"], [400, "rejected"], [500, "unavailable"]] as const) {
      vi.stubGlobal("fetch", async () => new Response("{}", { status }));
      expect(await g.synthesize({ text: "a", voice: "Kore", speed: "normal" })).toEqual({ ok: false, reason });
    }
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: "no" }] }] }), { status: 200 }));
    expect(await g.synthesize({ text: "a", voice: "Kore", speed: "normal" })).toEqual({ ok: false, reason: "rejected" });
  });

  it("is off without a key and never points at a test server in production", async () => {
    const { geminiTtsFromEnv } = await import("@/lib/speech/gemini-tts");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(geminiTtsFromEnv()).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_API_BASE", "http://127.0.0.1:9");
    vi.stubEnv("APP_MODE", "production");
    const p = geminiTtsFromEnv()!;
    expect(p.model).toBe("gemini-3.8-flash-tts");
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => (seen.push(String(url)), new Response("{}", { status: 500 })));
    await p.synthesize({ text: "a", voice: "Kore", speed: "normal" });
    expect(seen[0]).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    vi.stubEnv("TTS_DISABLED", "true");
    expect(geminiTtsFromEnv()).toBeNull();
  });
});

describe("voice-over service (memory backend)", () => {
  async function setup() {
    const { MemoryRepo, MemoryAdminRepo, __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jar.clear();
    const repo = new MemoryRepo();
    const r = await repo.signUp({ email: `ses-${Math.random()}@ornek.com`, password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    if (!r.ok || !r.userId) throw new Error("signup failed");
    await new MemoryAdminRepo().adminAdjustCredits({ adminId: r.userId, userId: r.userId, delta: 5, reason: "test", requestId: randomUUID() });
    const { runScriptGeneration } = await import("@/lib/script/service");
    const s = await runScriptGeneration(repo, { requestId: randomUUID(), productName: "Bitki çayı", description: "Akşam için hafif karışım", brandId: null, platform: "meta", sector: "genel", duration: 15, audience: null, aiPersonOrVoice: false });
    if (!s.ok) throw new Error(s.error);
    return { repo, scriptId: s.generation.id, scenes: s.stored.script.scenes };
  }
  function fake(results: ("ok" | "fail")[] = ["ok"], seconds = 2) {
    let i = 0;
    const texts: string[] = [];
    return {
      texts,
      provider: {
        name: "Sahte",
        model: "sahte-tts",
        synthesize: async (p: { text: string }) => {
          texts.push(p.text);
          return results[i++ % results.length] === "ok" ? { ok: true as const, wav: pcmToWav(tone(seconds), 24_000), durationSec: seconds } : { ok: false as const, reason: "unavailable" as const };
        },
      },
    };
  }

  it("voices every scene for one credit, stores WAV files for 90 days and is idempotent per request", async () => {
    const { repo, scriptId, scenes } = await setup();
    const { runVoiceover } = await import("@/lib/speech/voiceover");
    const start = await repo.getBalance();
    const f = fake(["ok"], 6);
    const lines = scenes.map((s, index) => ({ index, text: s.voiceover })).filter((l) => l.text);
    const id = randomUUID();
    const r = await runVoiceover(repo, f.provider as never, { requestId: id, scriptId, lines, voice: "Sulafat", speed: "normal" });
    if (!r.ok) throw new Error(r.error);
    expect(r.charged).toBe(1);
    expect(await repo.getBalance()).toBe(start - 1);
    const out = r.generation.output as { files: { mime: string; path: string }[]; scenes: { seconds: number; overrun: boolean; start: number }[]; synthetic: boolean; notice: string };
    expect(r.generation.kind).toBe("voiceover");
    expect(out.files).toHaveLength(lines.length);
    expect(out.files.every((x) => x.mime === "audio/wav")).toBe(true);
    expect(out.synthetic).toBe(true);
    expect(out.notice).toContain("yapay zekâ ile üretilmiştir");
    // A 6-second reading does not fit a 3-second scene.
    expect(out.scenes[0]).toMatchObject({ seconds: 6, overrun: true, start: 0 });
    const file = await repo.readGenerationFile(r.generation.id, out.files[0].path);
    expect(file && readWav(file.bytes)?.durationSec).toBe(6);
    // Nothing about the user reaches the provider: only the lines themselves.
    expect(f.texts).toEqual(lines.map((l) => l.text));
    expect(f.texts.join(" ")).not.toContain("@ornek.com");

    expect(await runVoiceover(repo, fake().provider as never, { requestId: id, scriptId, lines, voice: "Sulafat", speed: "normal" })).toMatchObject({ ok: true, charged: 0 });
    expect(await repo.getBalance()).toBe(start - 1);

    // After 90 days the record and its audio are gone.
    vi.useFakeTimers({ now: Date.now() + 91 * 864e5, toFake: ["Date"] });
    try {
      const { MemoryAdminRepo } = await import("@/lib/data/memory-repo");
      await new MemoryAdminRepo().purgeExpired();
      expect(await repo.getGeneration(r.generation.id)).toBeNull();
      expect(await repo.readGenerationFile(r.generation.id, out.files[0].path)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("charges nothing when a line fails and keeps no files", async () => {
    const { repo, scriptId, scenes } = await setup();
    const { runVoiceover } = await import("@/lib/speech/voiceover");
    const start = await repo.getBalance();
    const lines = scenes.map((s, index) => ({ index, text: s.voiceover })).filter((l) => l.text);
    const r = await runVoiceover(repo, fake(["ok", "fail"]).provider as never, { requestId: randomUUID(), scriptId, lines, voice: "Kore", speed: "normal" });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("kredin düşmedi");
    expect(await repo.getBalance()).toBe(start);
    expect(await repo.listGenerations("voiceover")).toHaveLength(0);
  });

  it("asks to fix a high-risk line first and never sends it to the provider", async () => {
    const { repo, scriptId } = await setup();
    const { runVoiceover, previewVoice } = await import("@/lib/speech/voiceover");
    const start = await repo.getBalance();
    const f = fake();
    const risky = "Bu çay kanseri tedavi eder, garantili sonuç.";
    const r = await runVoiceover(repo, f.provider as never, { requestId: randomUUID(), scriptId, lines: [{ index: 0, text: risky }], voice: "Kore", speed: "normal" });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("1. sahne");
    expect(await previewVoice(repo, f.provider as never, { scriptId, text: risky, voice: "Kore", speed: "normal" })).toMatchObject({ ok: false });
    expect(f.texts).toEqual([]);
    expect(await repo.getBalance()).toBe(start);
  });

  it("previews five seconds for free and stores nothing", async () => {
    const { repo, scriptId } = await setup();
    const { previewVoice } = await import("@/lib/speech/voiceover");
    const start = await repo.getBalance();
    const f = fake(["ok"], 9);
    const long = "Bitki çayı akşamları sakin bir mola için hazırlandı ve içinde papatya, ıhlamur, melisa ile biraz da limon kabuğu var; ayrıntılar sayfada.";
    const r = await previewVoice(repo, f.provider as never, { scriptId, text: long, voice: "Charon", speed: "yavas" });
    expect(r.ok && readWav(r.wav)?.durationSec).toBe(5);
    expect(f.texts[0].split(" ").length).toBeLessThanOrEqual(14);
    expect(await repo.getBalance()).toBe(start);
    expect(await repo.listGenerations("voiceover")).toHaveLength(0);
  });

  it("refuses another user's script and an empty balance", async () => {
    const { repo, scriptId, scenes } = await setup();
    const { runVoiceover } = await import("@/lib/speech/voiceover");
    const lines = [{ index: 0, text: scenes[0].voiceover }];
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    jar.clear();
    const other = new MemoryRepo();
    await other.signUp({ email: "baska@ornek.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    expect(await runVoiceover(other, fake().provider as never, { requestId: randomUUID(), scriptId, lines, voice: "Kore", speed: "normal" })).toEqual({ ok: false, error: "Senaryo bulunamadı." });
    // The other user has the 3 sign-up credits; spend them, then the voice-over is refused before any call.
    for (let i = 0; i < 3; i++) await other.recordGeneration({ clientRequestId: randomUUID(), kind: "copy", creditCost: 1, brandId: null, platform: null, output: {} });
    const { runScriptGeneration } = await import("@/lib/script/service");
    const s = await runScriptGeneration(other, { requestId: randomUUID(), productName: "Çay", description: "Hafif", brandId: null, platform: "meta", sector: "genel", duration: 15, audience: null, aiPersonOrVoice: false });
    if (!s.ok) throw new Error(s.error);
    const f = fake();
    expect(await runVoiceover(other, f.provider as never, { requestId: randomUUID(), scriptId: s.generation.id, lines, voice: "Kore", speed: "normal" })).toMatchObject({ ok: false, error: expect.stringContaining("1 kredi") });
    expect(f.texts).toEqual([]);
    void repo;
  });
});
