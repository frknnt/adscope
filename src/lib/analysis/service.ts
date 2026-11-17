import "server-only";
import { SECTOR_IDS } from "@/lib/sectors";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import type { AiProvider } from "@/lib/ai/provider";
import { getRepo } from "@/lib/data";
import type { DataRepo } from "@/lib/data/types";
import { PLATFORM_IDS } from "@/lib/platforms";
import { buildAppeal } from "@/lib/engine/appeal";
import { runPipeline } from "@/lib/engine/pipeline";
import type { AdInput, EngineFinding, ImageMeta, LandingSnapshot, VideoMeta } from "@/lib/engine/types";
import { MAX_VIDEO_FRAMES } from "@/lib/engine/video";
import { creditCostFor } from "./cost";
import { appMode, hourlyAnalysisLimit } from "@/lib/env";
import { mergeScreenshot } from "@/lib/engine/landing";
import { fetchLanding, validateLandingUrl } from "@/lib/landing/fetch";
import { validateWav } from "@/lib/security/audio-validation";
import { validateImage } from "@/lib/security/file-validation";
import { getSpeechProvider } from "@/lib/speech/openai-whisper";
import { seasonToday } from "@/lib/calendar/season";

/** Longest video we accept for analysis (Reels allow up to a few minutes). */
export const MAX_VIDEO_SECONDS = 600;

const VideoSchema = z.object({
  mime: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
  durationSec: z.number().positive().max(MAX_VIDEO_SECONDS, "Video en fazla 10 dakika olabilir."),
  width: z.int().min(16).max(8192),
  height: z.int().min(16).max(8192),
  sizeBytes: z.int().positive().max(4 * 1024 * 1024 * 1024),
  /** Time of each uploaded frame, in the same order as the frame files. */
  frameTimesMs: z.array(z.int().min(0).max(MAX_VIDEO_SECONDS * 1000)).min(1).max(MAX_VIDEO_FRAMES),
  /** Measured in the browser from the audio track. */
  audio: z
    .object({
      analyzed: z.boolean(),
      present: z.boolean(),
      firstSoundSec: z.number().min(0).max(MAX_VIDEO_SECONDS).nullable(),
      silentRatio: z.number().min(0).max(1).nullable(),
      meanDbFirst3s: z.number().min(-200).max(0).nullable(),
    })
    .nullable()
    .default(null),
});

export const AnalysisFormSchema = z.object({
  clientRequestId: z.uuid(),
  brandId: z.uuid().nullable(),
  sector: z.enum(SECTOR_IDS),
  platform: z.enum(PLATFORM_IDS).default("meta"),
  headline: z.string().trim().max(255),
  primaryText: z.string().trim().min(1, "Reklam ana metni gerekli.").max(2200, "Ana metin en fazla 2200 karakter olabilir."),
  description: z.string().trim().max(255),
  rejectionMessage: z.string().trim().max(3000).nullable(),
  flags: z.object({
    influencerPost: z.boolean(),
    aiHumanCharacter: z.boolean(),
    aiRealPersonCopy: z.boolean(),
  }),
  mediaType: z.enum(["image", "video"]).default("image"),
  video: VideoSchema.nullable().default(null),
  transcript: z.string().trim().max(3000, "Video metni en fazla 3000 karakter olabilir.").nullable().default(null),
  landingUrl: z.string().trim().max(2048, "Bağlantı çok uzun.").nullable().default(null),
  /** The user agreed to send the video's audio once to the speech-to-text provider. */
  speechToText: z.boolean().default(false),
}).refine((f) => (f.mediaType === "video") === (f.video !== null), { path: ["video"], message: "Video bilgileri eksik." });

export type AnalysisForm = z.infer<typeof AnalysisFormSchema>;

export type AnalysisOutcome =
  | { ok: true; analysisId: string; reused: boolean }
  | { ok: false; status: number; code: string; message: string; analysisId?: string };

const MESSAGES: Record<string, string> = {
  insufficient_credits: "Krediniz kalmadı. Analiz başlatmak için kredi yükleyin. Krediniz düşülmedi.",
  insufficient_credits_video: "Video analizi 2 kredi kullanır; bakiyeniz yetmiyor. Kredi yükleyin. Krediniz düşülmedi.",
  rate_limited: "Kısa sürede çok fazla analiz başlattınız. Lütfen biraz sonra tekrar deneyin.",
  brand_not_found: "Seçilen marka bulunamadı.",
  upload_failed: "Görsel yüklenemedi. Krediniz düşülmedi; lütfen tekrar deneyin.",
  frames_mismatch: "Video kareleri eksik geldi. Lütfen videoyu yeniden seçin.",
  invalid_landing_url: "Açılış sayfası bağlantısı geçersiz. https:// ile başlayan herkese açık bir adres girin.",
  bad_audio: "Videonun sesi okunamadı. Sesi yazıya dökme seçeneğini kapatıp yeniden deneyin.",
  bad_screenshot: "Açılış sayfası ekran görüntüsü okunamadı. JPG, PNG veya WebP, en fazla 5 MB olmalı.",
  engine_error: "Analiz tamamlanamadı. Krediniz düşülmedi; lütfen tekrar deneyin.",
  error: "Beklenmeyen bir sorun oluştu. Krediniz düşülmedi; lütfen tekrar deneyin.",
};

export function getAiProvider(): AiProvider | null {
  const p = new AnthropicProvider();
  return p.enabled ? p : null;
}

export type MediaUpload =
  | { kind: "image"; file: { bytes: Uint8Array; mime: string } }
  | { kind: "video"; frames: { bytes: Uint8Array; mime: string }[]; audio?: Uint8Array | null };

export interface UploadExtras {
  /** Screenshot of the landing page; read by the AI when the page cannot be fetched or renders with JavaScript. */
  landingScreenshot?: { bytes: Uint8Array; mime: string } | null;
  /** Data access to use instead of the session repo (enterprise API acts for a key's owner). */
  repo?: DataRepo;
}

export function speechToTextAvailable() {
  return getSpeechProvider() !== null;
}

type CheckedFile = { bytes: Uint8Array; meta: ImageMeta; ext: string };

function fail(status: number, code: string, message?: string): AnalysisOutcome {
  return { ok: false, status, code, message: message ?? MESSAGES[code] ?? MESSAGES.error };
}

/**
 * Orchestrates one analysis. Credit is consumed only inside completeAnalysis (atomic with results).
 * Every failure path marks the analysis failed and never touches credits.
 *
 * Video: the browser sends only a few JPEG still frames plus measured metadata; the video file never
 * reaches the server. Landing page: fetched once, server-side, through the SSRF guard.
 */
export async function runAnalysisRequest(form: AnalysisForm, media: MediaUpload, extras: UploadExtras = {}): Promise<AnalysisOutcome> {
  // 1) Validate every uploaded file by its bytes before anything is created.
  const files: CheckedFile[] = [];
  const raw = media.kind === "image" ? [media.file] : media.frames;
  if (media.kind !== form.mediaType) return fail(400, "invalid_form", "Form alanlarını kontrol edin.");
  if (media.kind === "video" && (raw.length < 1 || raw.length > MAX_VIDEO_FRAMES || raw.length !== form.video?.frameTimesMs.length)) {
    return fail(400, "frames_mismatch");
  }
  for (const f of raw) {
    const check = validateImage(f.bytes, f.mime);
    if (!check.ok) {
      const message = media.kind === "video" ? "Videodan alınan kareler okunamadı. Videoyu MP4 (H.264) olarak kaydedip yeniden deneyin." : check.message;
      return fail(400, check.code, message);
    }
    files.push({ bytes: f.bytes, meta: check.meta, ext: check.ext });
  }
  const landingUrl = form.landingUrl ? validateLandingUrl(form.landingUrl)?.toString() ?? null : null;
  if (form.landingUrl && !landingUrl) return fail(400, "invalid_landing_url");

  let screenshot: CheckedFile | null = null;
  if (extras.landingScreenshot) {
    const check = validateImage(extras.landingScreenshot.bytes, extras.landingScreenshot.mime);
    if (!check.ok) return fail(400, "bad_screenshot");
    screenshot = { bytes: extras.landingScreenshot.bytes, meta: check.meta, ext: check.ext };
  }

  // Audio goes to the speech-to-text provider only with the user's consent and when one is configured.
  const speech = form.speechToText && media.kind === "video" && media.audio ? getSpeechProvider() : null;
  if (speech && media.kind === "video" && media.audio && !validateWav(media.audio).ok) return fail(400, "bad_audio");

  const video: VideoMeta | null =
    media.kind === "video" && form.video
      ? {
          mime: form.video.mime,
          durationSec: Math.round(form.video.durationSec * 10) / 10,
          width: form.video.width,
          height: form.video.height,
          sizeBytes: form.video.sizeBytes,
          frameCount: files.length,
          audio: form.video.audio,
        }
      : null;
  const transcript = media.kind === "video" ? form.transcript || null : null;

  const repo = extras.repo ?? getRepo();
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
    mediaType: media.kind,
    videoMeta: video,
    transcript,
    landingUrl,
    creditCost: creditCostFor(media.kind),
    platform: form.platform,
  });
  if (!started.ok) {
    const status = started.code === "insufficient_credits" ? 402 : started.code === "rate_limited" ? 429 : started.code === "brand_not_found" ? 400 : 500;
    if (started.code === "insufficient_credits" && media.kind === "video") return fail(402, started.code, MESSAGES.insufficient_credits_video);
    return fail(status, started.code);
  }
  // Double click / retry with the same request id: return the existing analysis.
  if (!started.created) {
    if (started.status === "failed") {
      return { ok: false, status: 409, code: "previous_failed", message: "Bu deneme daha önce başarısız oldu. Formu yeniden gönderin.", analysisId: started.analysisId };
    }
    return { ok: true, analysisId: started.analysisId, reused: true };
  }
  const analysisId = started.analysisId;

  // 2) Store the creative (or the frames) in private storage.
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const sha256 = createHash("sha256").update(f.bytes).digest("hex");
    const ok =
      media.kind === "image"
        ? await repo.uploadAsset(analysisId, f.bytes, f.meta, f.ext, sha256)
        : await repo.uploadAsset(analysisId, f.bytes, f.meta, f.ext, sha256, { kind: "video_frame", frameIndex: i, frameTimeMs: form.video!.frameTimesMs[i] });
    if (!ok) {
      await repo.failAnalysis(analysisId, "upload_failed");
      return { ...fail(502, "upload_failed"), analysisId };
    }
  }
  if (screenshot) {
    const sha256 = createHash("sha256").update(screenshot.bytes).digest("hex");
    if (!(await repo.uploadAsset(analysisId, screenshot.bytes, screenshot.meta, screenshot.ext, sha256, { kind: "landing_screenshot" }))) {
      await repo.failAnalysis(analysisId, "upload_failed");
      return { ...fail(502, "upload_failed"), analysisId };
    }
  }

  try {
    const ai = getAiProvider();

    // 3) Landing page (optional). A fetch problem never fails the analysis; it becomes a check result.
    //    The page fetch and the speech-to-text run in parallel.
    const [fetched, speechResult] = await Promise.all([
      landingUrl ? fetchLanding(landingUrl) : Promise.resolve(null),
      speech && media.kind === "video" && media.audio ? speech.transcribe(media.audio, { language: "tr" }) : Promise.resolve(null),
    ]);
    let landing: LandingSnapshot | null = fetched;
    if (screenshot) {
      if (ai?.readScreenshot) {
        const read = await ai.readScreenshot({ base64: Buffer.from(screenshot.bytes).toString("base64"), mime: screenshot.meta.mime });
        await repo.recordAiRun({
          analysisId,
          provider: read.meta.provider,
          model: read.meta.model,
          purpose: "analysis",
          status: read.ok ? "succeeded" : "fallback",
          latencyMs: read.meta.latencyMs,
          inputTokens: read.meta.inputTokens,
          outputTokens: read.meta.outputTokens,
          errorCode: read.ok ? null : read.reason,
        });
        landing = mergeScreenshot(landing, read.ok ? { title: read.data.title, text: read.data.visible_text, isPage: read.data.is_web_page } : "unread");
      } else {
        landing = mergeScreenshot(landing, "unread");
      }
    }
    if (speechResult) {
      await repo.recordAiRun({
        analysisId,
        provider: speech!.name,
        model: null,
        purpose: "analysis",
        status: speechResult.ok ? "succeeded" : "fallback",
        latencyMs: speechResult.latencyMs,
        errorCode: speechResult.ok ? null : speechResult.reason,
      });
      if (speechResult.ok && speechResult.transcript.text) await repo.setSpeechTranscript(analysisId, speechResult.transcript.text);
    }

    const rules = await repo.getRules(form.sector);
    const input: AdInput = {
      sector: form.sector,
      platform: form.platform,
      headline: form.headline,
      primaryText: form.primaryText,
      description: form.description,
      brandName: brand?.name ?? null,
      brandVoice: brand ? { bannedWords: brand.bannedWords, preferredCta: brand.preferredCta, voiceNotes: brand.voiceNotes, requiredPhrases: brand.requiredPhrases } : null,
      tone: brand?.tone,
      rejectionMessage: form.rejectionMessage,
      flags: form.flags,
      image: media.kind === "image" ? files[0].meta : null,
      video,
      transcript,
      landing,
      speech: speechResult?.ok ? speechResult.transcript : null,
      today: seasonToday(),
    };
    const images = ai ? pickImagesForAi(media.kind, files, form.video?.frameTimesMs ?? []) : [];
    const { result, ai: aiRun } = await runPipeline({ input, rules, ai, images });
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
    if (status === "insufficient_credits") return { ...fail(402, status), analysisId };
    await repo.failAnalysis(analysisId, "complete_failed");
    return { ...fail(500, "error"), analysisId };
  } catch {
    // Never log ad content; only the code.
    console.error("[analysis] engine_error", { analysisId });
    await repo.failAnalysis(analysisId, "engine_error");
    return { ...fail(500, "engine_error"), analysisId };
  }
}

/** The image, or every extracted video frame (at most 6, hook-weighted toward the first seconds). */
function pickImagesForAi(kind: "image" | "video", files: CheckedFile[], timesMs: number[]) {
  if (kind === "image") return [{ base64: Buffer.from(files[0].bytes).toString("base64"), mime: files[0].meta.mime }];
  return files.slice(0, 6).map((f, i) => ({
    base64: Buffer.from(f.bytes).toString("base64"),
    mime: f.meta.mime,
    label: `Kare ${i + 1} (${((timesMs[i] ?? 0) / 1000).toFixed(1)} sn)`,
  }));
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
