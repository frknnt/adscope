/**
 * Pure helpers of the paid quality and cost measurement (scripts/ai-eval.ts, P8.1): arguments,
 * fixture schema, price assumptions, cost and credit arithmetic, response shape summary and the
 * docs/OLCUM.md table. Nothing here calls a provider, and nothing here keeps ad text: the report
 * only carries fixture ids, sectors and numbers.
 */
import { z } from "zod";
import { CREDIT_PACKAGES } from "@/lib/payments/packages";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";

export const EVAL_KINDS = ["analysis", "copy", "script", "gemini_image", "photoroom"] as const;
export type EvalKind = (typeof EVAL_KINDS)[number] | "gemini_video";

export const KIND_LABEL: Record<EvalKind, string> = {
  analysis: "Analiz (yapay zekâ değerlendirmesi)",
  copy: "Metin üretimi",
  script: "Video senaryosu",
  gemini_image: "Gemini görsel (1 adet)",
  photoroom: "Photoroom arka plan kaldırma",
  gemini_video: "Gemini video (1 adet, isteğe bağlı)",
};

/** Environment keys each kind needs. */
export const KIND_KEYS: Record<EvalKind, string> = {
  analysis: "ANTHROPIC_API_KEY",
  copy: "ANTHROPIC_API_KEY",
  script: "ANTHROPIC_API_KEY",
  gemini_image: "GEMINI_API_KEY",
  photoroom: "PHOTOROOM_API_KEY",
  gemini_video: "GEMINI_API_KEY",
};

/** Endpoint overrides that point the adapters at a fake server. A real measurement refuses them. */
export const FAKE_ENDPOINT_VARS = ["ANTHROPIC_BASE_URL", "GEMINI_API_BASE", "PHOTOROOM_SDK_URL", "PHOTOROOM_IMAGE_API_URL"] as const;

export interface EvalArgs {
  confirm: boolean;
  kinds: EvalKind[];
  limit: number;
  concurrency: number;
  video: boolean;
  out: string;
  help: boolean;
}

export function parseEvalArgs(argv: string[]): { ok: true; args: EvalArgs } | { ok: false; error: string } {
  const args: EvalArgs = { confirm: false, kinds: [...EVAL_KINDS], limit: 20, concurrency: 2, video: false, out: "docs/OLCUM.md", help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    const value = () => inline ?? argv[++i];
    if (flag === "--confirm") args.confirm = true;
    else if (flag === "--video") args.video = true;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else if (flag === "--only") {
      const list = (value() ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const bad = list.filter((k) => !(EVAL_KINDS as readonly string[]).includes(k));
      if (!list.length || bad.length) return { ok: false, error: `--only yalnızca şunları alır: ${EVAL_KINDS.join(", ")}` };
      args.kinds = list as EvalKind[];
    } else if (flag === "--limit") {
      const n = Number(value());
      if (!Number.isInteger(n) || n < 1 || n > 20) return { ok: false, error: "--limit 1 ile 20 arasında bir tam sayı olmalı." };
      args.limit = n;
    } else if (flag === "--concurrency") {
      const n = Number(value());
      if (!Number.isInteger(n) || n < 1 || n > 4) return { ok: false, error: "--concurrency 1 ile 4 arasında bir tam sayı olmalı." };
      args.concurrency = n;
    } else if (flag === "--out") {
      const p = value() ?? "";
      if (!/^[\w./-]+\.md$/.test(p) || p.includes("..")) return { ok: false, error: "--out depo içinde bir .md dosyası olmalı." };
      args.out = p;
    } else return { ok: false, error: `Bilinmeyen seçenek: ${a}` };
  }
  return { ok: true, args };
}

export function requiredKeys(args: Pick<EvalArgs, "kinds" | "video">): string[] {
  const kinds: EvalKind[] = [...args.kinds, ...(args.video ? (["gemini_video"] as const) : [])];
  return [...new Set(kinds.map((k) => KIND_KEYS[k]))];
}

export function missingKeys(args: Pick<EvalArgs, "kinds" | "video">, env: Record<string, string | undefined>): string[] {
  return requiredKeys(args).filter((k) => !env[k]?.trim());
}

export function fakeEndpoints(env: Record<string, string | undefined>): string[] {
  return FAKE_ENDPOINT_VARS.filter((k) => env[k]?.trim());
}

/* ------------------------------------------------------------------------------------------ */
/* Fixtures                                                                                    */

export const EVAL_PHOTOS = ["kupa", "ayakkabi", "bal", "krem", "cuzdan"] as const;

export const EvalAdSchema = z.object({
  id: z.string().regex(/^ad-\d{2}$/),
  sector: z.enum(SECTOR_IDS),
  platform: z.enum(PLATFORM_IDS),
  photo: z.enum(EVAL_PHOTOS),
  productName: z.string().min(2).max(80),
  summary: z.string().min(5).max(400),
  headline: z.string().min(2).max(120),
  primaryText: z.string().min(10).max(600),
  description: z.string().max(60),
  /** Scene asked from the image model around the product photo. */
  scene: z.string().min(5).max(200),
  duration: z.union([z.literal(15), z.literal(30), z.literal(45)]),
  /** The ad was written to contain risky wording; a good analysis flags it. */
  expectRisk: z.boolean(),
});
export type EvalAd = z.infer<typeof EvalAdSchema>;
export const EvalAdsSchema = z.array(EvalAdSchema).length(20);

/* ------------------------------------------------------------------------------------------ */
/* Prices (assumptions until the provider invoice confirms them)                               */

export interface Prices {
  usdTry: number;
  /** Anthropic list price, USD per million tokens. */
  anthropic: { input: number; output: number };
  geminiImageUsd: number;
  geminiVideoUsdPerSec: number;
  photoroomSegmentUsd: number;
  /** Photoroom Image Editing calls (new background, upscale) bill as this many segment calls. */
  photoroomEditMultiplier: number;
  vatRate: number;
  paymentFeeRate: number;
}

/** Anthropic list prices (USD / 1M tokens, cached 03.11.2026); thinking tokens bill as output. */
export const ANTHROPIC_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? n : d;
};

/**
 * Defaults are the same assumptions the credit tables were set with (45 TL/$, 0.034 $ per Gemini
 * image, 0.07 $ per video second); Photoroom 0.02 $ per Remove Background call and a 5% payment fee
 * are assumptions to confirm. Every value can be overridden with an EVAL_* variable.
 */
export function pricesFromEnv(model: string, env: Record<string, string | undefined>): { prices: Prices; anthropicKnown: boolean } {
  const known = ANTHROPIC_PRICES[model];
  const [inp, out] = (env.EVAL_ANTHROPIC_PRICE ?? "").split(",").map(Number);
  const override = Number.isFinite(inp) && Number.isFinite(out) && inp > 0 && out > 0 ? { input: inp, output: out } : null;
  return {
    anthropicKnown: Boolean(override || known),
    prices: {
      usdTry: num(env.EVAL_USD_TRY, 45),
      anthropic: override ?? known ?? { input: 0, output: 0 },
      geminiImageUsd: num(env.EVAL_GEMINI_IMAGE_USD, 0.034),
      geminiVideoUsdPerSec: num(env.EVAL_GEMINI_VIDEO_USD_PER_SEC, 0.07),
      photoroomSegmentUsd: num(env.EVAL_PHOTOROOM_SEGMENT_USD, 0.02),
      photoroomEditMultiplier: num(env.EVAL_PHOTOROOM_EDIT_MULTIPLIER, 5),
      vatRate: num(env.EVAL_VAT_RATE, 0.2),
      paymentFeeRate: num(env.EVAL_PAYMENT_FEE, 0.05),
    },
  };
}

export function anthropicCostUsd(p: Prices, inputTokens: number, outputTokens: number): number {
  return (inputTokens * p.anthropic.input + outputTokens * p.anthropic.output) / 1_000_000;
}

/**
 * What one credit brings in after VAT and the payment fee, using the cheapest package (the
 * worst case for margin). Coupons and free welcome credits are not counted.
 */
export function netTlPerCredit(p: Pick<Prices, "vatRate" | "paymentFeeRate">): number {
  const cheapest = Math.min(...CREDIT_PACKAGES.map((k) => k.priceMinor / 100 / k.credits));
  return (cheapest / (1 + p.vatRate)) * (1 - p.paymentFeeRate);
}

/** Smallest whole credit price that leaves at least `minMargin` gross margin on a job costing `costTl`. */
export function creditsForMargin(costTl: number, netPerCredit: number, minMargin = 0.5): number {
  if (!(costTl > 0)) return 1;
  return Math.max(1, Math.ceil(costTl / (netPerCredit * (1 - minMargin)) - 1e-9));
}

export function marginAt(costTl: number, credits: number, netPerCredit: number): number {
  const revenue = credits * netPerCredit;
  return revenue > 0 ? (revenue - costTl) / revenue : 0;
}

/* ------------------------------------------------------------------------------------------ */
/* Results                                                                                     */

export interface EvalRecord {
  adId: string;
  sector: string;
  kind: EvalKind;
  ok: boolean;
  /** Failure reason code from the adapter (never a message or a response body). */
  reason: string | null;
  ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
  requests: number;
  /** Passed our Zod schema (text kinds), or returned a valid media file (media kinds). */
  schemaOk: boolean | null;
  red: number;
  yellow: number;
  costUsd: number;
  /** Analysis only: did the result carry at least one red/yellow flag, and did the fixture expect one. */
  flagged?: boolean;
  expectRisk?: boolean;
  /** Analysis only: findings the model proposed, and how many survived our checks. */
  aiProposed?: number;
  aiAccepted?: number;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export interface KindSummary {
  kind: EvalKind;
  calls: number;
  ok: number;
  schemaOk: number;
  p50Ms: number;
  p95Ms: number;
  avgIn: number | null;
  avgOut: number | null;
  avgTl: number;
  p90Tl: number;
  maxTl: number;
  red: number;
  yellow: number;
}

export function summarize(records: EvalRecord[], prices: Pick<Prices, "usdTry">): KindSummary[] {
  const order: EvalKind[] = [...EVAL_KINDS, "gemini_video"];
  const kinds = order.filter((k) => records.some((r) => r.kind === k));
  return kinds.map((kind) => {
    const rs = records.filter((r) => r.kind === kind);
    const tl = rs.map((r) => r.costUsd * prices.usdTry);
    const withTokens = rs.filter((r) => r.inputTokens != null);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      kind,
      calls: rs.length,
      ok: rs.filter((r) => r.ok).length,
      schemaOk: rs.filter((r) => r.schemaOk).length,
      p50Ms: percentile(rs.map((r) => r.ms), 50),
      p95Ms: percentile(rs.map((r) => r.ms), 95),
      avgIn: withTokens.length ? avg(withTokens.map((r) => r.inputTokens ?? 0)) : null,
      avgOut: withTokens.length ? avg(withTokens.map((r) => r.outputTokens ?? 0)) : null,
      avgTl: avg(tl),
      p90Tl: percentile(tl, 90),
      maxTl: Math.max(0, ...tl),
      red: rs.reduce((a, r) => a + r.red, 0),
      yellow: rs.reduce((a, r) => a + r.yellow, 0),
    };
  });
}

/** Detection quality of the analysis: risky fixtures flagged, safe fixtures left without a red flag. */
export function analysisQuality(records: EvalRecord[]) {
  const a = records.filter((r) => r.kind === "analysis" && r.ok);
  const risky = a.filter((r) => r.expectRisk);
  const safe = a.filter((r) => r.expectRisk === false);
  return {
    riskyCaught: risky.filter((r) => r.flagged).length,
    risky: risky.length,
    safeWithRed: safe.filter((r) => r.red > 0).length,
    safe: safe.length,
    aiProposed: a.reduce((s, r) => s + (r.aiProposed ?? 0), 0),
    aiAccepted: a.reduce((s, r) => s + (r.aiAccepted ?? 0), 0),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Response shape (to compare the real Gemini answer with what the adapter expects)            */

const SAFE_VALUE_KEYS = new Set(["type", "mime_type", "mimeType", "status", "role", "object", "state", "finish_reason", "finishReason"]);

/**
 * Lists the paths of a JSON response with their value types. Strings are never copied, except
 * short enum-like values of a few well-known keys (type, mime_type, status); media data shows only
 * its length. Safe to write to the report.
 */
export function describeShape(json: unknown, maxPaths = 60): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, path: string, key: string, depth: number) => {
    if (out.size >= maxPaths || depth > 8) return;
    if (Array.isArray(v)) {
      if (!v.length) out.add(`${path}: []`);
      for (const item of v.slice(0, 10)) walk(item, `${path}[]`, key, depth + 1);
    } else if (v && typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      if (!entries.length) out.add(`${path}: {}`);
      for (const [k, x] of entries) walk(x, path ? `${path}.${k}` : k, k, depth + 1);
    } else if (typeof v === "string") {
      if (SAFE_VALUE_KEYS.has(key) && /^[\w./:+-]{1,60}$/.test(v)) out.add(`${path} = "${v}"`);
      else out.add(`${path}: metin (${v.length > 1000 ? `${Math.round(v.length / 1024)} KB` : `${v.length} karakter`})`);
    } else out.add(`${path}: ${v === null ? "null" : typeof v}`);
  };
  walk(json, "", "", 0);
  return [...out].sort();
}

/** Numeric usage counters of a provider response (usage, usage_metadata or usageMetadata), if any. */
export function usageNumbers(json: unknown): Record<string, number> {
  const j = json as Record<string, unknown> | null;
  const u = (j?.usage ?? j?.usage_metadata ?? j?.usageMetadata) as Record<string, unknown> | undefined;
  const out: Record<string, number> = {};
  if (u && typeof u === "object") for (const [k, v] of Object.entries(u)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Report                                                                                      */

const tr1 = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const tr2 = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const dec = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
const int = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("tr-TR"));

export interface ReportInput {
  date: string;
  anthropicModel: string;
  anthropicKnown: boolean;
  geminiModels: { image: string; video: string } | null;
  prices: Prices;
  records: EvalRecord[];
  /** Credits charged today for each kind. */
  currentCredits: Partial<Record<EvalKind, number>>;
  shapes: { label: string; lines: string[]; usage: Record<string, number> }[];
  videoSeconds?: number;
}

export function renderReport(r: ReportInput): string {
  const p = r.prices;
  const net = netTlPerCredit(p);
  const sum = summarize(r.records, p);
  const q = analysisQuality(r.records);
  const L: string[] = [];
  L.push("# Yapay zekâ kalite ve maliyet ölçümü");
  L.push("");
  L.push(`Bu dosya \`npm run ai:eval -- --confirm\` ile gerçek API çağrılarıyla üretildi (${r.date}). Elle düzenleme; betiği yeniden çalıştır.`);
  L.push("");
  L.push("Reklam metinleri ve yanıt içerikleri bu dosyaya yazılmaz; yalnızca örnek kimliği, sektör ve ölçüler yer alır. Örnekler `tests/fixtures/ai-eval/` altında.");
  L.push("");
  L.push("## Varsayımlar");
  L.push("");
  L.push(`- Anthropic modeli: \`${r.anthropicModel}\`, liste fiyatı ${dec(p.anthropic.input)} $ / ${dec(p.anthropic.output)} $ (1M girdi / çıktı token)${r.anthropicKnown ? "" : " **(fiyat bilinmiyor, EVAL_ANTHROPIC_PRICE ile ver)**"}.`);
  if (r.geminiModels) L.push(`- Gemini modelleri: görsel \`${r.geminiModels.image}\`, video \`${r.geminiModels.video}\`; görsel başına ${dec(p.geminiImageUsd)} $, video saniyesi ${dec(p.geminiVideoUsdPerSec)} $ (resmî fiyat sayfasıyla doğrulanmalı).`);
  L.push(`- Photoroom: arka plan kaldırma çağrısı ${dec(p.photoroomSegmentUsd)} $, düzenleme çağrısı bunun ${p.photoroomEditMultiplier} katı (hesap sözleşmesiyle doğrulanmalı).`);
  L.push(`- Kur ${dec(p.usdTry)} TL/$. Kredi geliri en ucuz paketten, KDV (%${Math.round(p.vatRate * 100)}) ve ödeme komisyonu (%${Math.round(p.paymentFeeRate * 100)}) düşülerek: kredi başına ${tr2(net)} TL.`);
  L.push("");
  L.push("## Özet");
  L.push("");
  L.push("| Çağrı | Adet | Başarılı | Şemadan geçti | Süre p50 / p95 (sn) | Ort. token (girdi / çıktı) | Kırmızı / sarı bayrak | Ort. / p90 / en çok TL |");
  L.push("|---|---|---|---|---|---|---|---|");
  for (const s of sum) {
    L.push(`| ${KIND_LABEL[s.kind]} | ${s.calls} | ${s.ok} | ${s.schemaOk} | ${tr1(s.p50Ms / 1000)} / ${tr1(s.p95Ms / 1000)} | ${int(s.avgIn)} / ${int(s.avgOut)} | ${s.red} / ${s.yellow} | ${tr2(s.avgTl)} / ${tr2(s.p90Tl)} / ${tr2(s.maxTl)} |`);
  }
  L.push("");
  if (q.risky + q.safe > 0) {
    L.push("## Analiz kalitesi");
    L.push("");
    L.push(`- Riskli yazılmış ${q.risky} örneğin ${q.riskyCaught} tanesinde en az bir kırmızı ya da sarı bayrak çıktı.`);
    L.push(`- Güvenli yazılmış ${q.safe} örneğin ${q.safeWithRed} tanesinde kırmızı bayrak çıktı (yanlış alarm adayı; elle incelenmeli).`);
    L.push(`- Model ${q.aiProposed} bulgu önerdi; kural kimliği ve alıntı denetiminden ${q.aiAccepted} tanesi geçti.`);
    L.push("");
  }
  L.push("## Kredi önerisi (en az %50 brüt kâr)");
  L.push("");
  L.push("Öneri, ölçülen maliyetin 90. yüzdeliğine göre hesaplanır. Kredi tablolarını bu öneriye göre elle güncelle ve gerekçesini `docs/DURUM.md`'ye yaz.");
  L.push("");
  L.push("| İş | Bugünkü kredi | Bugünkü brüt kâr | Önerilen kredi |");
  L.push("|---|---|---|---|");
  for (const s of sum) {
    const cur = r.currentCredits[s.kind];
    if (cur == null) continue;
    L.push(`| ${KIND_LABEL[s.kind]} | ${cur} | %${Math.round(marginAt(s.p90Tl, cur, net) * 100)} | ${creditsForMargin(s.p90Tl, net)} |`);
  }
  const pr = sum.find((s) => s.kind === "photoroom");
  if (pr && pr.ok > 0) {
    const editTl = (pr.p90Tl || p.photoroomSegmentUsd * p.usdTry) * p.photoroomEditMultiplier;
    L.push(`| Büyütme (türetilen: 1 düzenleme çağrısı) | 2 | %${Math.round(marginAt(editTl, 2, net) * 100)} | ${creditsForMargin(editTl, net)} |`);
    L.push(`| Ürün sahnesi (türetilen: 4 düzenleme çağrısı) | 5 | %${Math.round(marginAt(editTl * 4, 5, net) * 100)} | ${creditsForMargin(editTl * 4, net)} |`);
  }
  const gi = sum.find((s) => s.kind === "gemini_image");
  if (gi && r.videoSeconds == null) {
    const videoTl = 10 * p.geminiVideoUsdPerSec * p.usdTry;
    L.push(`| Yapay zekâ videosu (fiyat varsayımıyla, 10 sn) | 8 | %${Math.round(marginAt(videoTl, 8, net) * 100)} | ${creditsForMargin(videoTl, net)} |`);
  }
  L.push("");
  if (r.shapes.length) {
    L.push("## Yanıt yapısı");
    L.push("");
    L.push("Adaptörün beklediği yapıyla karşılaştırmak için (içerik değil, yalnızca alan adları ve türleri).");
    for (const s of r.shapes) {
      L.push("");
      L.push(`### ${s.label}`);
      L.push("");
      L.push("```text");
      L.push(...(s.lines.length ? s.lines : ["(boş)"]));
      L.push("```");
      const u = Object.entries(s.usage);
      if (u.length) L.push("", `Kullanım sayaçları: ${u.map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
    L.push("");
  }
  L.push("## Tüm çağrılar");
  L.push("");
  L.push("| Örnek | Sektör | Çağrı | Sonuç | Süre (sn) | Token (girdi / çıktı) | İstek | Şema | Kırmızı | Sarı | TL |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const x of r.records) {
    const schema = x.schemaOk == null ? "—" : x.schemaOk ? "geçti" : "geçmedi";
    L.push(`| ${x.adId} | ${x.sector} | ${KIND_LABEL[x.kind]} | ${x.ok ? "tamam" : `hata: ${x.reason ?? "bilinmiyor"}`} | ${tr1(x.ms / 1000)} | ${int(x.inputTokens)} / ${int(x.outputTokens)} | ${x.requests} | ${schema} | ${x.red} | ${x.yellow} | ${tr2(x.costUsd * p.usdTry)} |`);
  }
  L.push("");
  return L.join("\n");
}
