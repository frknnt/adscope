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

/** viewer: read only. editor: may start analyses and generate, charged to the team owner's balance. */
export type TeamRole = "viewer" | "editor";
export const TEAM_ROLES = ["viewer", "editor"] as const;

export interface TeamState {
  members: { memberId: string; email: string; role: TeamRole; createdAt: string }[];
  invites: { id: string; email: string; role: TeamRole; expiresAt: string }[];
  /** Teams the user belongs to. */
  memberships: { ownerId: string; ownerLabel: string; role: TeamRole; createdAt: string }[];
}

/** Client approval link (P12.1): the customer decides per item without an account. */
export type ApprovalDecision = "approved" | "changes_requested" | "rejected";
export interface ApprovalDecisionView {
  itemKey: string;
  decision: ApprovalDecision;
  reviewerName: string;
  comment: string | null;
  updatedAt: string;
}
export interface ApprovalLinkView {
  id: string;
  analysisId: string;
  note: string | null;
  itemKeys: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  decisions: ApprovalDecisionView[];
}
export interface SharedApproval {
  linkId: string;
  analysis: AnalysisDetail;
  branding: ReportBranding;
  note: string | null;
  itemKeys: string[];
  expiresAt: string;
  decisions: ApprovalDecisionView[];
}
export interface ApprovalSubmission {
  reviewerName: string;
  items: { itemKey: string; decision: ApprovalDecision; comment: string | null }[];
}
export type ApprovalSubmitResult =
  | { ok: true; ownerId: string; analysisId: string; linkId: string; itemKeys: string[]; decisions: ApprovalDecisionView[] }
  | { ok: false; code: "invalid" | "bad_items" | "error" };

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
  reason: "signup_bonus" | "analysis" | "purchase" | "refund" | "admin_adjustment" | "generation" | "coupon_bonus" | "referral_bonus" | "referral_clawback";
  note: string | null;
  analysisId: string | null;
  createdAt: string;
}

/** Audience profile of a brand (P1.3). */
export interface Audience {
  id: string;
  brandId: string;
  name: string;
  ageMin: number;
  ageMax: number;
  need: string;
  objections: string;
  tone: string;
  createdAt: string;
}
export type AudienceInput = Omit<Audience, "id" | "createdAt">;

/** A layer layout saved from the editor (P10.3); `doc` is an editor document without uploaded images. */
export interface BrandTemplate {
  id: string;
  brandId: string;
  name: string;
  doc: Record<string, unknown>;
  createdAt: string;
}
export type CreateTemplateResult = { status: "created"; template: BrandTemplate } | { status: "limit" | "brand_not_found" | "error" };

export type GenerationKind = "copy" | "creative" | "photo" | "tool" | "script" | "ai_image" | "ai_video" | "campaign" | "voiceover";

/** A paid output that is not an analysis (ad copy, creative download, product photo). */
export interface GenerationRecord {
  id: string;
  kind: GenerationKind;
  brandId: string | null;
  platform: Platform | null;
  creditCost: number;
  /** Plain JSON. Storage paths inside it (files[].path) always start with the owner's id. */
  output: Record<string, unknown>;
  createdAt: string;
}

export interface RecordGenerationInput {
  clientRequestId: string;
  kind: GenerationKind;
  creditCost: number;
  brandId: string | null;
  platform: Platform | null;
  output: Record<string, unknown>;
}

export type RecordGenerationResult =
  | { status: "created" | "exists"; generation: GenerationRecord }
  | { status: "insufficient_credits" | "brand_not_found" | "error" };

/** An imported Ads Manager report (P4.1). Only per-ad totals are stored, never the file. */
export interface PerformanceImport {
  id: string;
  label: string;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  adCount: number;
  /** Opt-in: anonymous totals may be used to calibrate creative score weights. Off by default. */
  shareConsent: boolean;
  createdAt: string;
}

export interface PerformanceRow {
  id: string;
  adName: string;
  /** The user's own AdScope analysis whose text matched this ad. */
  analysisId: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface PerformanceImportInput {
  label: string;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  shareConsent: boolean;
  rows: Omit<PerformanceRow, "id">[];
}

/** Weekly competitor watch on a Meta Ad Library search term (P4.2). */
export interface CompetitorAdSummary {
  id: string;
  pageName: string;
  title: string;
  body: string;
  deliveryStart: string | null;
  days: number;
  libraryUrl: string;
}
export interface CompetitorSummary {
  newCount: number;
  activeCount: number;
  longest: CompetitorAdSummary[];
}
export interface CompetitorWatch {
  id: string;
  term: string;
  country: string;
  lastCheckedAt: string | null;
  lastSummary: CompetitorSummary | null;
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

export type AuthResult = { ok: true; needsConfirmation?: boolean; userId?: string } | { ok: false; code: "invalid_credentials" | "exists" | "weak_password" | "not_confirmed" | "error" };

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
  /** Audience profiles of the user's brands (or of one brand). */
  listAudiences(brandId?: string): Promise<Audience[]>;
  createAudience(input: AudienceInput): Promise<Audience | null>;
  deleteAudience(id: string): Promise<boolean>;
  /** Saved editor layouts of the user's brands (or of one brand), newest first. At most 30 per brand. */
  listBrandTemplates(brandId?: string): Promise<BrandTemplate[]>;
  getBrandTemplate(id: string): Promise<BrandTemplate | null>;
  createBrandTemplate(input: { brandId: string; name: string; doc: Record<string, unknown> }): Promise<CreateTemplateResult>;
  deleteBrandTemplate(id: string): Promise<boolean>;
  /** Stores a paid output and charges its credits in one step; idempotent per client request id. */
  recordGeneration(input: RecordGenerationInput): Promise<RecordGenerationResult>;
  getGenerationByRequest(clientRequestId: string): Promise<GenerationRecord | null>;
  getGeneration(id: string): Promise<GenerationRecord | null>;
  listGenerations(kind: GenerationKind, limit?: number): Promise<GenerationRecord[]>;
  /** Stores a generated file under the caller's own folder (`<uid>/generations/...`). */
  saveGenerationFile(name: string, bytes: Uint8Array, mime: string): Promise<string | null>;
  /** Reads a file of the caller's own generation; null unless the path is listed in its output. */
  readGenerationFile(generationId: string, path: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
  removeGenerationFiles(paths: string[]): Promise<void>;
  listPurchases(): Promise<PurchaseRecord[]>;

  listPerformanceImports(): Promise<PerformanceImport[]>;
  getPerformanceImport(id: string): Promise<{ import: PerformanceImport; rows: PerformanceRow[] } | null>;
  savePerformanceImport(input: PerformanceImportInput): Promise<{ id: string } | "limit" | "error">;
  setPerformanceShareConsent(id: string, on: boolean): Promise<boolean>;
  deletePerformanceImport(id: string): Promise<boolean>;

  listWatches(): Promise<CompetitorWatch[]>;
  addWatch(term: string, country: string): Promise<"ok" | "limit" | "exists" | "error">;
  deleteWatch(id: string): Promise<boolean>;

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
  createTeamInvite(email: string, tokenHash: string, expiresAt: string, role?: TeamRole): Promise<"ok" | "limit" | "self" | "exists" | "error">;
  /** Owner only: switches a member between viewer and editor. */
  setTeamMemberRole(memberId: string, role: TeamRole): Promise<boolean>;
  deleteTeamInvite(id: string): Promise<boolean>;
  removeTeamMember(memberId: string): Promise<boolean>;
  leaveTeam(ownerId: string): Promise<boolean>;
  /** Accepts an invite addressed to the signed-in user's e-mail. */
  acceptTeamInvite(tokenHash: string): Promise<"ok" | "invalid" | "wrong_email" | "self" | "error">;

  createReviewShare(analysisId: string, tokenHash: string, expiresAt: string, note: string | null): Promise<boolean>;
  listReviewShares(analysisId: string): Promise<ReviewShare[]>;
  revokeReviewShare(id: string): Promise<boolean>;

  /** Client approval links of the user's own completed analysis; itemKeys are fixed at creation. */
  createApprovalLink(analysisId: string, tokenHash: string, expiresAt: string, note: string | null, itemKeys: string[]): Promise<boolean>;
  listApprovalLinks(analysisId: string): Promise<ApprovalLinkView[]>;
  revokeApprovalLink(id: string): Promise<boolean>;
  /** Every approval link and decision of the user's own analyses (for list badges). */
  listApprovalOverview(): Promise<{ analysisId: string; itemKeys: string[]; decisions: ApprovalDecisionView[] }[]>;

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

/** Admin panel rows (P4.3). Ad creatives are never part of them. */
export interface AdminUserRow {
  id: string;
  email: string;
  createdAt: string;
  balance: number;
  analyses: number;
}
export interface AdminPurchaseRow extends PurchaseRecord {
  userId: string | null;
  eventId: string;
}
export interface AdminFeedbackRow {
  ruleId: string;
  title: string;
  total: number;
  wrong: number;
  unclear: number;
  helpful: number;
}
export interface AdminErrorStats {
  analyses: { total: number; failed: number; byCode: Record<string, number> };
  aiRuns: { total: number; failed: number; schemaInvalid: number; fallback: number };
}
export interface AdminAuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetUserId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

// Growth: coupons, invites, partner commissions (P5.1, P5.2) ------------------------------------
export type CouponKind = "bonus_credits" | "percent" | "fixed";
export interface CouponInput {
  code: string;
  kind: CouponKind;
  /** bonus_credits: credits; percent: 1..100; fixed: kuruş. */
  value: number;
  packageIds: string[];
  startsAt: string;
  expiresAt: string | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  campaignLabel: string | null;
}
export interface CouponView extends CouponInput {
  id: string;
  active: boolean;
  /** Applied redemptions. */
  redeemed: number;
  createdAt: string;
}
export type CouponReserveStatus = "ok" | "invalid" | "wrong_package" | "unsupported" | "used" | "exhausted";
export interface CouponReservation {
  code: string;
  packageId: string;
  value: number;
  createdAt: string;
}
export interface ActiveCampaign {
  code: string;
  label: string;
  value: number;
  packageIds: string[];
  expiresAt: string | null;
}
export interface CommissionView {
  id: string;
  amountMinor: number;
  commissionBp: number;
  commissionMinor: number;
  currency: string;
  status: "pending" | "paid" | "reversed";
  isDemo: boolean;
  createdAt: string;
}
export interface InviteOverview {
  inviteCode: string;
  partner: { code: string; commissionBp: number } | null;
  invited: number;
  rewarded: number;
  /** Net referral credits this user received (bonuses minus clawbacks). */
  earnedCredits: number;
  pendingCommissionMinor: number;
  commissions: CommissionView[];
}
export type ReferralAttach = "ok" | "invalid" | "self" | "repeat" | "exists";
export interface GrowthPurchase {
  userId: string;
  packageId: string;
  /** provider:order id, the same reference the purchase ledger entry uses. */
  purchaseRef: string;
  amountMinor: number;
  currency: string;
  isDemo: boolean;
  referralBonus: number;
}
export interface GrowthResult {
  couponCredits: number;
  referralRewarded: boolean;
  commissionRecorded: boolean;
}
export interface AdminCommissionRow extends CommissionView {
  partnerId: string;
  partnerEmail: string | null;
}

/** Privileged operations not tied to a signed-in session (webhooks, cron). Server-only. */
/** Background jobs (P7.1). The payload is never shown to users. */
export type JobKind = "webhook_delivery";
export interface JobInput {
  userId: string | null;
  kind: JobKind;
  payload: Record<string, unknown>;
  /** Same key = same job (a second enqueue is ignored). */
  dedupeKey?: string;
  maxAttempts?: number;
}
export interface JobRecord {
  id: string;
  userId: string | null;
  kind: JobKind;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
}
export type JobFinish = { ok: true; result?: Record<string, unknown> } | { ok: false; error: string; retryAt: string | null };
/** Customer webhook (P7.2). The signing secret is shown once and never returned to the browser again. */
export interface WebhookView {
  id: string;
  url: string;
  active: boolean;
  lastStatus: string | null;
  lastDeliveryAt: string | null;
  createdAt: string;
}
export interface AdminFunnel {
  signups: number;
  firstAnalysis: number;
  firstPurchase: number;
  queuedJobs: number;
  failedJobs: number;
}

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
  /** app_metadata.role of a user, read with the secret key (never from user_metadata or the browser). */
  getAppRole(userId: string): Promise<string | null>;
  adminListUsers(query?: string): Promise<AdminUserRow[]>;
  /** Adds an admin_adjustment ledger entry (append-only) and an audit log row; idempotent per request id. */
  adminAdjustCredits(p: { adminId: string; userId: string; delta: number; reason: string; requestId: string }): Promise<"ok" | "exists" | "not_found" | "negative_balance" | "error">;
  adminListPurchases(limit?: number): Promise<AdminPurchaseRow[]>;
  adminFeedbackStats(): Promise<AdminFeedbackRow[]>;
  adminErrorStats(sinceIso: string): Promise<AdminErrorStats>;
  recordAudit(e: { adminId: string; action: string; targetUserId: string | null; details: Record<string, unknown> }): Promise<void>;
  listAudit(limit?: number): Promise<AdminAuditEntry[]>;
  /** All competitor watches with their owner and the ids already seen (weekly cron). */
  listAllWatches(): Promise<(CompetitorWatch & { userId: string; seenIds: string[] })[]>;
  saveWatchResult(id: string, r: { seenIds: string[]; summary: CompetitorSummary }): Promise<void>;
  /** Confirmed e-mail address and name of a user (for digests); null when unknown. */
  getUserContact(userId: string): Promise<{ email: string; displayName: string | null } | null>;
  // Welcome series (P5.4)
  /** Accounts created since the date that did not turn the series off (confirmed e-mail addresses only). */
  listWelcomeRecipients(sinceIso: string): Promise<{ userId: string; email: string; displayName: string | null; sector: Sector | null; createdAt: string; marketing: boolean; balance: number }[]>;
  claimWelcomeEmail(userId: string, step: number): Promise<boolean>;
  releaseWelcomeEmail(userId: string, step: number): Promise<void>;
  /** One-click opt-out: welcome series, season reminders and marketing consent off (a new consent row). */
  unsubscribeEmails(userId: string): Promise<void>;
  // Growth (P5.1, P5.2). Callers pass the user id from a verified session or a verified webhook.
  /** The user's invite code, created on first use. */
  ensureInviteCode(userId: string): Promise<string>;
  getInviteOverview(userId: string): Promise<InviteOverview>;
  /** Links a new account to an invite or partner code once; blocks self invites and repeat e-mails. */
  attachReferral(p: { inviteeId: string; inviteeEmail: string; code: string }): Promise<ReferralAttach>;
  /** Gives a user a partner code with the given commission (basis points); returns the code. */
  grantPartnerCode(p: { adminId: string; userId: string; commissionBp: number }): Promise<string | null>;
  /** Atomically reserves a coupon for the user's next purchase of a package (total and per-user limits hold). */
  reserveCoupon(p: { code: string; userId: string; packageId: string }): Promise<CouponReserveStatus>;
  getCouponReservation(userId: string): Promise<CouponReservation | null>;
  releaseCouponReservation(userId: string): Promise<void>;
  /** Coupon bonus, first-purchase referral reward and partner commission; idempotent per purchase reference. */
  applyGrowthAfterPurchase(p: GrowthPurchase): Promise<GrowthResult>;
  /** Verified refund: takes back purchased, coupon and referral credits (never below zero) and reverses the commission. */
  applyRefund(p: { provider: string; orderId: string }): Promise<{ applied: boolean }>;
  createCoupon(p: CouponInput & { adminId: string }): Promise<"ok" | "exists" | "error">;
  listCoupons(): Promise<CouponView[]>;
  setCouponActive(p: { adminId: string; id: string; active: boolean }): Promise<void>;
  /** Bonus credit coupons that are active, started, unexpired and not used up, with a campaign label. */
  listActiveCampaigns(): Promise<ActiveCampaign[]>;
  adminListCommissions(limit?: number): Promise<AdminCommissionRow[]>;
  /** Lawyer review link: valid, unrevoked, unexpired token → read-only report (counts the view). */
  getSharedReview(tokenHash: string): Promise<SharedReview | null>;
  /** Creative / frame / screenshot bytes behind a valid review link (does not count a view). */
  getSharedAssetBytes(tokenHash: string, which?: number | "screenshot"): Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** Client approval link: valid, unrevoked, unexpired token → items and decisions so far. */
  getApprovalLink(tokenHash: string): Promise<SharedApproval | null>;
  getApprovalAssetBytes(tokenHash: string, which?: number): Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** Stores the customer's decisions (one per item, the latest replaces the previous). */
  submitApproval(tokenHash: string, input: ApprovalSubmission): Promise<ApprovalSubmitResult>;
  /** Role of a member in an owner's team (null when not a member). */
  getTeamMembership(ownerId: string, memberId: string): Promise<{ role: TeamRole; ownerLabel: string } | null>;
  /** API key → the key owner (touches last_used_at). Null when unknown or revoked. */
  resolveApiKey(keyHash: string): Promise<SessionUser | null>;
  /**
   * A data repo acting as this user without a browser session (enterprise API, editor workspace).
   * actorId: the team editor who acts in the owner's workspace; recorded as created_by.
   */
  repoForUser(user: SessionUser, opts?: { actorId?: string }): DataRepo;
  // Scale (P7.1) --------------------------------------------------------------------------------
  /** Shared fixed-window limiter across instances. Keys are hashes, never raw e-mails or IPs. */
  rateLimitHit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfterSec: number }>;
  /** Drops limiter buckets older than a day and finished jobs older than 30 days. */
  purgeScaleTables(): Promise<void>;
  /** Returns the job id, or null when a job with the same dedupe key already exists. */
  enqueueJob(j: JobInput): Promise<string | null>;
  /** Locks up to `limit` due jobs for `lockSec` seconds (skip locked); expired locks are reclaimed. */
  claimJobs(limit: number, lockSec: number): Promise<JobRecord[]>;
  finishJob(id: string, r: JobFinish): Promise<void>;
  // Enterprise API (P7.2) ----------------------------------------------------------------------
  listWebhooks(userId: string): Promise<WebhookView[]>;
  createWebhook(userId: string, url: string, secret: string): Promise<"ok" | "limit" | "error">;
  deleteWebhook(userId: string, id: string): Promise<boolean>;
  /** Server-only: the target with its signing secret. */
  getWebhookTarget(userId: string, id: string): Promise<{ id: string; url: string; secret: string; active: boolean } | null>;
  recordWebhookDelivery(id: string, status: string): Promise<void>;
  /** API calls per day (Europe/Istanbul) for the user's keys, oldest first, `days` days including today. */
  getApiUsage(userId: string, days: number): Promise<{ day: string; count: number }[]>;
  // Analytics (P7.3) ---------------------------------------------------------------------------
  /** Accounts created since the date, how many ran an analysis and how many bought credits (no personal data). */
  adminFunnel(sinceIso: string): Promise<AdminFunnel>;
}
