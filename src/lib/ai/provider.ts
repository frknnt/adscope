import type { AdInput, ImageMeta, RuleRecord } from "@/lib/engine/types";
import type { AiAnalysis } from "./schema";

export interface AiRequest {
  input: AdInput;
  /** Only rules the model may cite. Anything else in the response is dropped. */
  rules: Pick<RuleRecord, "id" | "title" | "description" | "riskyExamples" | "domain" | "status">[];
  /** One image creative, or up to 4 frames of a video in time order. */
  images?: { base64: string; mime: ImageMeta["mime"]; label?: string }[];
}

export interface AiRunMeta {
  provider: string;
  model: string | null;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export type AiResult =
  | { ok: true; data: AiAnalysis; meta: AiRunMeta }
  | { ok: false; reason: "not_configured" | "api_error" | "schema_invalid" | "refusal" | "timeout"; meta: AiRunMeta };

/** Provider-agnostic interface. Implementations must never log prompts, images or user text. */
export interface AiProvider {
  readonly name: string;
  readonly enabled: boolean;
  analyze(req: AiRequest): Promise<AiResult>;
}
