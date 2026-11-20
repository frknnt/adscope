import "server-only";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { checkScriptText } from "@/lib/script/generate";
import type { ScriptStored } from "@/lib/script/service";
import { VOICEOVER_CREDIT_COST } from "./costs";
import { geminiTtsFromEnv } from "./gemini-tts";
import type { TtsOutcome, TtsProvider } from "./tts-provider";
import { AI_VOICE_NOTICE, MAX_VOICE_TEXT, PREVIEW_SECONDS, type TtsSpeed, type TtsVoice } from "./voices";
import { trimWav } from "./wav";

export function getTtsProvider(): TtsProvider | null {
  return geminiTtsFromEnv();
}

export interface VoiceoverScene {
  index: number;
  start: number;
  end: number;
  text: string;
  seconds: number;
  /** The audio is longer than the scene; the line should be shortened or read faster. */
  overrun: boolean;
}

export interface VoiceoverStored {
  scriptId: string;
  productName: string;
  duration: number;
  voice: TtsVoice;
  speed: TtsSpeed;
  provider: string;
  model: string;
  /** Always true: every voice here is synthetic, so the AI notice is always added. */
  synthetic: true;
  notice: string;
  scenes: VoiceoverScene[];
  files: { path: string; name: string; mime: string }[];
}

const FAIL: Record<Exclude<TtsOutcome, { ok: true }>["reason"], string> = {
  rate_limited: "Seslendirme hizmeti şu an yoğun. Bir dakika sonra yeniden dene; kredin düşmedi.",
  rejected: "Seslendirme hizmeti bu metni işlemedi. Metni değiştirip yeniden dene; kredin düşmedi.",
  unavailable: "Seslendirme hizmetine ulaşılamadı. Biraz sonra yeniden dene; kredin düşmedi.",
};

const tidyText = (s: string) => s.replace(/\s+/g, " ").trim();

/** Script context the rule check needs: the script itself, its sector and platform. */
export async function scriptContext(repo: DataRepo, scriptId: string): Promise<{ gen: GenerationRecord; stored: ScriptStored; sector: Sector; platform: Platform } | null> {
  const gen = await repo.getGeneration(scriptId);
  if (!gen || gen.kind !== "script" || !gen.platform) return null;
  const stored = gen.output as unknown as ScriptStored;
  const brand = gen.brandId ? (await repo.listBrands()).find((b) => b.id === gen.brandId) : null;
  const sector = brand?.sector ?? stored.input?.sector ?? (await repo.getProfile())?.defaultSector ?? "genel";
  return { gen, stored, sector, platform: gen.platform };
}

/** Rule check before any audio is made: a red finding must be fixed first. */
export async function blockingIssues(repo: DataRepo, sector: Sector, platform: Platform, texts: string[]): Promise<number[]> {
  const rules = (await repo.getRules(sector)).filter((r) => ruleAppliesTo(r, platform));
  return texts.flatMap((t, i) => (checkScriptText(t, rules).risk === "red" ? [i] : []));
}

/**
 * Free preview: the first words of the line, cut to five seconds. Nothing is stored and no credit is
 * charged; the caller rate-limits it.
 */
export async function previewVoice(repo: DataRepo, provider: TtsProvider, p: { scriptId: string; text: string; voice: TtsVoice; speed: TtsSpeed }): Promise<{ ok: true; wav: Uint8Array } | { ok: false; error: string }> {
  const text = tidyText(p.text);
  if (!text) return { ok: false, error: "Seslendirilecek metin boş." };
  if (text.length > MAX_VOICE_TEXT) return { ok: false, error: `Metin en fazla ${MAX_VOICE_TEXT} karakter olabilir.` };
  const ctx = await scriptContext(repo, p.scriptId);
  if (!ctx) return { ok: false, error: "Senaryo bulunamadı." };
  if ((await blockingIssues(repo, ctx.sector, ctx.platform, [text])).length) return { ok: false, error: "Bu satırda yüksek riskli bir ifade var. Önce düzelt ya da güvenli sürümü uygula, sonra dinle." };
  // About 2.5 Turkish words per second: 14 words is a little over five seconds before the cut.
  const words = text.split(" ");
  const short = words.length > 14 ? `${words.slice(0, 14).join(" ")}…` : text;
  const out = await provider.synthesize({ text: short, voice: p.voice, speed: p.speed });
  if (!out.ok) return { ok: false, error: FAIL[out.reason].replace("; kredin düşmedi", "") };
  const wav = trimWav(out.wav, PREVIEW_SECONDS);
  return wav ? { ok: true, wav } : { ok: false, error: FAIL.unavailable.replace("; kredin düşmedi", "") };
}

export type VoiceoverResult = { ok: true; generation: GenerationRecord; charged: number } | { ok: false; error: string };

/**
 * Full voice-over of one or more scenes of a script: every line is checked by the rule engine first,
 * then read by the provider; the files go to the caller's private folder (deleted with the record
 * after 90 days) and one credit is charged together with the record, only when every line succeeded.
 * A repeated request id returns the earlier result without charging again.
 */
export async function runVoiceover(repo: DataRepo, provider: TtsProvider, p: { requestId: string; scriptId: string; lines: { index: number; text: string }[]; voice: TtsVoice; speed: TtsSpeed }): Promise<VoiceoverResult> {
  const existing = await repo.getGenerationByRequest(p.requestId);
  if (existing) return existing.kind === "voiceover" ? { ok: true, generation: existing, charged: 0 } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };
  const ctx = await scriptContext(repo, p.scriptId);
  if (!ctx) return { ok: false, error: "Senaryo bulunamadı." };
  const scenes = ctx.stored.script?.scenes ?? [];
  const seen = new Set<number>();
  const lines = p.lines
    .map((l) => ({ index: l.index, text: tidyText(l.text) }))
    .filter((l) => l.text && Number.isInteger(l.index) && l.index >= 0 && l.index < scenes.length && !seen.has(l.index) && seen.add(l.index))
    .sort((a, b) => a.index - b.index);
  if (!lines.length) return { ok: false, error: "Seslendirilecek dış ses satırı yok." };
  if (lines.some((l) => l.text.length > MAX_VOICE_TEXT)) return { ok: false, error: `Bir satır en fazla ${MAX_VOICE_TEXT} karakter olabilir.` };
  const red = await blockingIssues(repo, ctx.sector, ctx.platform, lines.map((l) => l.text));
  if (red.length) return { ok: false, error: `Yüksek riskli ifade olan sahneleri önce düzelt: ${red.map((i) => `${lines[i].index + 1}. sahne`).join(", ")}. Kredi düşmedi.` };
  if ((await repo.getBalance()) < VOICEOVER_CREDIT_COST) return { ok: false, error: `Seslendirme ${VOICEOVER_CREDIT_COST} kredi. Krediler sayfasından paket alabilirsin.` };

  // A few lines at a time keeps a 12-scene script within the provider's rate limits.
  const outcomes: TtsOutcome[] = [];
  for (let i = 0; i < lines.length; i += 3) outcomes.push(...(await Promise.all(lines.slice(i, i + 3).map((l) => provider.synthesize({ text: l.text, voice: p.voice, speed: p.speed })))));
  const failed = outcomes.find((o): o is Extract<TtsOutcome, { ok: false }> => !o.ok);
  if (failed) return { ok: false, error: FAIL[failed.reason] };

  const files: VoiceoverStored["files"] = [];
  const out: VoiceoverScene[] = [];
  for (const [i, o] of outcomes.entries()) {
    if (!o.ok) continue;
    const l = lines[i];
    const scene = scenes[l.index];
    const name = `adscope-dis-ses-sahne-${l.index + 1}.wav`;
    const path = await repo.saveGenerationFile(name, o.wav, "audio/wav");
    if (!path) {
      await repo.removeGenerationFiles(files.map((f) => f.path));
      return { ok: false, error: "Ses kaydedilemedi. Biraz sonra yeniden dene; kredin düşmedi." };
    }
    files.push({ path, name, mime: "audio/wav" });
    const seconds = Math.round(o.durationSec * 10) / 10;
    out.push({ index: l.index, start: scene.start, end: scene.end, text: l.text, seconds, overrun: seconds > scene.end - scene.start + 0.3 });
  }
  const stored: VoiceoverStored = {
    scriptId: ctx.gen.id,
    productName: ctx.stored.input?.productName ?? "",
    duration: ctx.stored.script.duration,
    voice: p.voice,
    speed: p.speed,
    provider: provider.name,
    model: provider.model,
    synthetic: true,
    notice: AI_VOICE_NOTICE,
    scenes: out,
    files,
  };
  const rec = await repo.recordGeneration({ clientRequestId: p.requestId, kind: "voiceover", creditCost: VOICEOVER_CREDIT_COST, brandId: null, platform: ctx.platform, output: stored as unknown as Record<string, unknown> });
  if (rec.status === "created") return { ok: true, generation: rec.generation, charged: VOICEOVER_CREDIT_COST };
  await repo.removeGenerationFiles(files.map((f) => f.path));
  if (rec.status === "exists") return { ok: true, generation: rec.generation, charged: 0 };
  return { ok: false, error: rec.status === "insufficient_credits" ? `Seslendirme ${VOICEOVER_CREDIT_COST} kredi; kredin yetersiz.` : "Seslendirme kaydedilemedi. Kredi düşmedi." };
}
