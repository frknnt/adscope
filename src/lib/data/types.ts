import type { AnalysisResult, AppealOut, ImageMeta, Level, RuleRecord, VideoMeta } from "@/lib/engine/types";
import type { Sector } from "@/lib/rules/catalog";
import type { Platform } from "@/lib/platforms";
import type { BrandFontId } from "@/lib/brand/kit";

export interface SessionUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  companyName: string | null;
  defaultSector: Sector | null;
  onboardingCompletedAt: string | null;
  retentionDays: number;
  /** Opt-in: e-mail before season events (Sezon takvimi). */
  seasonReminders: boolean;
  /** Monthly regulation newsletter (latest marketing e-mail consent). */
  newsletter: boolean;
}

export interface Brand {
  id: string;
  name: string;
  sector: Sector;
  tone: "samimi" | "kurumsal" | "genc";
  bannedWords: string[];
  voiceNotes: string | null;
  preferredCta: string | null;
  hasLogo: boolean;
  /** Brand kit (P1.1). Colours are "#rrggbb"; font is one of BRAND_FONT_IDS. */
  primaryColor: string | null;
  secondaryColor: string | null;
  font: BrandFontId | null;
  tagline: string | null;
  audienceNote: string | null;
  /** Phrases every ad of this brand must carry (e.g. "Kampanya stokla sınırlıdır."). */
  requiredPhrases: string[];
  website: string | null;
}

export const BRAND_KIT_KEYS = ["primaryColor", "secondaryColor", "font", "tagline", "audienceNote", "requiredPhrases", "website"] as const;

export type BrandInput = Pick<Brand, "name" | "sector" | "tone"> &
  Partial<Pick<Brand, "bannedWords" | "voiceNotes" | "preferredCta" | (typeof BRAND_KIT_KEYS)[number]>>;

export interface ReportBranding {
  brandName: string | null;
  /** Company name of the account that owns the analysis (agency name). */
  agencyName: string | null;
  logo: { bytes: Uint8Array; mime: string } | null;
}

export type FeedbackVerdict = "wrong" | "unclear" | "helpful";
export type FeedbackReason = "not_in_ad" | "context_ok" | "rule_outdated" | "other";
export interface FindingFeedback {
  findingId: string;
  verdict: FeedbackVerdict;
  reason: FeedbackReason | null;
  note: string | null;
}

export interface TeamState {
  members: { memberId: string; email: string; createdAt: string }[];
  invites: { id: string; email: string; expiresAt: string }[];
  /** Teams the user belongs to as a viewer. */
  memberships: { ownerId: string; ownerLabel: string; createdAt: string }[];
}

export interface ReviewShare {
  id: string;
  analysisId: string;
  note: string | null;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
}

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** An ad saved from the Meta Ad Library to the inspiration board. */
export interface InspirationPin {
  id: string;
  adArchiveId: string;
  pageName: string;
  title: string;
  body: string;
  country: string;
  deliveryStart: string | null;
  note: string;
  createdAt: string;
}
export type InspirationPinInput = Omit<InspirationPin, "id" | "createdAt">;

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: "signup_bonus" | "analysis" | "purchase" | "refund" | "admin_adjustment";
  note: string | null;
  analysisId: string | null;
  createdAt: string;
}

export interface PurchaseRecord {
  id: string;
  provider: string;
  packageId: string;
  credits: number;
  amountMinor: number;
  currency: string;
  status: string;
  isDemo: boolean;
  createdAt: string;
}

export interface AnalysisSummary {
  id: string;
  status: "processing" | "completed" | "failed";
  failureCode: string | null;
  sector: Sector;
  headline: string;
  primaryText: string;
  metaRiskScore: number | null;
  metaRiskLevel: Level | null;
  legalRiskLevel: Level | null;
  legalFindingCount: number | null;
  creativeScore: number | null;
  mediaType: "image" | "video";
  platform: Platform;
  brandId: string | null;
  createdAt: string;
  expiresAt: string | null;
  /** False when a team member is viewing someone else's analysis. */
  ownedByMe: boolean;
}

export interface FindingView {
  id: string;
  domain: "meta_policy" | "tr_law" | "creative_quality";
  severity: "red" | "yellow" | "info";
  field: string | null;
  matchedText: string | null;
  title: string;
  explanation: string;
  suggestion: string;
  origin: string;
  rule: {
    id: string;
    version: number;
    status: RuleRecord["status"];
    sourceOrg: string;
    sourceTitle: string;
    sourceUrl: string;
    sourceReference: string | null;
    effectiveDate: string | null;
    lastVerifiedAt: string | null;
    legalReviewStatus: string;
  } | null;
}

export interface VariantView {
  kind: "safe" | "variant";
  position: number;
  tone: string;
  headline: string;
  primaryText: string;
  description: string;
  recheckRed: number;
  recheckYellow: number;
}

export interface AnalysisDetail extends AnalysisSummary {
  description: string;
  rejectionMessage: string | null;
  safeText: string | null;
  scoreBreakdown: AnalysisResult["score_breakdown"] | null;
  engineVersion: string | null;
  aiProvider: string | null;
  demo: boolean;
  completedAt: string | null;
  findings: FindingView[];
  variants: VariantView[];
  appeal: (AppealOut & { createdAt: string }) | null;
  asset: { id: string; mime: string; width: number | null; height: number | null; sizeBytes: number } | null;
  /** Still frames extracted in the browser from a video (the video itself is never uploaded). */
  frames: FrameView[];
  videoMeta: VideoMeta | null;
  transcript: string | null;
  landingUrl: string | null;
  /** Speech-to-text of the video's audio, when the user opted in. */
  speechTranscript: string | null;
  hasLandingScreenshot: boolean;
  creditCost: number;
  brandId: string | null;
}

export interface FrameView {
  index: number;
  timeMs: number;
  width: number | null;
  height: number | null;
}

export interface AssetUploadOptions {
  kind: "creative" | "video_frame" | "landing_screenshot";
  frameIndex?: number;
  frameTimeMs?: number;
}

export interface StartAnalysisParams {
  clientRequestId: string;
  brandId: string | null;
  sector: Sector;
  headline: string;
  primaryText: string;
  description: string;
  rejectionMessage: string | null;
  demo: boolean;
  hourlyLimit: number;
  mediaType: "image" | "video";
  videoMeta: VideoMeta | null;
  transcript: string | null;
  landingUrl: string | null;
  /** Credits this analysis consumes on completion (video = 2). */
  creditCost: number;
  /** Default Meta. */
  platform?: Platform;
}

export type StartAnalysisResult =
  | { ok: true; analysisId: string; status: AnalysisSummary["status"]; created: boolean }
  | { ok: false; code: "insufficient_credits" | "rate_limited" | "brand_not_found" | "error" };

export interface AiRunRecord {
  analysisId: string | null;
  provider: string;
  model: string | null;
  purpose: "analysis" | "appeal";
  status: "succeeded" | "failed" | "schema_invalid" | "fallback";
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string | null;
}

export interface SignUpInput {
  email: string;
  password: string;
  consents: { terms: string; kvkk: string; privacy: string; marketing: boolean };
}

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; code: "invalid_credentials" | "exists" | "weak_password" | "not_confirmed" | "error" };

/** User-scoped data access. Every method acts as the signed-in user only. */
export interface DataRepo {
  readonly backend: "supabase" | "memory";
  getUser(): Promise<SessionUser | null>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;

  getProfile(): Promise<Profile | null>;
  updateProfile(patch: Partial<Pick<Profile, "displayName" | "companyName" | "defaultSector" | "onboardingCompletedAt" | "retentionDays" | "seasonReminders">>): Promise<boolean>;
  /** Records a new marketing e-mail consent row (monthly regulation newsletter). */
  setNewsletter(enabled: boolean, documentVersion: string): Promise<boolean>;
  /** Records the pre-information and distance sales consents given right before a paid checkout. */
  recordCheckoutConsent(versions: { preInfo: string; distanceSales: string }): Promise<boolean>;
  /** The user's own brands. */
  listBrands(): Promise<Brand[]>;
  createBrand(input: BrandInput): Promise<Brand | null>;
  updateBrand(id: string, patch: Partial<BrandInput>): Promise<boolean>;
  deleteBrand(id: string): Promise<boolean>;
  /** Stores a validated logo image for one of the user's brands (null removes it). */
  setBrandLogo(id: string, logo: { bytes: Uint8Array; mime: string; ext: string } | null): Promise<boolean>;
  getBrandLogo(id: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** Brand and agency details for report headers and the PDF (analysis must be visible to the user). */
  getReportBranding(analysisId: string): Promise<ReportBranding | null>;

  getRules(sector: Sector): Promise<RuleRecord[]>;
  listAllRules(): Promise<RuleRecord[]>;

  getBalance(): Promise<number>;
  listLedger(): Promise<LedgerEntry[]>;
  listPurchases(): Promise<PurchaseRecord[]>;

  startAnalysis(params: StartAnalysisParams): Promise<StartAnalysisResult>;
  uploadAsset(analysisId: string, bytes: Uint8Array, meta: ImageMeta, ext: string, sha256: string, opts?: AssetUploadOptions): Promise<boolean>;
  completeAnalysis(analysisId: string, result: AnalysisResult): Promise<"completed" | "already_completed" | "already_failed" | "insufficient_credits" | "error">;
  failAnalysis(analysisId: string, code: string): Promise<void>;
  recordAiRun(run: AiRunRecord): Promise<void>;

  /** The user's own analyses. */
  listAnalyses(limit?: number): Promise<AnalysisSummary[]>;
  /** Analyses of the teams the user is a viewer of. */
  listTeamAnalyses(limit?: number): Promise<(AnalysisSummary & { ownerLabel: string })[]>;
  getAnalysis(id: string): Promise<AnalysisDetail | null>;
  /** The creative image, one video frame (frame index) or the landing page screenshot. */
  getAssetBytes(analysisId: string, which?: number | "screenshot"): Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** Stores the speech-to-text result of a video (server sets it; users have no update grant). */
  setSpeechTranscript(analysisId: string, text: string): Promise<boolean>;
  deleteAnalysis(id: string): Promise<boolean>;
  saveAppeal(analysisId: string, appeal: AppealOut): Promise<boolean>;

  listFindingFeedback(analysisId: string): Promise<FindingFeedback[]>;
  saveFindingFeedback(analysisId: string, fb: FindingFeedback): Promise<boolean>;

  getTeam(): Promise<TeamState>;
  /** Stores the SHA-256 of an invite token for an e-mail address. */
  createTeamInvite(email: string, tokenHash: string, expiresAt: string): Promise<"ok" | "limit" | "self" | "exists" | "error">;
  deleteTeamInvite(id: string): Promise<boolean>;
  removeTeamMember(memberId: string): Promise<boolean>;
  leaveTeam(ownerId: string): Promise<boolean>;
  /** Accepts an invite addressed to the signed-in user's e-mail. */
  acceptTeamInvite(tokenHash: string): Promise<"ok" | "invalid" | "wrong_email" | "self" | "error">;

  createReviewShare(analysisId: string, tokenHash: string, expiresAt: string, note: string | null): Promise<boolean>;
  listReviewShares(analysisId: string): Promise<ReviewShare[]>;
  revokeReviewShare(id: string): Promise<boolean>;

  listApiKeys(): Promise<ApiKeyView[]>;
  createApiKey(name: string, prefix: string, keyHash: string): Promise<"ok" | "limit" | "error">;
  revokeApiKey(id: string): Promise<boolean>;

  listPins(): Promise<InspirationPin[]>;
  savePin(pin: InspirationPinInput): Promise<"ok" | "exists" | "limit" | "error">;
  deletePin(id: string): Promise<boolean>;

  applyDemoPurchase(packageId: string, eventId: string): Promise<{ applied: boolean }>;
  deleteAccount(): Promise<boolean>;
}

export interface SharedReview {
  analysis: AnalysisDetail;
  branding: ReportBranding;
  note: string | null;
  expiresAt: string;
}

/** Privileged operations not tied to a signed-in session (webhooks, cron). Server-only. */
export interface AdminRepo {
  applyPurchase(p: {
    provider: string;
    eventId: string;
    orderId: string;
    userId: string;
    packageId: string;
    credits: number;
    amountMinor: number;
    currency: string;
    isDemo: boolean;
  }): Promise<{ applied: boolean }>;
  purgeExpired(): Promise<number>;
  /** Users who opted in to season reminder e-mails (confirmed e-mail addresses only). */
  listSeasonReminderRecipients(): Promise<{ userId: string; email: string; displayName: string | null; sector: Sector | null }[]>;
  /** Claims a (user, event) reminder. Returns false if it was already sent (idempotent cron). */
  claimSeasonReminder(userId: string, eventKey: string): Promise<boolean>;
  /** Releases a claim after a failed send so the next run retries. */
  releaseSeasonReminder(userId: string, eventKey: string): Promise<void>;
  /** Users whose latest marketing e-mail consent is granted (confirmed e-mail addresses only). */
  listNewsletterRecipients(): Promise<{ userId: string; email: string; displayName: string | null; sector: Sector | null }[]>;
  claimNewsletter(userId: string, period: string): Promise<boolean>;
  releaseNewsletter(userId: string, period: string): Promise<void>;
  /** Lawyer review link: valid, unrevoked, unexpired token → read-only report (counts the view). */
  getSharedReview(tokenHash: string): Promise<SharedReview | null>;
  /** Creative / frame / screenshot bytes behind a valid review link (does not count a view). */
  getSharedAssetBytes(tokenHash: string, which?: number | "screenshot"): Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** API key → the key owner (touches last_used_at). Null when unknown or revoked. */
  resolveApiKey(keyHash: string): Promise<SessionUser | null>;
  /** A data repo acting as this user without a browser session (enterprise API). */
  repoForUser(user: SessionUser): DataRepo;
}
