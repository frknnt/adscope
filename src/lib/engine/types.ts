import type { RuleCardDef, Sector } from "@/lib/rules/catalog";

export type Severity = "red" | "yellow" | "info";
export type Field = "headline" | "primary_text" | "description" | "image" | "general" | "transcript" | "speech" | "landing_page" | "video";
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
  /** Speech-to-text of the video's audio (only when the user opted in and a provider is configured). */
  speech?: SpeechTranscript | null;
  /** Date the analysis runs (YYYY-MM-DD, Europe/Istanbul); used for season notes. */
  today?: string;
}

/** Measured in the browser from the video's audio track. */
export interface AudioInfo {
  /** false when the browser could not decode the audio (no track or unsupported codec). */
  analyzed: boolean;
  present: boolean;
  /** Seconds until the first audible sound, null when silent. */
  firstSoundSec: number | null;
  /** Share of 100 ms windows below the audibility threshold (0-1). */
  silentRatio: number | null;
  /** Mean level of the first 3 seconds in dBFS. */
  meanDbFirst3s: number | null;
}

export interface SpeechTranscript {
  text: string;
  segments: { start: number; end: number; text: string }[];
  provider: string;
}

export interface VideoReview {
  reviewedByAi: boolean;
  hookStrength: number | null; // 0-10
  hookNote: string | null;
  hasCaptions: boolean | null;
  worksWithoutSound: boolean | null;
  safeZoneIssue: boolean | null;
  frameNotes: { frame: number; note: string }[];
  audio: AudioInfo | null;
  /** What is said in the first 3 seconds (speech-to-text), if available. */
  speechFirst3s: string | null;
  speechProvider: string | null;
}

export interface VideoMeta {
  mime: "video/mp4" | "video/quicktime" | "video/webm";
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  frameCount: number;
  audio?: AudioInfo | null;
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
  /** The HTML looks like a JavaScript app shell (content rendered in the browser, not in the HTML). */
  jsShell?: boolean;
  /** Where the text came from. */
  source?: "fetch" | "screenshot" | "fetch+screenshot";
  /** Landing page screenshot uploaded by the user: read by AI, not readable (AI off), or not a web page. */
  screenshot?: "read" | "unread" | "not_page" | null;
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
  source?: LandingSnapshot["source"];
  screenshot?: LandingSnapshot["screenshot"];
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
  video?: VideoReview | null;
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
