import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  EvalAdsSchema,
  EVAL_PHOTOS,
  analysisQuality,
  anthropicCostUsd,
  creditsForMargin,
  describeShape,
  fakeEndpoints,
  marginAt,
  missingKeys,
  netTlPerCredit,
  parseEvalArgs,
  percentile,
  pricesFromEnv,
  renderReport,
  usageNumbers,
  type EvalRecord,
} from "@/lib/eval/ai-eval";
import { readDimensions } from "@/lib/security/file-validation";

const ADS = JSON.parse(readFileSync("tests/fixtures/ai-eval/ads.json", "utf8"));

describe("ai-eval arguments and guards", () => {
  it("does nothing paid without --confirm and validates options", () => {
    const d = parseEvalArgs([]);
    expect(d.ok && d.args.confirm).toBe(false);
    expect(d.ok && d.args.kinds).toEqual(["analysis", "copy", "script", "gemini_image", "photoroom"]);
    const c = parseEvalArgs(["--confirm", "--only", "analysis,photoroom", "--limit=3", "--video"]);
    expect(c.ok && c.args).toMatchObject({ confirm: true, kinds: ["analysis", "photoroom"], limit: 3, video: true });
    expect(parseEvalArgs(["--only", "analysis,foo"]).ok).toBe(false);
    expect(parseEvalArgs(["--limit", "21"]).ok).toBe(false);
    expect(parseEvalArgs(["--out", "../x.md"]).ok).toBe(false);
    expect(parseEvalArgs(["--yes"]).ok).toBe(false);
  });

  it("names exactly the keys the chosen calls need, and spots fake endpoints", () => {
    const all = { kinds: ["analysis", "copy", "script", "gemini_image", "photoroom"] as const, video: false };
    expect(missingKeys({ ...all, kinds: [...all.kinds] }, {})).toEqual(["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "PHOTOROOM_API_KEY"]);
    expect(missingKeys({ kinds: ["analysis"], video: false }, { ANTHROPIC_API_KEY: "k" })).toEqual([]);
    expect(missingKeys({ kinds: ["analysis"], video: true }, { ANTHROPIC_API_KEY: "k", GEMINI_API_KEY: " " })).toEqual(["GEMINI_API_KEY"]);
    expect(fakeEndpoints({ GEMINI_API_BASE: "http://127.0.0.1:9" })).toEqual(["GEMINI_API_BASE"]);
    expect(fakeEndpoints({})).toEqual([]);
  });

  it("the script exits before any call when --confirm or a key is missing", () => {
    const env = { ...process.env, ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PHOTOROOM_API_KEY: "" };
    const run = (...a: string[]) => {
      try {
        return { code: 0, out: execFileSync("npx", ["tsx", "--conditions=react-server", "scripts/ai-eval.ts", ...a], { env, encoding: "utf8", stdio: "pipe" }) };
      } catch (e) {
        const err = e as { status: number; stdout: string; stderr: string };
        return { code: err.status, out: err.stdout + err.stderr };
      }
    };
    const dry = run();
    expect(dry.code).toBe(0);
    expect(dry.out).toContain("hiçbir API'yi çağırmadı");
    const noKey = run("--confirm");
    expect(noKey.code).toBe(1);
    expect(noKey.out).toContain("ANTHROPIC_API_KEY, GEMINI_API_KEY, PHOTOROOM_API_KEY ortamda tanımlı değil");
    // No ad text ever reaches the console.
    for (const ad of ADS) expect(dry.out + noKey.out).not.toContain(ad.primaryText);
  }, 60_000);
});

describe("ai-eval fixtures", () => {
  it("has 20 valid ads, both risky and safe ones, over the 5 product photos", () => {
    const ads = EvalAdsSchema.parse(ADS);
    expect(new Set(ads.map((a) => a.id)).size).toBe(20);
    expect(ads.filter((a) => a.expectRisk).length).toBeGreaterThanOrEqual(8);
    expect(ads.filter((a) => !a.expectRisk).length).toBeGreaterThanOrEqual(8);
    expect(new Set(ads.map((a) => a.photo))).toEqual(new Set(EVAL_PHOTOS));
    expect(new Set(ads.map((a) => a.sector)).size).toBeGreaterThanOrEqual(5);
  });

  it("product photos are real JPEG files the analysis accepts", () => {
    for (const name of EVAL_PHOTOS) {
      const bytes = new Uint8Array(readFileSync(`tests/fixtures/ai-eval/${name}.jpg`));
      expect(bytes[0]).toBe(0xff);
      expect(readDimensions(bytes, "image/jpeg")).toEqual({ width: 800, height: 800 });
      expect(bytes.byteLength).toBeLessThan(200_000);
    }
  });
});

describe("ai-eval cost and credit arithmetic", () => {
  it("prices Anthropic tokens by model, with an override", () => {
    const { prices, anthropicKnown } = pricesFromEnv("claude-opus-5-5", {});
    expect(anthropicKnown).toBe(true);
    expect(anthropicCostUsd(prices, 10_000, 5_000)).toBeCloseTo(0.04 + 0.1, 6);
    expect(pricesFromEnv("unknown-model", {}).anthropicKnown).toBe(false);
    expect(pricesFromEnv("unknown-model", { EVAL_ANTHROPIC_PRICE: "1,2" }).prices.anthropic).toEqual({ input: 1, output: 2 });
    expect(pricesFromEnv("claude-opus-5-5", { EVAL_USD_TRY: "50" }).prices.usdTry).toBe(50);
  });

  it("uses the cheapest package after VAT and payment fee as revenue per credit", () => {
    // 1490 TL / 400 credits = 3.725 TL; /1.2 VAT; -5% fee.
    expect(netTlPerCredit({ vatRate: 0.2, paymentFeeRate: 0.05 })).toBeCloseTo((3.725 / 1.2) * 0.95, 6);
  });

  it("suggests the smallest credit price that keeps at least 50% gross margin", () => {
    const net = 3;
    expect(creditsForMargin(0, net)).toBe(1);
    expect(creditsForMargin(1.5, net)).toBe(1); // exactly 50%
    expect(creditsForMargin(1.51, net)).toBe(2);
    expect(creditsForMargin(31.5, net)).toBe(21);
    for (const cost of [0.4, 2.2, 9.9, 31.5]) expect(marginAt(cost, creditsForMargin(cost, net), net)).toBeGreaterThanOrEqual(0.5);
    expect(percentile([5, 1, 3, 2, 4], 90)).toBe(5);
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
  });
});

describe("ai-eval report", () => {
  it("summarizes the Gemini response shape without copying content", () => {
    const secret = "Bu bir reklam metnidir ve rapora girmemeli";
    const lines = describeShape({
      id: "int_123",
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text: secret }, { type: "image", mime_type: "image/png", data: "A".repeat(5000) }] }],
      usage: { total_input_tokens: 12, total_output_tokens: 1290 },
    });
    expect(lines).toContain('steps[].content[].type = "image"');
    expect(lines).toContain('steps[].content[].mime_type = "image/png"');
    expect(lines).toContain("steps[].content[].data: metin (5 KB)");
    expect(lines.join("\n")).not.toContain(secret);
    expect(lines.join("\n")).not.toContain("int_123");
    expect(usageNumbers({ usage: { total_output_tokens: 1290, model: "x" } })).toEqual({ total_output_tokens: 1290 });
  });

  it("writes only ids, sectors and numbers", () => {
    const { prices } = pricesFromEnv("claude-opus-5-5", {});
    const rec = (o: Partial<EvalRecord>): EvalRecord => ({ adId: "ad-01", sector: "genel", kind: "analysis", ok: true, reason: null, ms: 12_300, inputTokens: 9000, outputTokens: 4000, requests: 1, schemaOk: true, red: 1, yellow: 0, costUsd: 0.116, flagged: true, expectRisk: true, aiProposed: 3, aiAccepted: 2, ...o });
    const records = [
      rec({}),
      rec({ adId: "ad-02", red: 0, flagged: false, expectRisk: false, aiProposed: 0, aiAccepted: 0 }),
      rec({ adId: "ad-01", kind: "photoroom", inputTokens: null, outputTokens: null, costUsd: 0.02, red: 0 }),
      rec({ adId: "ad-01", kind: "gemini_image", ok: false, reason: "rejected", schemaOk: false, inputTokens: null, outputTokens: null, costUsd: 0, red: 0 }),
    ];
    const md = renderReport({
      date: "2026-11-19",
      anthropicModel: "claude-opus-5-5",
      anthropicKnown: true,
      geminiModels: { image: "gemini-nano-banana-2.1", video: "gemini-omni-1.1-flash" },
      prices,
      records,
      currentCredits: { analysis: 1, photoroom: 1, gemini_image: 1 },
      shapes: [{ label: "Gemini görsel yanıtı", lines: ['steps[].type = "model_output"'], usage: { total_output_tokens: 1290 } }],
    });
    expect(md).toContain("| Analiz (yapay zekâ değerlendirmesi) | 2 | 2 | 2 |");
    expect(md).toContain("Riskli yazılmış 1 örneğin 1 tanesinde");
    expect(md).toContain("Model 3 bulgu önerdi; kural kimliği ve alıntı denetiminden 2 tanesi geçti.");
    expect(md).toContain("hata: rejected");
    expect(md).toContain("Ürün sahnesi (türetilen: 4 düzenleme çağrısı)");
    expect(md).toContain("Kullanım sayaçları: total_output_tokens=1290");
    // 0.116 $ * 45 = 5.22 TL against 2.95 TL per credit: needs 4 credits for 50%.
    expect(md).toMatch(/\| Analiz \(yapay zekâ değerlendirmesi\) \| 1 \| %-\d+ \| 4 \|/);
    for (const ad of ADS) {
      expect(md).not.toContain(ad.headline);
      expect(md).not.toContain(ad.primaryText);
    }
  });
});

describe("Gemini adapter observer", () => {
  it("passes each parsed response to onResponse and still returns the media", async () => {
    vi.stubEnv("APP_MODE", "demo");
    const PNG = readFileSync("tests/fixtures/tiny.png");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: PNG.toString("base64") }] }] }), { status: 200 }));
    const { GeminiProvider } = await import("@/lib/genai/gemini");
    const g = new GeminiProvider("k", "https://gemini.test", "m1", "m2");
    const seen: unknown[] = [];
    g.onResponse = (j) => seen.push(j);
    const r = await g.image({ prompt: "p", refs: [], aspect: "1:1" });
    expect(r.ok).toBe(true);
    expect(seen).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

describe("ai-eval quality counters", () => {
  it("counts caught risky ads and red flags on safe ads", () => {
    const r = (o: Partial<EvalRecord>): EvalRecord => ({ adId: "ad-01", sector: "genel", kind: "analysis", ok: true, reason: null, ms: 1, inputTokens: 1, outputTokens: 1, requests: 1, schemaOk: true, red: 0, yellow: 0, costUsd: 0, ...o });
    const q = analysisQuality([
      r({ expectRisk: true, flagged: true, red: 1 }),
      r({ expectRisk: true, flagged: false }),
      r({ expectRisk: false, flagged: true, red: 1 }),
      r({ expectRisk: false, flagged: false }),
      r({ expectRisk: true, flagged: true, ok: false }),
    ]);
    expect(q).toMatchObject({ riskyCaught: 1, risky: 2, safeWithRed: 1, safe: 2 });
  });
});
