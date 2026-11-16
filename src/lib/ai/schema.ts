import { z } from "zod";

/**
 * Structured output contract for any AI provider. Every provider response is validated
 * against this schema before use; anything that fails validation is discarded and the
 * deterministic engine result is used instead.
 */
export const AiFindingSchema = z.object({
  rule_id: z.string().min(3).max(64),
  field: z.enum(["headline", "primary_text", "description", "image", "transcript"]),
  matched_text: z.string().max(300).nullable(),
  explanation_tr: z.string().min(10).max(600),
  suggestion_tr: z.string().min(5).max(400),
});

export const AiVariantSchema = z.object({
  tone: z.string().min(2).max(30),
  headline: z.string().min(2).max(60),
  primary_text: z.string().min(10).max(500),
  description: z.string().max(60),
});

export const AiAnalysisSchema = z.object({
  findings: z.array(AiFindingSchema).max(20),
  visual: z.object({
    text_density: z.number().int().min(0).max(10),
    product_visibility: z.number().int().min(0).max(10),
    brand_consistency: z.number().int().min(0).max(10),
    notes_tr: z.string().min(5).max(400),
  }),
  safe_text: z.string().min(10).max(600),
  variants: z.array(AiVariantSchema).length(5),
});

export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;
