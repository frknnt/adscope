/**
 * Quality and cost measurement with the real providers (P8.1).
 *
 *   npm run ai:eval                      -> shows the plan and the price estimate, calls nothing
 *   npm run ai:eval -- --confirm         -> runs every call once with the real APIs (costs money)
 *
 * Options: --only analysis,copy,script,gemini_image,photoroom,tts   --limit 1..20   --concurrency 1..4
 *          --video (one extra Gemini video, about 0.7 $)   --out docs/OLCUM.md
 *
 * For each of the 20 Turkish sample ads in tests/fixtures/ai-eval it runs the AI analysis, the
 * copy generation, a video script, one Gemini image around the product photo and one Photoroom
 * background removal and one Turkish voice-over line (Gemini TTS), then writes duration, tokens or requests, schema validation, the rule
 * engine's red/yellow flags and the estimated TL cost to docs/OLCUM.md.
 *
 * Refuses to run without --confirm, when a needed key is missing, or when an endpoint override
 * points at a fake server: a measurement with fake data is worse than none. Ad text, prompts and
 * responses are never printed or written; the console and the report carry ids and numbers only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { AnthropicProvider } from "../src/lib/ai/anthropic";
import type { AiRunMeta } from "../src/lib/ai/provider";
import { CREDIT_COST } from "../src/lib/analysis/cost";
import { processAiCopy, type CopyContext } from "../src/lib/copy/generate";
import { COPY_LIMITS } from "../src/lib/copy/limits";
import { COPY_CREDIT_COST } from "../src/lib/copy/service";
import { runPipeline } from "../src/lib/engine/pipeline";
import type { AdInput, RuleRecord } from "../src/lib/engine/types";
import {
  EvalAdsSchema,
  KIND_LABEL,
  anthropicCostUsd,
  describeShape,
  fakeEndpoints,
  missingKeys,
  netTlPerCredit,
  parseEvalArgs,
  pricesFromEnv,
  renderReport,
  usageNumbers,
  type EvalAd,
  type EvalKind,
  type EvalRecord,
  type ReportInput,
} from "../src/lib/eval/ai-eval";
import { GENAI_OPS } from "../src/lib/genai/costs";
import { geminiFromEnv, type GeminiProvider } from "../src/lib/genai/gemini";
import { imagePrompt, videoPrompt } from "../src/lib/genai/prompt";
import { IMAGE_OPS } from "../src/lib/image/costs";
import { photoroomFromEnv, type PhotoroomProvider } from "../src/lib/image/photoroom";
import { ruleAppliesTo } from "../src/lib/platforms";
import { RULE_CATALOG } from "../src/lib/rules/catalog";
import { processAiScript, type ScriptContext } from "../src/lib/script/generate";
import { SCRIPT_CREDIT_COST } from "../src/lib/script/service";
import { readDimensions } from "../src/lib/security/file-validation";
import { VOICEOVER_CREDIT_COST } from "../src/lib/speech/costs";
import { geminiTtsFromEnv, type GeminiTtsProvider } from "../src/lib/speech/gemini-tts";

const FIXTURES = "tests/fixtures/ai-eval";
const HELP = `Kullanım: npm run ai:eval -- [--confirm] [--only analysis,copy,script,gemini_image,photoroom,tts] [--limit N] [--concurrency N] [--video] [--out docs/OLCUM.md]`;

const money = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parsed = parseEvalArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  console.error(HELP);
  process.exit(2);
}
const args = parsed.args;
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const { prices, anthropicKnown } = pricesFromEnv(model, process.env);
const ads = EvalAdsSchema.parse(JSON.parse(readFileSync(`${FIXTURES}/ads.json`, "utf8"))).slice(0, args.limit);
const geminiPerAd = args.kinds.includes("gemini_image") ? prices.geminiImageUsd : 0;
const photoroomPerAd = args.kinds.includes("photoroom") ? prices.photoroomSegmentUsd : 0;
// Upper bound for one line of at most 300 characters read in about 25 seconds.
const ttsPerAd = args.kinds.includes("tts") ? (25 * 25 * prices.ttsAudioUsdPerMTok + 100 * prices.ttsInputUsdPerMTok) / 1e6 : 0;
const videoUsd = args.video ? 10 * prices.geminiVideoUsdPerSec : 0;
const textCalls = args.kinds.filter((k) => k === "analysis" || k === "copy" || k === "script").length;

console.log(`Plan: ${ads.length} örnek reklam, çağrılar: ${args.kinds.map((k) => KIND_LABEL[k]).join(", ")}${args.video ? ", 1 video" : ""}.`);
console.log(`Toplam ${ads.length * args.kinds.length + (args.video ? 1 : 0)} ücretli çağrı. Gemini ve Photoroom için tahmini üst sınır ${money((geminiPerAd + photoroomPerAd + ttsPerAd) * ads.length + videoUsd)} $; ${textCalls ? `Anthropic (${model}) token sayısına bağlı, kabaca çağrı başına 0,05-0,25 $.` : ""}`);
console.log(`Kredi başına net gelir varsayımı: ${money(netTlPerCredit(prices))} TL.`);

if (!args.confirm) {
  console.log("\nBu çalıştırma hiçbir API'yi çağırmadı. Gerçek ölçüm ücret doğurur; başlatmak için --confirm ekle.");
  process.exit(0);
}
const missing = missingKeys(args, process.env);
if (missing.length) {
  console.error(`\nDurdu: ${missing.join(", ")} ortamda tanımlı değil. Sahte veriyle ölçüm yapılmaz.`);
  process.exit(1);
}
const fake = fakeEndpoints(process.env);
if (fake.length) {
  console.error(`\nDurdu: ${fake.join(", ")} tanımlı; bu değişkenler sahte test sunucusu içindir. Gerçek ölçüm için kaldır.`);
  process.exit(1);
}
if (textCalls && !anthropicKnown) {
  console.error(`\nDurdu: ${model} için fiyat bilinmiyor. EVAL_ANTHROPIC_PRICE="girdi,çıktı" ($ / 1M token) ile ver.`);
  process.exit(1);
}

const anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY, model);
const gemini: GeminiProvider | null = geminiFromEnv();
const photoroom: PhotoroomProvider | null = photoroomFromEnv();
const tts: GeminiTtsProvider | null = geminiTtsFromEnv();
const allRules: RuleRecord[] = RULE_CATALOG.filter((r) => r.status === "active" || r.status === "requires_review").map((r) => ({ ...r, versionId: `eval-${r.id}-v${r.version}` }));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const NO_FLAGS = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };

const photos = new Map<string, { bytes: Uint8Array; base64: string; width: number; height: number }>();
function photo(name: string) {
  let p = photos.get(name);
  if (!p) {
    const bytes = new Uint8Array(readFileSync(`${FIXTURES}/${name}.jpg`));
    const dim = readDimensions(bytes, "image/jpeg");
    if (!dim) throw new Error(`Örnek fotoğraf okunamadı: ${name}`);
    p = { bytes, base64: Buffer.from(bytes).toString("base64"), ...dim };
    photos.set(name, p);
  }
  return p;
}

const rulesFor = (ad: EvalAd) => allRules.filter((r) => (r.sector === "genel" || r.sector === ad.sector) && ruleAppliesTo(r, ad.platform));
const avoidOf = (rules: RuleRecord[]) => rules.filter((r) => r.status === "active").flatMap((r) => r.riskyExamples);

function base(ad: EvalAd, kind: EvalKind): EvalRecord {
  return { adId: ad.id, sector: ad.sector, kind, ok: false, reason: null, ms: 0, inputTokens: null, outputTokens: null, requests: 1, schemaOk: null, red: 0, yellow: 0, costUsd: 0 };
}

async function runAnalysis(ad: EvalAd): Promise<EvalRecord> {
  const rec = base(ad, "analysis");
  const p = photo(ad.photo);
  const input: AdInput = {
    sector: ad.sector,
    platform: ad.platform,
    headline: ad.headline,
    primaryText: ad.primaryText,
    description: ad.description,
    flags: NO_FLAGS,
    image: { mime: "image/jpeg", width: p.width, height: p.height, sizeBytes: p.bytes.byteLength },
    today,
  };
  const started = Date.now();
  const out = await runPipeline({ input, rules: rulesFor(ad), ai: anthropic, images: [{ base64: p.base64, mime: "image/jpeg" }] });
  rec.ms = Date.now() - started;
  const ai = out.ai;
  rec.ok = Boolean(ai?.ok);
  rec.reason = ai && !ai.ok ? ai.reason : null;
  rec.schemaOk = !ai ? null : ai.ok ? true : ai.reason === "schema_invalid" ? false : null;
  rec.inputTokens = ai?.meta.inputTokens ?? null;
  rec.outputTokens = ai?.meta.outputTokens ?? null;
  rec.costUsd = anthropicCostUsd(prices, rec.inputTokens ?? 0, rec.outputTokens ?? 0);
  const findings = out.result.findings.filter((f) => f.domain !== "creative_quality");
  rec.red = findings.filter((f) => f.severity === "red").length;
  rec.yellow = findings.filter((f) => f.severity === "yellow").length;
  rec.flagged = rec.red + rec.yellow > 0;
  rec.expectRisk = ad.expectRisk;
  rec.aiProposed = ai?.ok ? ai.data.findings.length : 0;
  rec.aiAccepted = out.result.findings.filter((f) => f.origin === "ai").length;
  return rec;
}

async function runCopy(ad: EvalAd): Promise<EvalRecord> {
  const rec = base(ad, "copy");
  const rules = rulesFor(ad);
  const ctx: CopyContext = { sector: ad.sector, platform: ad.platform, product: { name: ad.productName, summary: ad.summary, points: [] }, brand: null, audience: null };
  const started = Date.now();
  const res = await anthropic.generateCopy({ platform: ad.platform, sector: ad.sector, limits: COPY_LIMITS[ad.platform], product: { ...ctx.product, pageText: "" }, brand: null, audience: null, avoid: avoidOf(rules) });
  rec.ms = Date.now() - started;
  const meta: AiRunMeta = res.meta;
  rec.inputTokens = meta.inputTokens ?? null;
  rec.outputTokens = meta.outputTokens ?? null;
  rec.costUsd = anthropicCostUsd(prices, rec.inputTokens ?? 0, rec.outputTokens ?? 0);
  rec.ok = res.ok;
  rec.reason = res.ok ? null : res.reason;
  rec.schemaOk = res.ok ? true : res.reason === "schema_invalid" ? false : null;
  if (res.ok) {
    const copy = processAiCopy(res.data, ctx, rules);
    const lines = [...copy.headlines, ...copy.primaryTexts, ...copy.descriptions, ...copy.ctas];
    rec.red = lines.filter((l) => l.risk === "red").length;
    rec.yellow = lines.filter((l) => l.risk === "yellow").length;
  }
  return rec;
}

async function runScript(ad: EvalAd): Promise<EvalRecord> {
  const rec = base(ad, "script");
  const rules = rulesFor(ad);
  const ctx: ScriptContext = { sector: ad.sector, platform: ad.platform, duration: ad.duration, product: { name: ad.productName, summary: ad.summary }, brand: null, audience: null, aiPersonOrVoice: false };
  const started = Date.now();
  const res = await anthropic.generateScript({ platform: ad.platform, sector: ad.sector, duration: ad.duration, product: ctx.product, brand: null, audience: null, aiPersonOrVoice: false, avoid: avoidOf(rules) });
  rec.ms = Date.now() - started;
  const meta: AiRunMeta = res.meta;
  rec.inputTokens = meta.inputTokens ?? null;
  rec.outputTokens = meta.outputTokens ?? null;
  rec.costUsd = anthropicCostUsd(prices, rec.inputTokens ?? 0, rec.outputTokens ?? 0);
  rec.ok = res.ok;
  rec.reason = res.ok ? null : res.reason;
  rec.schemaOk = res.ok ? true : res.reason === "schema_invalid" ? false : null;
  if (res.ok) {
    const script = processAiScript(res.data, ctx, rules);
    rec.red = script.scenes.filter((s) => s.check.risk === "red").length;
    rec.yellow = script.scenes.filter((s) => s.check.risk === "yellow" || s.testimonialRemoved).length;
  }
  return rec;
}

const shapes: ReportInput["shapes"] = [];
function observeGemini(label: string) {
  if (!gemini) return;
  gemini.onResponse = (json) => {
    // Keep the first response of each kind only: its structure, never its content.
    if (!shapes.some((s) => s.label === label)) shapes.push({ label, lines: describeShape(json), usage: usageNumbers(json) });
  };
}

async function runGeminiImage(ad: EvalAd): Promise<EvalRecord> {
  const rec = base(ad, "gemini_image");
  const p = photo(ad.photo);
  observeGemini("Gemini görsel yanıtı");
  const started = Date.now();
  const res = await gemini!.image({ prompt: imagePrompt(ad.scene, true, 0), refs: [{ bytes: p.bytes, mime: "image/jpeg" }], aspect: "1:1" });
  rec.ms = Date.now() - started;
  rec.ok = res.ok;
  rec.reason = res.ok ? null : res.reason;
  rec.schemaOk = res.ok;
  // Counted as billed only when an image comes back (to be checked against the invoice).
  rec.costUsd = res.ok ? prices.geminiImageUsd : 0;
  return rec;
}

async function runPhotoroom(ad: EvalAd): Promise<EvalRecord> {
  const rec = base(ad, "photoroom");
  const p = photo(ad.photo);
  const started = Date.now();
  const res = await photoroom!.removeBackground({ bytes: p.bytes, mime: "image/jpeg", width: p.width, height: p.height });
  rec.ms = Date.now() - started;
  rec.ok = res.ok;
  rec.reason = res.ok ? null : res.reason;
  rec.schemaOk = res.ok;
  rec.costUsd = res.ok ? prices.photoroomSegmentUsd : 0;
  return rec;
}

async function runTts(ad: EvalAd): Promise<EvalRecord> {
  const rec = base(ad, "tts");
  if (tts)
    tts.onResponse = (json) => {
      if (!shapes.some((s) => s.label === "Gemini ses yanıtı")) shapes.push({ label: "Gemini ses yanıtı", lines: describeShape(json), usage: usageNumbers(json) });
    };
  // The ad's own text stands in for a voice-over line; only its length and the audio length are kept.
  const text = ad.primaryText.replace(/\s+/g, " ").trim().slice(0, 300);
  const started = Date.now();
  const res = await tts!.synthesize({ text, voice: "Kore", speed: "normal" });
  rec.ms = Date.now() - started;
  rec.ok = res.ok;
  rec.reason = res.ok ? null : res.reason;
  rec.schemaOk = res.ok;
  if (res.ok) {
    rec.inputTokens = Math.ceil(text.length / 4);
    rec.outputTokens = Math.round(res.durationSec * 25);
    rec.costUsd = (rec.inputTokens * prices.ttsInputUsdPerMTok + rec.outputTokens * prices.ttsAudioUsdPerMTok) / 1e6;
  }
  return rec;
}

const RUNNERS: Record<Exclude<EvalKind, "gemini_video">, (ad: EvalAd) => Promise<EvalRecord>> = {
  analysis: runAnalysis,
  copy: runCopy,
  script: runScript,
  gemini_image: runGeminiImage,
  photoroom: runPhotoroom,
  tts: runTts,
};

async function safely(ad: EvalAd, kind: EvalKind, fn: () => Promise<EvalRecord>): Promise<EvalRecord> {
  const started = Date.now();
  try {
    return await fn();
  } catch (error) {
    // Only the error class: messages may echo request content.
    return { ...base(ad, kind), ms: Date.now() - started, reason: `exception:${(error as Error)?.name ?? "Error"}` };
  }
}

async function main() {
  const records: EvalRecord[] = [];
  let next = 0;
  async function worker() {
    while (next < ads.length) {
      const ad = ads[next++];
      for (const kind of args.kinds) {
        const r = await safely(ad, kind, () => RUNNERS[kind as keyof typeof RUNNERS](ad));
        records.push(r);
        console.log(`[${ad.id}] ${KIND_LABEL[kind]}: ${r.ok ? "tamam" : `hata (${r.reason})`}, ${(r.ms / 1000).toFixed(1)} sn`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.concurrency, ads.length) }, worker));

  let videoSeconds: number | undefined;
  if (args.video && gemini) {
    const ad = ads[0];
    observeGemini("Gemini video yanıtı");
    const r = await safely(ad, "gemini_video", async () => {
      const rec = base(ad, "gemini_video");
      const p = photo(ad.photo);
      const started = Date.now();
      const res = await gemini.video({ prompt: videoPrompt(ad.scene, true), start: { bytes: p.bytes, mime: "image/jpeg" }, aspect: "9:16" });
      rec.ms = Date.now() - started;
      rec.ok = res.ok;
      rec.reason = res.ok ? null : res.reason;
      rec.schemaOk = res.ok;
      // The model is asked for under 10 s; bill the upper bound until the real length is read.
      rec.costUsd = res.ok ? 10 * prices.geminiVideoUsdPerSec : 0;
      return rec;
    });
    records.push(r);
    if (r.ok) videoSeconds = 10;
    console.log(`[${ad.id}] ${KIND_LABEL.gemini_video}: ${r.ok ? "tamam" : `hata (${r.reason})`}, ${(r.ms / 1000).toFixed(1)} sn`);
  }

  records.sort((a, b) => a.adId.localeCompare(b.adId) || a.kind.localeCompare(b.kind));
  const report = renderReport({
    date: today,
    anthropicModel: model,
    anthropicKnown,
    geminiModels: gemini ? { image: gemini.imageModel, video: gemini.videoModel, tts: tts?.model } : null,
    prices,
    records,
    currentCredits: {
      analysis: CREDIT_COST.image,
      copy: COPY_CREDIT_COST,
      script: SCRIPT_CREDIT_COST,
      gemini_image: GENAI_OPS.ai_image.creditsPerResult,
      photoroom: IMAGE_OPS.remove_background.credits,
      tts: VOICEOVER_CREDIT_COST,
      gemini_video: GENAI_OPS.ai_video.creditsPerResult,
    },
    shapes,
    videoSeconds,
  });
  writeFileSync(args.out, report);
  const failed = records.filter((r) => !r.ok).length;
  console.log(`\n${args.out} yazıldı: ${records.length} çağrı, ${failed} hata.`);
}

main().catch((error) => {
  console.error(`Ölçüm durdu: ${(error as Error)?.name ?? "Error"}`);
  process.exit(1);
});
