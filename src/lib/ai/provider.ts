import type { AdInput, ImageMeta, RuleRecord } from "@/lib/engine/types";
import type { AiAnalysis, AiScreenshot } from "./schema";
import type { AiAudience, AiCopy } from "@/lib/copy/schema";

/** Ad copy request (P1.2). Page text and user text are data, never instructions. */
export interface AiCopyRequest {
  platform: string;
  sector: string;
  limits: { headline: number; primaryText: number; description: number; cta: number };
  product: { name: string; summary: string; points: string[]; pageText: string };
  brand: { name: string; tone: string; tagline: string | null; preferredCta: string | null; audienceNote: string | null; bannedWords: string[]; requiredPhrases: string[] } | null;
  audience: { name: string; ageMin: number; ageMax: number; need: string; objections: string; tone: string } | null;
  /** Wording that must not appear (risky examples of the active rule cards). */
  avoid: string[];
}

export type AiTextResult<T> = { ok: true; data: T; meta: AiRunMeta } | { ok: false; reason: string; meta: AiRunMeta };

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
  /** Reads the visible text of a landing page screenshot. Optional: providers without vision may omit it. */
  generateCopy?(req: AiCopyRequest): Promise<AiTextResult<AiCopy>>;
  suggestAudiences?(req: { siteName: string; summary: string; pageText: string; sector: string }): Promise<AiTextResult<AiAudience>>;
  readScreenshot?(image: { base64: string; mime: ImageMeta["mime"] }): Promise<{ ok: true; data: AiScreenshot; meta: AiRunMeta } | { ok: false; reason: string; meta: AiRunMeta }>;
}
