import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import type { AiProvider } from "@/lib/ai/provider";
import { getRepo } from "@/lib/data";
import { buildAppeal } from "@/lib/engine/appeal";
import { runPipeline } from "@/lib/engine/pipeline";
import type { AdInput, EngineFinding } from "@/lib/engine/types";
import { appMode, hourlyAnalysisLimit } from "@/lib/env";
import { validateImage } from "@/lib/security/file-validation";

export const AnalysisFormSchema = z.object({
  clientRequestId: z.uuid(),
  brandId: z.uuid().nullable(),
  sector: z.enum(["genel", "takviye_gida", "estetik_klinik"]),
  headline: z.string().trim().max(255),
  primaryText: z.string().trim().min(1, "Reklam ana metni gerekli.").max(2200, "Ana metin en fazla 2200 karakter olabilir."),
  description: z.string().trim().max(255),
  rejectionMessage: z.string().trim().max(3000).nullable(),
  flags: z.object({
    influencerPost: z.boolean(),
    aiHumanCharacter: z.boolean(),
    aiRealPersonCopy: z.boolean(),
  }),
});

export type AnalysisForm = z.infer<typeof AnalysisFormSchema>;

export type AnalysisOutcome =
  | { ok: true; analysisId: string; reused: boolean }
  | { ok: false; status: number; code: string; message: string; analysisId?: string };

const MESSAGES: Record<string, string> = {
  insufficient_credits: "Krediniz kalmadı. Analiz başlatmak için kredi yükleyin. Krediniz düşülmedi.",
  rate_limited: "Kısa sürede çok fazla analiz başlattınız. Lütfen biraz sonra tekrar deneyin.",
  brand_not_found: "Seçilen marka bulunamadı.",
  upload_failed: "Görsel yüklenemedi. Krediniz düşülmedi; lütfen tekrar deneyin.",
  engine_error: "Analiz tamamlanamadı. Krediniz düşülmedi; lütfen tekrar deneyin.",
  error: "Beklenmeyen bir sorun oluştu. Krediniz düşülmedi; lütfen tekrar deneyin.",
};

export function getAiProvider(): AiProvider | null {
  const p = new AnthropicProvider();
  return p.enabled ? p : null;
}

/**
 * Orchestrates one analysis. Credit is consumed only inside completeAnalysis (atomic with results).
 * Every failure path marks the analysis failed and never touches credits.
 */
export async function runAnalysisRequest(form: AnalysisForm, file: { bytes: Uint8Array; mime: string }): Promise<AnalysisOutcome> {
  const check = validateImage(file.bytes, file.mime);
  if (!check.ok) return { ok: false, status: 400, code: check.code, message: check.message };

  const repo = getRepo();
  const brands = form.brandId ? await repo.listBrands() : [];
  const brand = brands.find((b) => b.id === form.brandId) ?? null;

  const started = await repo.startAnalysis({
    clientRequestId: form.clientRequestId,
    brandId: form.brandId,
    sector: form.sector,
    headline: form.headline,
    primaryText: form.primaryText,
    description: form.description,
    rejectionMessage: form.rejectionMessage || null,
    demo: appMode() === "demo",
    hourlyLimit: hourlyAnalysisLimit(),
  });
  if (!started.ok) {
    const status = started.code === "insufficient_credits" ? 402 : started.code === "rate_limited" ? 429 : started.code === "brand_not_found" ? 400 : 500;
    return { ok: false, status, code: started.code, message: MESSAGES[started.code] ?? MESSAGES.error };
  }
  // Double click / retry with the same request id: return the existing analysis.
  if (!started.created) {
    if (started.status === "failed") {
      return { ok: false, status: 409, code: "previous_failed", message: "Bu deneme daha önce başarısız oldu. Formu yeniden gönderin.", analysisId: started.analysisId };
    }
    return { ok: true, analysisId: started.analysisId, reused: true };
  }
  const analysisId = started.analysisId;

  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const uploaded = await repo.uploadAsset(analysisId, file.bytes, check.meta, check.ext, sha256);
  if (!uploaded) {
    await repo.failAnalysis(analysisId, "upload_failed");
    return { ok: false, status: 502, code: "upload_failed", message: MESSAGES.upload_failed, analysisId };
  }

  try {
    const rules = await repo.getRules(form.sector);
    const input: AdInput = {
      sector: form.sector,
      headline: form.headline,
      primaryText: form.primaryText,
      description: form.description,
      brandName: brand?.name ?? null,
      tone: brand?.tone,
      rejectionMessage: form.rejectionMessage,
      flags: form.flags,
      image: check.meta,
    };
    const ai = getAiProvider();
    const { result, ai: aiRun } = await runPipeline({
      input,
      rules,
      ai,
      imageBase64: ai ? Buffer.from(file.bytes).toString("base64") : null,
    });
    if (aiRun) {
      await repo.recordAiRun({
        analysisId,
        provider: aiRun.meta.provider,
        model: aiRun.meta.model,
        purpose: "analysis",
        status: aiRun.ok ? "succeeded" : aiRun.reason === "schema_invalid" ? "schema_invalid" : "fallback",
        latencyMs: aiRun.meta.latencyMs,
        inputTokens: aiRun.meta.inputTokens,
        outputTokens: aiRun.meta.outputTokens,
        errorCode: aiRun.ok ? null : aiRun.reason,
      });
    }
    const status = await repo.completeAnalysis(analysisId, result);
    if (status === "completed" || status === "already_completed") return { ok: true, analysisId, reused: status === "already_completed" };
    if (status === "insufficient_credits") return { ok: false, status: 402, code: status, message: MESSAGES.insufficient_credits, analysisId };
    await repo.failAnalysis(analysisId, "complete_failed");
    return { ok: false, status: 500, code: "error", message: MESSAGES.error, analysisId };
  } catch {
    // Never log ad content; only the code.
    console.error("[analysis] engine_error", { analysisId });
    await repo.failAnalysis(analysisId, "engine_error");
    return { ok: false, status: 500, code: "engine_error", message: MESSAGES.engine_error, analysisId };
  }
}

/** Regenerates an appeal draft for an existing completed analysis (no extra credit). */
export async function regenerateAppeal(analysisId: string, rejectionMessage: string) {
  const repo = getRepo();
  const detail = await repo.getAnalysis(analysisId);
  if (!detail || detail.status !== "completed") return { ok: false as const };
  const findings: EngineFinding[] = detail.findings.map((f) => ({
    ruleId: f.rule?.id ?? null,
    ruleVersionId: null,
    ruleStatus: f.rule?.status ?? null,
    domain: f.domain,
    severity: f.severity,
    field: (f.field ?? "general") as EngineFinding["field"],
    matchedText: f.matchedText,
    title: f.title,
    explanation: f.explanation,
    suggestion: f.suggestion,
    origin: f.origin as EngineFinding["origin"],
  }));
  const appeal = buildAppeal({ rejectionMessage, findings, safeText: detail.safeText ?? "", headline: detail.headline });
  const ok = await repo.saveAppeal(analysisId, appeal);
  return { ok };
}
