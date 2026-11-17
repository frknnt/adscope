import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AnalysisFormSchema, runAnalysisRequest } from "@/lib/analysis/service";
import { apiError, apiJson, authenticate, serializeAnalysis } from "@/lib/api/v1";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  /** Same value = same analysis (safe retries). */
  client_request_id: z.uuid().optional(),
  brand_id: z.uuid().nullable().optional(),
  sector: z.enum(SECTOR_IDS).default("genel"),
  platform: z.enum(PLATFORM_IDS).default("meta"),
  headline: z.string().max(255).default(""),
  primary_text: z.string().min(1).max(2200),
  description: z.string().max(255).default(""),
  landing_url: z.string().max(2048).nullable().optional(),
  rejection_message: z.string().max(3000).nullable().optional(),
  flags: z
    .object({ influencer_post: z.boolean().default(false), ai_human_character: z.boolean().default(false), ai_real_person_copy: z.boolean().default(false) })
    .default({ influencer_post: false, ai_human_character: false, ai_real_person_copy: false }),
  image: z.object({
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    /** Base64 of the image file (≤ 5 MB decoded). */
    data_base64: z.string().min(16).max(7_200_000),
  }),
});

/**
 * Enterprise API: run one image analysis as the API key's owner. Credits are consumed exactly as in
 * the panel (on completion, through the same database functions). Synchronous: the report is returned.
 */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (Number(req.headers.get("content-length") ?? 0) > 8 * 1024 * 1024) return apiError(413, "too_large", "İstek en fazla 8 MB olabilir.");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "bad_json", "Gövde geçerli bir JSON değil.");
  }
  const body = BodySchema.safeParse(raw);
  if (!body.success) {
    const i = body.error.issues[0];
    return apiError(400, "invalid_request", `${i?.path.join(".") || "gövde"}: ${i?.message ?? "geçersiz"}`);
  }
  const b = body.data;
  const form = AnalysisFormSchema.safeParse({
    clientRequestId: b.client_request_id ?? randomUUID(),
    brandId: b.brand_id ?? null,
    sector: b.sector,
    platform: b.platform,
    headline: b.headline,
    primaryText: b.primary_text,
    description: b.description,
    rejectionMessage: b.rejection_message ?? null,
    flags: { influencerPost: b.flags.influencer_post, aiHumanCharacter: b.flags.ai_human_character, aiRealPersonCopy: b.flags.ai_real_person_copy },
    mediaType: "image",
    video: null,
    transcript: null,
    landingUrl: b.landing_url ?? null,
    speechToText: false,
  });
  if (!form.success) return apiError(400, "invalid_request", form.error.issues[0]?.message ?? "Geçersiz istek.");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(b.image.data_base64, "base64"));
  } catch {
    return apiError(400, "bad_image", "Görsel base64 olarak okunamadı.");
  }
  const outcome = await runAnalysisRequest(form.data, { kind: "image", file: { bytes, mime: b.image.mime } }, { repo: auth.repo });
  if (!outcome.ok) return apiError(outcome.status, outcome.code, outcome.message, outcome.analysisId ? { "X-Analysis-Id": outcome.analysisId } : {});
  const a = await auth.repo.getAnalysis(outcome.analysisId);
  if (!a) return apiError(500, "error", "Rapor okunamadı.");
  return apiJson(outcome.reused ? 200 : 201, { ok: true, reused: outcome.reused, analysis: serializeAnalysis(a) });
}

/** Lists the key owner's recent analyses (summary only). */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const list = await auth.repo.listAnalyses(50);
  return apiJson(200, {
    ok: true,
    analyses: list.map((a) => ({ id: a.id, status: a.status, created_at: a.createdAt, platform: a.platform, sector: a.sector, platform_risk_level: a.metaRiskLevel, legal_risk_level: a.legalRiskLevel, creative_score: a.creativeScore })),
  });
}
