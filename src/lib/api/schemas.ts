import { z } from "zod";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";

/** Request body of POST /api/v1/analyses. Also the source of the OpenAPI document. */
export const AnalysisRequestSchema = z.object({
  client_request_id: z.uuid().optional().describe("Aynı değer aynı analizi döndürür (güvenli tekrar deneme)."),
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
    data_base64: z.string().min(16).max(7_200_000).describe("Görsel dosyasının base64 hâli (çözülmüş hâli en fazla 5 MB)."),
  }),
});

const Level = z.enum(["low", "medium", "high"]).nullable();
const RuleRef = z.object({ id: z.string(), version: z.number(), status: z.string(), source: z.object({ org: z.string(), title: z.string(), url: z.string() }), last_verified_at: z.string().nullable() });

export const AnalysisResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(["processing", "completed", "failed"]),
  failure_code: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  platform: z.string(),
  sector: z.string(),
  media_type: z.string(),
  credit_cost: z.number(),
  scores: z
    .object({
      platform_risk: z.object({ score: z.number().nullable(), level: Level }),
      legal_risk: z.object({ level: Level, verified_findings: z.number() }),
      creative_score: z.number().nullable(),
    })
    .nullable(),
  findings: z.array(
    z.object({
      severity: z.enum(["red", "yellow", "info"]),
      domain: z.string(),
      field: z.string().nullable(),
      matched_text: z.string().nullable(),
      title: z.string(),
      explanation: z.string(),
      suggestion: z.string(),
      origin: z.string(),
      rule: RuleRef.nullable(),
    }),
  ),
  safe_text: z.unknown(),
  variants: z.array(z.object({ kind: z.string(), tone: z.string().nullable(), headline: z.string(), primary_text: z.string(), description: z.string(), recheck: z.object({ red: z.number(), yellow: z.number() }) })),
  dm: z.unknown().nullable(),
  disclaimer: z.literal("Risk değerlendirmesidir, hukuki görüş değildir."),
});

export const ErrorSchema = z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) });

export const WebhookEventSchema = z.object({
  id: z.string().describe("Teslimat kimliği; aynı olay tekrar gelirse aynıdır."),
  type: z.literal("analysis.completed"),
  created_at: z.string(),
  data: z.object({
    analysis_id: z.uuid(),
    status: z.string(),
    platform: z.string(),
    platform_risk_level: Level,
    legal_risk_level: Level,
    creative_score: z.number().nullable(),
    report_url: z.string(),
  }),
  disclaimer: z.string(),
});
