import "server-only";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { stripImageMetadata } from "@/lib/image/metadata";
import { validateImage } from "@/lib/security/file-validation";
import { GENAI_OPS, type GenaiOp } from "./costs";
import { geminiFromEnv, type GenAspect, type GenOutcome, type GenRef, type GeminiProvider } from "./gemini";
import { imagePrompt, videoPrompt } from "./prompt";

export function getGenaiProvider(): GeminiProvider | null {
  return geminiFromEnv();
}

export type GenaiJob = { op: "ai_image"; description: string; aspect: "1:1" | "4:5" | "9:16"; count: number } | { op: "ai_video"; description: string; aspect: "9:16" | "16:9" };
export type GenaiResult = { ok: true; generation: GenerationRecord; charged: number; partial: boolean } | { ok: false; error: string };

const FAIL: Record<Exclude<GenOutcome, { ok: true }>["reason"], string> = {
  rate_limited: "Üretim hizmeti şu an yoğun. Bir dakika sonra yeniden dene; kredin düşmedi.",
  rejected: "Üretim hizmeti bu açıklamayı ya da görseli işlemedi (güvenlik filtresi olabilir). Açıklamayı değiştirip yeniden dene; kredin düşmedi.",
  unavailable: "Üretim hizmetine ulaşılamadı ya da sonuç gelmedi. Biraz sonra yeniden dene; kredin düşmedi.",
};

/**
 * Validates the optional product photo, strips its metadata, generates, stores the results in the
 * caller's private folder and records the generation. Credits are charged per delivered result,
 * together with the record and only after the files are saved; a repeated request id returns the
 * earlier result without charging again.
 */
export async function runGenaiJob(repo: DataRepo, provider: GeminiProvider, p: { requestId: string; job: GenaiJob; reference: { bytes: Uint8Array; mime: string } | null }): Promise<GenaiResult> {
  const existing = await repo.getGenerationByRequest(p.requestId);
  if (existing) return existing.kind === p.job.op ? { ok: true, generation: existing, charged: 0, partial: false } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };

  let ref: GenRef | null = null;
  if (p.reference) {
    const check = validateImage(p.reference.bytes, p.reference.mime, 100);
    if (!check.ok) return { ok: false, error: check.message };
    ref = { bytes: stripImageMetadata(p.reference.bytes, check.meta.mime), mime: check.meta.mime };
  }
  const job = p.job;
  const count = job.op === "ai_image" ? Math.min(Math.max(1, Math.trunc(job.count)), GENAI_OPS.ai_image.maxResults) : 1;
  const per = GENAI_OPS[job.op].creditsPerResult;
  if ((await repo.getBalance()) < per * count) return { ok: false, error: `Bu işlem ${per * count} kredi. Krediler sayfasından paket alabilirsin.` };

  const outcomes: GenOutcome[] =
    job.op === "ai_image"
      ? await Promise.all(Array.from({ length: count }, (_, i) => provider.image({ prompt: imagePrompt(job.description, Boolean(ref), i), refs: ref ? [ref] : [], aspect: job.aspect as GenAspect })))
      : [await provider.video({ prompt: videoPrompt(job.description, Boolean(ref)), start: ref, aspect: job.aspect })];
  const good = outcomes.filter((o): o is Extract<GenOutcome, { ok: true }> => o.ok);
  if (!good.length) {
    const failed = outcomes.find((o): o is Extract<GenOutcome, { ok: false }> => !o.ok)!;
    return { ok: false, error: FAIL[failed.reason] };
  }

  const files: { path: string; name: string; mime: string }[] = [];
  for (const [i, o] of good.entries()) {
    const ext = o.mime === "video/mp4" ? "mp4" : o.mime === "image/png" ? "png" : o.mime === "image/webp" ? "webp" : "jpg";
    const name = `adscope-${job.op === "ai_video" ? "yz-video" : "yz-gorsel"}${good.length > 1 ? `-${i + 1}` : ""}.${ext}`;
    const path = await repo.saveGenerationFile(name, o.bytes, o.mime);
    if (!path) {
      await repo.removeGenerationFiles(files.map((f) => f.path));
      return { ok: false, error: "Sonuç kaydedilemedi. Biraz sonra yeniden dene; kredin düşmedi." };
    }
    files.push({ path, name, mime: o.mime });
  }
  const cost = per * good.length;
  const res = await repo.recordGeneration({
    clientRequestId: p.requestId,
    kind: job.op,
    creditCost: cost,
    brandId: null,
    platform: null,
    output: { op: job.op, aspect: job.aspect, provider: provider.name, model: job.op === "ai_video" ? provider.videoModel : provider.imageModel, withProduct: Boolean(ref), requested: count, files },
  });
  if (res.status === "created") return { ok: true, generation: res.generation, charged: cost, partial: good.length < count };
  await repo.removeGenerationFiles(files.map((f) => f.path));
  if (res.status === "exists") return { ok: true, generation: res.generation, charged: 0, partial: false };
  return { ok: false, error: res.status === "insufficient_credits" ? `Bu işlem ${cost} kredi.` : "İşlem kaydedilemedi." };
}
