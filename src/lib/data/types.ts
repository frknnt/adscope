import type { AnalysisResult, AppealOut, ImageMeta, Level, RuleRecord } from "@/lib/engine/types";
import type { Sector } from "@/lib/rules/catalog";

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
}

export interface Brand {
  id: string;
  name: string;
  sector: Sector;
  tone: "samimi" | "kurumsal" | "genc";
}

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
  createdAt: string;
  expiresAt: string | null;
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
  updateProfile(patch: Partial<Pick<Profile, "displayName" | "companyName" | "defaultSector" | "onboardingCompletedAt" | "retentionDays">>): Promise<boolean>;
  listBrands(): Promise<Brand[]>;
  createBrand(input: Omit<Brand, "id">): Promise<Brand | null>;

  getRules(sector: Sector): Promise<RuleRecord[]>;
  listAllRules(): Promise<RuleRecord[]>;

  getBalance(): Promise<number>;
  listLedger(): Promise<LedgerEntry[]>;
  listPurchases(): Promise<PurchaseRecord[]>;

  startAnalysis(params: StartAnalysisParams): Promise<StartAnalysisResult>;
  uploadAsset(analysisId: string, bytes: Uint8Array, meta: ImageMeta, ext: string, sha256: string): Promise<boolean>;
  completeAnalysis(analysisId: string, result: AnalysisResult): Promise<"completed" | "already_completed" | "already_failed" | "insufficient_credits" | "error">;
  failAnalysis(analysisId: string, code: string): Promise<void>;
  recordAiRun(run: AiRunRecord): Promise<void>;

  listAnalyses(limit?: number): Promise<AnalysisSummary[]>;
  getAnalysis(id: string): Promise<AnalysisDetail | null>;
  getAssetBytes(analysisId: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
  deleteAnalysis(id: string): Promise<boolean>;
  saveAppeal(analysisId: string, appeal: AppealOut): Promise<boolean>;

  applyDemoPurchase(packageId: string, eventId: string): Promise<{ applied: boolean }>;
  deleteAccount(): Promise<boolean>;
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
}
