import type { RuleCardDef, Sector } from "@/lib/rules/catalog";

export type Severity = "red" | "yellow" | "info";
export type Field = "headline" | "primary_text" | "description" | "image" | "general" | "transcript" | "landing_page" | "video";
export type Level = "low" | "medium" | "high";

/** A rule as loaded from the database (or the catalog in demo mode). */
export interface RuleRecord extends RuleCardDef {
  versionId: string;
}

export interface AdInput {
  sector: Sector;
  headline: string;
  primaryText: string;
  description: string;
  brandName?: string | null;
  tone?: "samimi" | "kurumsal" | "genc";
  rejectionMessage?: string | null;
  flags: {
    influencerPost: boolean;
    aiHumanCharacter: boolean;
    aiRealPersonCopy: boolean;
  };
  image?: ImageMeta | null;
  /** Set for video/Reels analyses (metadata measured in the browser; frames are uploaded separately). */
  video?: VideoMeta | null;
  /** Voice-over and on-screen text of a video, typed or pasted by the user. */
  transcript?: string | null;
  /** Landing page text and metadata, fetched server-side. */
  landing?: LandingSnapshot | null;
}

export interface VideoMeta {
  mime: "video/mp4" | "video/quicktime" | "video/webm";
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  frameCount: number;
}

export type LandingStatus = "ok" | "http_error" | "blocked" | "unreachable" | "not_html" | "too_large" | "timeout" | "invalid_url";

export interface LandingSnapshot {
  requestedUrl: string;
  finalUrl: string | null;
  status: LandingStatus;
  httpStatus: number | null;
  https: boolean;
  title: string;
  description: string;
  h1: string[];
  /** Visible text, collapsed and truncated. Never stored; used only for checks. */
  text: string;
  fetchedAt: string;
}

export interface LandingCheck {
  key: string;
  label: string;
  ok: boolean | null; // null = not applicable
  detail: string;
}

export interface LandingReport {
  requestedUrl: string;
  finalUrl: string | null;
  status: LandingStatus;
  httpStatus: number | null;
  title: string;
  fetchedAt: string;
  checks: LandingCheck[];
}

export interface ImageMeta {
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
}

export interface EngineFinding {
  ruleId: string | null;
  ruleVersionId: string | null;
  ruleStatus: RuleRecord["status"] | null;
  domain: "meta_policy" | "tr_law" | "creative_quality";
  severity: Severity;
  field: Field;
  matchedText: string | null;
  title: string;
  explanation: string;
  suggestion: string;
  origin: "rule_engine" | "ai" | "heuristic";
}

export interface CreativeSubScore {
  key: string;
  label: string;
  score: number;
  max: number;
  reason: string;
}

export interface ScoreBreakdown {
  meta: { base: number; baseReason: string; items: { ruleId: string; title: string; points: number }[] };
  legal: { activeFindings: number; unverifiedFlags: number; reason: string };
  creative: CreativeSubScore[];
  visualReviewedByAi: boolean;
  media?: "image" | "video";
  landing?: LandingReport | null;
}

export interface VariantOut {
  kind: "safe" | "variant";
  position: number;
  tone: string;
  headline: string;
  primary_text: string;
  description: string;
  recheck_red: number;
  recheck_yellow: number;
}

export interface AppealOut {
  rejection_message: string;
  detected_policies: string[];
  recommendation: "appeal" | "new_ad";
  explanation_tr: string;
  draft_tr: string;
  draft_en: string;
  checklist: { label: string; done: boolean }[];
}

export interface AnalysisResult {
  engine_version: string;
  ai_provider: string;
  meta_risk_score: number;
  meta_risk_level: Level;
  legal_risk_level: Level;
  legal_finding_count: number;
  creative_score: number;
  score_breakdown: ScoreBreakdown;
  safe_text: string;
  findings: (Omit<EngineFinding, "ruleId" | "ruleStatus" | "ruleVersionId" | "matchedText"> & {
    rule_version_id: string | null;
    matched_text: string | null;
  })[];
  variants: VariantOut[];
  appeal?: AppealOut;
}
