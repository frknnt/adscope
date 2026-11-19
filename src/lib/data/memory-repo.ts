import "server-only";
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname } from "node:path";
import { cookies } from "next/headers";
import { appMode, demoSessionSecret, retentionDefaultDays } from "@/lib/env";
import type { AnalysisResult, AppealOut, ImageMeta, RuleRecord, VideoMeta } from "@/lib/engine/types";
import { RULE_CATALOG, type Sector } from "@/lib/rules/catalog";
import type { Platform } from "@/lib/platforms";
import { findPackage, SIGNUP_BONUS_CREDITS } from "@/lib/payments/packages";
import { COUPON_RESERVATION_MS, commissionOf, emailHash, newCode } from "@/lib/growth/codes";
import { API_KEY_LIMIT, PERFORMANCE_IMPORT_LIMIT, PIN_LIMIT, TEAM_LIMIT, WATCH_LIMIT, WEBHOOK_LIMIT } from "./limits";
import { rateLimit } from "@/lib/security/rate-limit";
import { istanbulDay, lastDays } from "./days";
import type {
  ActiveCampaign,
  AdminCommissionRow,
  CouponInput,
  CouponReservation,
  CouponReserveStatus,
  CouponView,
  GrowthPurchase,
  GrowthResult,
  InviteOverview,
  ReferralAttach,
  AdminRepo,
  AiRunRecord,
  AnalysisDetail,
  AnalysisSummary,
  AssetUploadOptions,
  ApiKeyView,
  InspirationPin,
  InspirationPinInput,
  AuthResult,
  Brand,
  BrandInput,
  DataRepo,
  FindingFeedback,
  ReportBranding,
  ReviewShare,
  SharedReview,
  TeamState,
  LedgerEntry,
  Profile,
  PurchaseRecord,
  SessionUser,
  StartAnalysisParams,
  StartAnalysisResult,
} from "./types";
import { BRAND_KIT_KEYS } from "./types";
import type { AdminAuditEntry, AdminErrorStats, AdminFeedbackRow, AdminFunnel, AdminPurchaseRow, AdminUserRow, JobFinish, JobInput, JobRecord, WebhookView } from "./types";
import type { CompetitorSummary, CompetitorWatch, PerformanceImport, PerformanceImportInput, PerformanceRow } from "./types";
import type { Audience, AudienceInput, GenerationKind, GenerationRecord, RecordGenerationInput, RecordGenerationResult } from "./types";

import { generationFiles } from "./generation-files";

/**
 * In-memory backend used in demo mode when Supabase is not configured. It mirrors the
 * database guarantees (one signup bonus, idempotent analyses, credit only on completion,
 * idempotent purchases, append-only ledger, per-user isolation) so the full product flow
 * works without any external account. Data lives in process memory (optionally a JSON
 * file via DEMO_STORE_FILE) and is NOT durable.
 */

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}
interface StoredAnalysis {
  id: string;
  userId: string;
  clientRequestId: string;
  brandId: string | null;
  status: AnalysisSummary["status"];
  failureCode: string | null;
  sector: Sector;
  headline: string;
  primaryText: string;
  description: string;
  rejectionMessage: string | null;
  demo: boolean;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
  result: AnalysisResult | null;
  appeal: (AppealOut & { createdAt: string }) | null;
  asset: StoredAsset | null;
  mediaType?: "image" | "video";
  videoMeta?: VideoMeta | null;
  transcript?: string | null;
  landingUrl?: string | null;
  frames?: (StoredAsset & { index: number; timeMs: number })[];
  creditCost?: number;
  speechTranscript?: string | null;
  landingScreenshot?: StoredAsset | null;
  platform?: Platform;
}
interface StoredAsset {
  id: string;
  mime: string;
  width: number;
  height: number;
  sizeBytes: number;
  dataB64: string;
}
interface Store {
  users: StoredUser[];
  profiles: Record<string, Profile>;
  brands: (Brand & { userId: string })[];
  analyses: StoredAnalysis[];
  ledger: (LedgerEntry & { userId: string; idempotencyKey: string })[];
  audiences?: (Audience & { userId: string })[];
  generations?: (GenerationRecord & { userId: string; clientRequestId: string; expiresAt: string })[];
  purchases: (PurchaseRecord & { userId: string | null; eventKey: string; orderId?: string })[];
  consents: { userId: string; type: string; version: string; granted: boolean; createdAt: string }[];
  aiRuns: (AiRunRecord & { userId: string; createdAt: string })[];
  reminderLog?: { userId: string; eventKey: string; sentAt: string }[];
  logos?: Record<string, { mime: string; dataB64: string }>;
  /** Files produced by generations (creatives, photos), keyed by storage path. */
  genFiles?: Record<string, { mime: string; dataB64: string }>;
  team?: { ownerId: string; memberId: string; email: string; createdAt: string }[];
  invites?: { id: string; ownerId: string; email: string; tokenHash: string; expiresAt: string; acceptedAt: string | null; createdAt: string }[];
  feedback?: (FindingFeedback & { userId: string; analysisId: string; createdAt: string })[];
  shares?: (ReviewShare & { userId: string; tokenHash: string })[];
  newsletterLog?: { userId: string; period: string; sentAt: string }[];
  apiKeys?: (ApiKeyView & { userId: string; keyHash: string })[];
  pins?: (InspirationPin & { userId: string })[];
  perfImports?: (PerformanceImport & { userId: string; rows: PerformanceRow[] })[];
  watches?: (CompetitorWatch & { userId: string; seenIds: string[] })[];
  audit?: AdminAuditEntry[];
  coupons?: (CouponInput & { id: string; active: boolean; createdBy: string; createdAt: string })[];
  couponRedemptions?: { id: string; couponId: string; userId: string; packageId: string; status: "reserved" | "applied" | "released"; purchaseRef: string | null; createdAt: string; appliedAt: string | null }[];
  inviteCodes?: { userId: string; kind: "invite" | "partner"; code: string; commissionBp: number | null; createdAt: string }[];
  referrals?: { inviteeId: string; inviterId: string; kind: "invite" | "partner"; rewardedAt: string | null; rewardRef: string | null; clawedBackAt: string | null; createdAt: string }[];
  emailClaims?: string[];
  welcomeLog?: { userId: string; step: number; sentAt: string }[];
  welcomeOptOut?: string[];
  commissions?: (AdminCommissionRow & { inviteeId: string | null; purchaseRef: string })[];
  jobs?: (JobRecord & { status: "queued" | "running" | "succeeded" | "failed"; runAfter: string; lockedUntil: string | null; dedupeKey: string | null; lastError: string | null; result: Record<string, unknown> | null; createdAt: string; finishedAt: string | null })[];
  webhooks?: (WebhookView & { userId: string; secret: string })[];
  apiUsage?: { keyId: string; userId: string; day: string; count: number }[];
}

type StoredBrand = Store["brands"][number];
function genView(g: NonNullable<Store["generations"]>[number]): GenerationRecord {
  return { id: g.id, kind: g.kind, brandId: g.brandId, platform: g.platform, creditCost: g.creditCost, output: structuredClone(g.output), createdAt: g.createdAt };
}
function brandView(b: StoredBrand): Brand {
  return {
    id: b.id,
    name: b.name,
    sector: b.sector,
    tone: b.tone,
    bannedWords: b.bannedWords ?? [],
    voiceNotes: b.voiceNotes ?? null,
    preferredCta: b.preferredCta ?? null,
    hasLogo: Boolean(store().logos?.[b.id]),
    primaryColor: b.primaryColor ?? null,
    secondaryColor: b.secondaryColor ?? null,
    font: b.font ?? null,
    tagline: b.tagline ?? null,
    audienceNote: b.audienceNote ?? null,
    requiredPhrases: b.requiredPhrases ?? [],
    website: b.website ?? null,
  };
}

function isTeamViewer(ownerId: string, userId: string) {
  return (store().team ?? []).some((m) => m.ownerId === ownerId && m.memberId === userId);
}

function latestMarketing(userId: string) {
  const rows = store().consents.filter((c) => c.userId === userId && c.type === "marketing_email");
  return rows.length ? rows[rows.length - 1].granted : false;
}

const COOKIE = "adscope_demo_session";
const g = globalThis as unknown as { __adscopeStore?: Store; __adscopeLocks?: Map<string, Promise<unknown>> };

function storeFile() {
  return process.env.DEMO_STORE_FILE || null;
}

/** Loaded lazily so the bundler does not trace the whole project for an optional dev-only feature. */
function fs() {
  return process.getBuiltinModule("node:fs") as typeof import("node:fs");
}

function store(): Store {
  if (!g.__adscopeStore) {
    const file = storeFile();
    if (file && fs().existsSync(file)) {
      try {
        g.__adscopeStore = JSON.parse(fs().readFileSync(file, "utf8")) as Store;
      } catch {
        /* fall through */
      }
    }
    g.__adscopeStore ??= { users: [], profiles: {}, brands: [], analyses: [], ledger: [], purchases: [], consents: [], aiRuns: [] };
  }
  return g.__adscopeStore;
}

function persist() {
  const file = storeFile();
  if (!file) return;
  try {
    fs().mkdirSync(dirname(file), { recursive: true });
    fs().writeFileSync(file, JSON.stringify(store()));
  } catch {
    /* best effort */
  }
}

/** Serialise operations per user (stands in for SELECT ... FOR UPDATE). */
async function withLock<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
  g.__adscopeLocks ??= new Map();
  const prev = g.__adscopeLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  g.__adscopeLocks.set(key, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function sign(userId: string) {
  return createHmac("sha256", demoSessionSecret()).update(userId).digest("hex");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("hex");
}

function insertLedger(e: Omit<Store["ledger"][number], "id" | "createdAt">) {
  const s = store();
  if (s.ledger.some((l) => l.idempotencyKey === e.idempotencyKey)) return false;
  s.ledger.push({ ...e, id: String(s.ledger.length + 1), createdAt: new Date().toISOString() });
  return true;
}

function balanceOf(userId: string) {
  return store().ledger.filter((l) => l.userId === userId).reduce((sum, l) => sum + l.delta, 0);
}

export function catalogRules(): RuleRecord[] {
  return RULE_CATALOG.map((r) => ({ ...r, versionId: `demo-${r.id}-v${r.version}` }));
}

function summary(a: StoredAnalysis, viewerId?: string): AnalysisSummary {
  return {
    id: a.id,
    status: a.status,
    failureCode: a.failureCode,
    sector: a.sector,
    headline: a.headline,
    primaryText: a.primaryText,
    metaRiskScore: a.result?.meta_risk_score ?? null,
    metaRiskLevel: a.result?.meta_risk_level ?? null,
    legalRiskLevel: a.result?.legal_risk_level ?? null,
    legalFindingCount: a.result?.legal_finding_count ?? null,
    creativeScore: a.result?.creative_score ?? null,
    mediaType: a.mediaType ?? "image",
    platform: a.platform ?? "meta",
    brandId: a.brandId ?? null,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    ownedByMe: viewerId === undefined || viewerId === a.userId,
  };
}

export class MemoryRepo implements DataRepo {
  readonly backend = "memory" as const;

  /** acting: act as this user without a cookie session (enterprise API). */
  constructor(private readonly acting: SessionUser | null = null) {}

  async getUser(): Promise<SessionUser | null> {
    if (this.acting) return this.acting;
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    const [id, sig] = raw.split(".");
    if (!id || !sig) return null;
    const expected = sign(id);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const u = store().users.find((x) => x.id === id);
    return u ? { id: u.id, email: u.email } : null;
  }

  private async requireUser() {
    const u = await this.getUser();
    if (!u) throw new Error("unauthenticated");
    return u;
  }

  private async setSession(userId: string) {
    (await cookies()).set(COOKIE, `${userId}.${sign(userId)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  async signUp(input: Parameters<DataRepo["signUp"]>[0]): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const s = store();
    if (s.users.some((u) => u.email === email)) return { ok: false, code: "exists" };
    if (input.password.length < 8) return { ok: false, code: "weak_password" };
    const salt = randomUUID();
    const user: StoredUser = { id: randomUUID(), email, salt, passwordHash: hashPassword(input.password, salt), createdAt: new Date().toISOString() };
    s.users.push(user);
    // Mirrors the auth.users trigger: profile + one-time bonus (idempotency key prevents a second grant).
    s.profiles[user.id] = { id: user.id, displayName: null, companyName: null, defaultSector: null, onboardingCompletedAt: null, retentionDays: retentionDefaultDays(), seasonReminders: false, newsletter: false };
    insertLedger({ userId: user.id, delta: SIGNUP_BONUS_CREDITS, reason: "signup_bonus", note: "Kayıt hediyesi: 3 ücretsiz analiz", analysisId: null, idempotencyKey: `signup_bonus:${user.id}` });
    const now = new Date().toISOString();
    s.consents.push(
      { userId: user.id, type: "terms", version: input.consents.terms, granted: true, createdAt: now },
      { userId: user.id, type: "kvkk_notice", version: input.consents.kvkk, granted: true, createdAt: now },
      { userId: user.id, type: "privacy_policy", version: input.consents.privacy, granted: true, createdAt: now },
      { userId: user.id, type: "marketing_email", version: input.consents.terms, granted: input.consents.marketing, createdAt: now },
    );
    persist();
    await this.setSession(user.id);
    return { ok: true, userId: user.id };
  }

  /** Test hook: re-running the bonus grant must not add credits twice. */
  static regrantSignupBonusForTest(userId: string) {
    return insertLedger({ userId, delta: SIGNUP_BONUS_CREDITS, reason: "signup_bonus", note: "Kayıt hediyesi", analysisId: null, idempotencyKey: `signup_bonus:${userId}` });
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const u = store().users.find((x) => x.email === email.trim().toLowerCase());
    if (!u) return { ok: false, code: "invalid_credentials" };
    const a = Buffer.from(hashPassword(password, u.salt), "hex");
    const b = Buffer.from(u.passwordHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: "invalid_credentials" };
    await this.setSession(u.id);
    return { ok: true };
  }

  async signOut() {
    (await cookies()).delete(COOKIE);
  }

  async getProfile() {
    const u = await this.getUser();
    const p = u ? store().profiles[u.id] : null;
    return p && u ? { ...p, newsletter: latestMarketing(u.id) } : null;
  }

  async recordCheckoutConsent(versions: { preInfo: string; distanceSales: string }) {
    const u = await this.requireUser();
    const now = new Date().toISOString();
    store().consents.push(
      { userId: u.id, type: "pre_information", version: versions.preInfo, granted: true, createdAt: now },
      { userId: u.id, type: "distance_sales", version: versions.distanceSales, granted: true, createdAt: now },
    );
    return true;
  }

  async setNewsletter(enabled: boolean, documentVersion: string) {
    const u = await this.requireUser();
    store().consents.push({ userId: u.id, type: "marketing_email", version: documentVersion, granted: enabled, createdAt: new Date().toISOString() });
    persist();
    return true;
  }

  async updateProfile(patch: Parameters<DataRepo["updateProfile"]>[0]) {
    const u = await this.requireUser();
    const p = store().profiles[u.id];
    if (!p) return false;
    if (patch.retentionDays !== undefined && (patch.retentionDays < 1 || patch.retentionDays > 365)) return false;
    Object.assign(p, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    persist();
    return true;
  }

  async listBrands() {
    const u = await this.requireUser();
    return store().brands.filter((b) => b.userId === u.id).map(brandView);
  }

  async createBrand(input: BrandInput) {
    const u = await this.requireUser();
    const s = store();
    if (s.brands.some((b) => b.userId === u.id && b.name === input.name)) return null;
    const b: StoredBrand = {
      id: randomUUID(),
      userId: u.id,
      name: input.name,
      sector: input.sector,
      tone: input.tone,
      bannedWords: input.bannedWords ?? [],
      voiceNotes: input.voiceNotes ?? null,
      preferredCta: input.preferredCta ?? null,
      hasLogo: false,
      primaryColor: input.primaryColor ?? null,
      secondaryColor: input.secondaryColor ?? null,
      font: input.font ?? null,
      tagline: input.tagline ?? null,
      audienceNote: input.audienceNote ?? null,
      requiredPhrases: input.requiredPhrases ?? [],
      website: input.website ?? null,
    };
    s.brands.push(b);
    persist();
    return brandView(b);
  }

  async updateBrand(id: string, patch: Partial<BrandInput>) {
    const u = await this.requireUser();
    const s = store();
    const b = s.brands.find((x) => x.id === id && x.userId === u.id);
    if (!b) return false;
    if (patch.name && s.brands.some((x) => x.userId === u.id && x.id !== id && x.name === patch.name)) return false;
    for (const k of ["name", "sector", "tone", "bannedWords", "voiceNotes", "preferredCta", ...BRAND_KIT_KEYS] as const) {
      if (patch[k] !== undefined) (b as unknown as Record<string, unknown>)[k] = patch[k];
    }
    persist();
    return true;
  }

  async deleteBrand(id: string) {
    const u = await this.requireUser();
    const s = store();
    const idx = s.brands.findIndex((x) => x.id === id && x.userId === u.id);
    if (idx < 0) return false;
    s.brands.splice(idx, 1);
    if (s.logos) delete s.logos[id];
    for (const a of s.analyses) if (a.brandId === id) a.brandId = null;
    persist();
    return true;
  }

  async setBrandLogo(id: string, logo: { bytes: Uint8Array; mime: string; ext: string } | null) {
    const u = await this.requireUser();
    const s = store();
    if (!s.brands.some((x) => x.id === id && x.userId === u.id)) return false;
    s.logos ??= {};
    if (logo) s.logos[id] = { mime: logo.mime, dataB64: Buffer.from(logo.bytes).toString("base64") };
    else delete s.logos[id];
    persist();
    return true;
  }

  async getBrandLogo(id: string) {
    const u = await this.getUser();
    if (!u) return null;
    const b = store().brands.find((x) => x.id === id);
    if (!b || (b.userId !== u.id && !isTeamViewer(b.userId, u.id))) return null;
    const l = store().logos?.[id];
    return l ? { bytes: new Uint8Array(Buffer.from(l.dataB64, "base64")), mime: l.mime } : null;
  }

  async getReportBranding(analysisId: string): Promise<ReportBranding | null> {
    const u = await this.getUser();
    if (!u) return null;
    const a = this.visible(analysisId, u.id);
    if (!a) return null;
    return brandingFor(a);
  }

  async getRules(sector: Sector) {
    return catalogRules().filter((r) => (r.status === "active" || r.status === "requires_review") && (r.sector === "genel" || r.sector === sector));
  }

  async listAllRules() {
    return catalogRules().filter((r) => r.status === "active" || r.status === "requires_review");
  }

  async getBalance() {
    const u = await this.requireUser();
    return balanceOf(u.id);
  }

  async listLedger() {
    const u = await this.requireUser();
    return store()
      .ledger.filter((l) => l.userId === u.id)
      .map(({ userId: _u, idempotencyKey: _k, ...l }) => l)
      .reverse();
  }

  async listAudiences(brandId?: string) {
    const u = await this.requireUser();
    return (store().audiences ?? []).filter((a) => a.userId === u.id && (!brandId || a.brandId === brandId)).map(({ userId: _u, ...a }) => ({ ...a }));
  }

  async createAudience(input: AudienceInput) {
    const u = await this.requireUser();
    const s = store();
    if (!s.brands.some((b) => b.id === input.brandId && b.userId === u.id)) return null;
    if (input.ageMin > input.ageMax) return null;
    s.audiences ??= [];
    if (s.audiences.filter((a) => a.brandId === input.brandId).length >= 20) return null;
    const a = { ...input, id: randomUUID(), userId: u.id, createdAt: new Date().toISOString() };
    s.audiences.push(a);
    persist();
    const { userId: _u, ...view } = a;
    return view;
  }

  async deleteAudience(id: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.audiences ?? []).length;
    s.audiences = (s.audiences ?? []).filter((a) => !(a.id === id && a.userId === u.id));
    persist();
    return s.audiences.length < before;
  }

  async recordGeneration(p: RecordGenerationInput): Promise<RecordGenerationResult> {
    const u = await this.requireUser();
    const s = store();
    s.generations ??= [];
    const existing = s.generations.find((g) => g.userId === u.id && g.clientRequestId === p.clientRequestId);
    if (existing) return { status: "exists", generation: genView(existing) };
    if (p.brandId && !s.brands.some((b) => b.id === p.brandId && b.userId === u.id)) return { status: "brand_not_found" };
    if (p.creditCost > 0 && balanceOf(u.id) < p.creditCost) return { status: "insufficient_credits" };
    const now = new Date();
    const g = {
      id: randomUUID(),
      userId: u.id,
      clientRequestId: p.clientRequestId,
      kind: p.kind,
      brandId: p.brandId,
      platform: p.platform,
      creditCost: p.creditCost,
      output: structuredClone(p.output),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 90 * 864e5).toISOString(),
    };
    s.generations.push(g);
    if (p.creditCost > 0) {
      s.ledger.push({ id: randomUUID(), userId: u.id, delta: -p.creditCost, reason: "generation", note: null, analysisId: null, idempotencyKey: `generation:${g.id}`, createdAt: g.createdAt });
    }
    persist();
    return { status: "created", generation: genView(g) };
  }

  async saveGenerationFile(name: string, bytes: Uint8Array, mime: string) {
    const u = await this.requireUser();
    const s = store();
    s.genFiles ??= {};
    const path = `${u.id}/generations/${randomUUID()}-${name.replace(/[^a-z0-9.-]/gi, "")}`;
    s.genFiles[path] = { mime, dataB64: Buffer.from(bytes).toString("base64") };
    persist();
    return path;
  }

  async readGenerationFile(generationId: string, path: string) {
    const g = await this.getGeneration(generationId);
    if (!g || !generationFiles(g.output).includes(path)) return null;
    const f = store().genFiles?.[path];
    return f ? { bytes: new Uint8Array(Buffer.from(f.dataB64, "base64")), mime: f.mime } : null;
  }

  async removeGenerationFiles(paths: string[]) {
    const u = await this.requireUser();
    const s = store();
    for (const p of paths) if (p.startsWith(`${u.id}/`)) delete s.genFiles?.[p];
    persist();
  }

  async getGenerationByRequest(clientRequestId: string) {
    const u = await this.requireUser();
    const g = (store().generations ?? []).find((x) => x.userId === u.id && x.clientRequestId === clientRequestId);
    return g ? genView(g) : null;
  }

  async getGeneration(id: string) {
    const u = await this.requireUser();
    const g = (store().generations ?? []).find((x) => x.userId === u.id && x.id === id);
    return g ? genView(g) : null;
  }

  async listGenerations(kind: GenerationKind, limit = 20) {
    const u = await this.requireUser();
    return (store().generations ?? [])
      .filter((x) => x.userId === u.id && x.kind === kind)
      .slice(-limit)
      .reverse()
      .map(genView);
  }

  async listPurchases() {
    const u = await this.requireUser();
    return store()
      .purchases.filter((p) => p.userId === u.id)
      .map(({ userId: _u, eventKey: _k, ...p }) => p)
      .reverse();
  }

  async startAnalysis(p: StartAnalysisParams): Promise<StartAnalysisResult> {
    const u = await this.requireUser();
    return withLock(u.id, () => {
      const s = store();
      const existing = s.analyses.find((a) => a.userId === u.id && a.clientRequestId === p.clientRequestId);
      if (existing) return { ok: true as const, analysisId: existing.id, status: existing.status, created: false };
      if (balanceOf(u.id) < p.creditCost) return { ok: false as const, code: "insufficient_credits" as const };
      const hourAgo = Date.now() - 3600_000;
      if (s.analyses.filter((a) => a.userId === u.id && Date.parse(a.createdAt) > hourAgo).length >= p.hourlyLimit)
        return { ok: false as const, code: "rate_limited" as const };
      if (p.brandId && !s.brands.some((b) => b.id === p.brandId && b.userId === u.id)) return { ok: false as const, code: "brand_not_found" as const };
      const retention = s.profiles[u.id]?.retentionDays ?? retentionDefaultDays();
      const a: StoredAnalysis = {
        id: randomUUID(),
        userId: u.id,
        clientRequestId: p.clientRequestId,
        brandId: p.brandId,
        status: "processing",
        failureCode: null,
        sector: p.sector,
        headline: p.headline,
        primaryText: p.primaryText,
        description: p.description,
        rejectionMessage: p.rejectionMessage,
        demo: p.demo,
        createdAt: new Date().toISOString(),
        completedAt: null,
        expiresAt: new Date(Date.now() + retention * 86400_000).toISOString(),
        result: null,
        appeal: null,
        asset: null,
        mediaType: p.mediaType,
        videoMeta: p.mediaType === "video" ? p.videoMeta : null,
        transcript: p.transcript,
        landingUrl: p.landingUrl,
        frames: [],
        creditCost: p.creditCost,
        platform: p.platform ?? "meta",
      };
      s.analyses.push(a);
      persist();
      return { ok: true as const, analysisId: a.id, status: a.status, created: true };
    });
  }

  private own(id: string, userId: string) {
    return store().analyses.find((a) => a.id === id && a.userId === userId) ?? null;
  }

  /** Own analyses and those of teams the user views. */
  private visible(id: string, userId: string) {
    const a = store().analyses.find((x) => x.id === id) ?? null;
    if (!a) return null;
    if (a.userId === userId) return a;
    // An API-key repo acts only on its own data.
    if (!this.acting && isTeamViewer(a.userId, userId)) return a;
    return null;
  }

  async uploadAsset(analysisId: string, bytes: Uint8Array, meta: ImageMeta, _ext?: string, _sha?: string, opts: AssetUploadOptions = { kind: "creative" }) {
    const u = await this.requireUser();
    const a = this.own(analysisId, u.id);
    if (!a) return false;
    const stored: StoredAsset = { id: randomUUID(), mime: meta.mime, width: meta.width, height: meta.height, sizeBytes: meta.sizeBytes, dataB64: Buffer.from(bytes).toString("base64") };
    if (opts.kind === "landing_screenshot") {
      if (a.landingScreenshot) return false;
      a.landingScreenshot = stored;
    } else if (opts.kind === "video_frame") {
      const index = opts.frameIndex ?? 0;
      a.frames = a.frames ?? [];
      if (a.frames.some((f) => f.index === index)) return false; // mirrors the unique index
      a.frames.push({ ...stored, index, timeMs: opts.frameTimeMs ?? 0 });
      a.frames.sort((x, y) => x.index - y.index);
    } else {
      if (a.asset) return false;
      a.asset = stored;
    }
    persist();
    return true;
  }

  async completeAnalysis(analysisId: string, result: AnalysisResult) {
    const u = await this.requireUser();
    return withLock(u.id, () => {
      const a = this.own(analysisId, u.id);
      if (!a) return "error" as const;
      if (a.status === "completed") return "already_completed" as const;
      if (a.status === "failed") return "already_failed" as const;
      const cost = a.creditCost ?? 1;
      if (balanceOf(u.id) < cost) {
        a.status = "failed";
        a.failureCode = "insufficient_credits";
        a.completedAt = new Date().toISOString();
        return "insufficient_credits" as const;
      }
      a.result = result;
      a.appeal = result.appeal ? { ...result.appeal, createdAt: new Date().toISOString() } : null;
      a.status = "completed";
      a.completedAt = new Date().toISOString();
      insertLedger({ userId: u.id, delta: -cost, reason: "analysis", note: a.mediaType === "video" ? "Video analizi tamamlandı" : "Analiz tamamlandı", analysisId, idempotencyKey: `analysis:${analysisId}` });
      persist();
      return "completed" as const;
    });
  }

  async failAnalysis(analysisId: string, code: string) {
    const u = await this.requireUser();
    const a = this.own(analysisId, u.id);
    if (a && a.status === "processing") {
      a.status = "failed";
      a.failureCode = code.slice(0, 64);
      a.completedAt = new Date().toISOString();
      persist();
    }
  }

  async recordAiRun(run: AiRunRecord) {
    const u = await this.getUser();
    if (u) store().aiRuns.push({ ...run, userId: u.id, createdAt: new Date().toISOString() });
  }

  async listAnalyses(limit = 100) {
    const u = await this.requireUser();
    return store()
      .analyses.filter((a) => a.userId === u.id)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .slice(0, limit)
      .map((a) => summary(a));
  }

  async listTeamAnalyses(limit = 100) {
    const u = await this.requireUser();
    const s = store();
    const owners = new Set((s.team ?? []).filter((m) => m.memberId === u.id).map((m) => m.ownerId));
    return s.analyses
      .filter((a) => owners.has(a.userId))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .slice(0, limit)
      .map((a) => ({ ...summary(a, u.id), ownerLabel: ownerLabel(a.userId) }));
  }

  async getAnalysis(id: string): Promise<AnalysisDetail | null> {
    const u = await this.getUser();
    if (!u) return null;
    const a = this.visible(id, u.id);
    if (!a) return null;
    return detailOf(a, u.id);
  }

  async getAssetBytes(analysisId: string, which?: number | "screenshot") {
    const u = await this.getUser();
    if (!u) return null;
    const a = this.visible(analysisId, u.id);
    if (!a) return null;
    const asset = which === undefined ? a.asset : which === "screenshot" ? a.landingScreenshot : (a.frames ?? []).find((f) => f.index === which);
    if (!asset) return null;
    return { bytes: new Uint8Array(Buffer.from(asset.dataB64, "base64")), mime: asset.mime };
  }

  async listFindingFeedback(analysisId: string) {
    const u = await this.requireUser();
    return (store().feedback ?? [])
      .filter((f) => f.userId === u.id && f.analysisId === analysisId)
      .map(({ findingId, verdict, reason, note }) => ({ findingId, verdict, reason, note }));
  }

  async saveFindingFeedback(analysisId: string, fb: FindingFeedback) {
    const u = await this.requireUser();
    const a = this.own(analysisId, u.id);
    if (!a || a.status !== "completed") return false;
    const idx = Number(fb.findingId.slice(a.id.length + 1));
    if (!fb.findingId.startsWith(`${a.id}-`) || !Number.isInteger(idx) || !a.result?.findings[idx]) return false;
    const s = store();
    s.feedback ??= [];
    const existing = s.feedback.find((f) => f.userId === u.id && f.findingId === fb.findingId);
    if (existing) Object.assign(existing, { verdict: fb.verdict, reason: fb.reason, note: fb.note });
    else s.feedback.push({ ...fb, userId: u.id, analysisId, createdAt: new Date().toISOString() });
    persist();
    return true;
  }

  async getTeam(): Promise<TeamState> {
    const u = await this.requireUser();
    const s = store();
    const now = Date.now();
    return {
      members: (s.team ?? []).filter((m) => m.ownerId === u.id).map((m) => ({ memberId: m.memberId, email: m.email, createdAt: m.createdAt })),
      invites: (s.invites ?? [])
        .filter((i) => i.ownerId === u.id && !i.acceptedAt && Date.parse(i.expiresAt) > now)
        .map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt })),
      memberships: (s.team ?? []).filter((m) => m.memberId === u.id).map((m) => ({ ownerId: m.ownerId, ownerLabel: ownerLabel(m.ownerId), createdAt: m.createdAt })),
    };
  }

  async createTeamInvite(email: string, tokenHash: string, expiresAt: string) {
    const u = await this.requireUser();
    const s = store();
    const e = email.trim().toLowerCase();
    if (e === u.email.toLowerCase()) return "self" as const;
    s.team ??= [];
    s.invites ??= [];
    if (s.team.some((m) => m.ownerId === u.id && m.email === e)) return "exists" as const;
    const open = s.invites.filter((i) => i.ownerId === u.id && !i.acceptedAt && Date.parse(i.expiresAt) > Date.now());
    if (s.team.filter((m) => m.ownerId === u.id).length + open.length >= TEAM_LIMIT) return "limit" as const;
    s.invites = s.invites.filter((i) => !(i.ownerId === u.id && i.email === e && !i.acceptedAt));
    s.invites.push({ id: randomUUID(), ownerId: u.id, email: e, tokenHash, expiresAt, acceptedAt: null, createdAt: new Date().toISOString() });
    persist();
    return "ok" as const;
  }

  async deleteTeamInvite(id: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.invites ?? []).length;
    s.invites = (s.invites ?? []).filter((i) => !(i.id === id && i.ownerId === u.id));
    persist();
    return s.invites.length < before;
  }

  async removeTeamMember(memberId: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.team ?? []).length;
    s.team = (s.team ?? []).filter((m) => !(m.ownerId === u.id && m.memberId === memberId));
    persist();
    return s.team.length < before;
  }

  async leaveTeam(ownerId: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.team ?? []).length;
    s.team = (s.team ?? []).filter((m) => !(m.ownerId === ownerId && m.memberId === u.id));
    persist();
    return s.team.length < before;
  }

  async acceptTeamInvite(tokenHash: string) {
    const u = await this.requireUser();
    const s = store();
    const inv = (s.invites ?? []).find((i) => i.tokenHash === tokenHash && !i.acceptedAt && Date.parse(i.expiresAt) > Date.now());
    if (!inv) return "invalid" as const;
    if (inv.ownerId === u.id) return "self" as const;
    if (inv.email !== u.email.toLowerCase()) return "wrong_email" as const;
    s.team ??= [];
    if (!s.team.some((m) => m.ownerId === inv.ownerId && m.memberId === u.id))
      s.team.push({ ownerId: inv.ownerId, memberId: u.id, email: inv.email, createdAt: new Date().toISOString() });
    inv.acceptedAt = new Date().toISOString();
    persist();
    return "ok" as const;
  }

  async createReviewShare(analysisId: string, tokenHash: string, expiresAt: string, note: string | null) {
    const u = await this.requireUser();
    const a = this.own(analysisId, u.id);
    if (!a || a.status !== "completed") return false;
    const s = store();
    s.shares ??= [];
    s.shares.push({ id: randomUUID(), userId: u.id, analysisId, tokenHash, note, expiresAt, revokedAt: null, viewCount: 0, createdAt: new Date().toISOString() });
    persist();
    return true;
  }

  async listReviewShares(analysisId: string) {
    const u = await this.requireUser();
    return (store().shares ?? [])
      .filter((x) => x.userId === u.id && x.analysisId === analysisId)
      .map(({ userId: _u, tokenHash: _t, ...x }) => x)
      .reverse();
  }

  async revokeReviewShare(id: string) {
    const u = await this.requireUser();
    const sh = (store().shares ?? []).find((x) => x.id === id && x.userId === u.id);
    if (!sh) return false;
    sh.revokedAt ??= new Date().toISOString();
    persist();
    return true;
  }

  async listApiKeys() {
    const u = await this.requireUser();
    return (store().apiKeys ?? []).filter((k) => k.userId === u.id).map(({ userId: _u, keyHash: _h, ...k }) => k).reverse();
  }

  async createApiKey(name: string, prefix: string, keyHash: string) {
    const u = await this.requireUser();
    const s = store();
    s.apiKeys ??= [];
    if (s.apiKeys.filter((k) => k.userId === u.id && !k.revokedAt).length >= API_KEY_LIMIT) return "limit" as const;
    s.apiKeys.push({ id: randomUUID(), userId: u.id, name, prefix, keyHash, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null });
    persist();
    return "ok" as const;
  }

  async revokeApiKey(id: string) {
    const u = await this.requireUser();
    const k = (store().apiKeys ?? []).find((x) => x.id === id && x.userId === u.id);
    if (!k) return false;
    k.revokedAt ??= new Date().toISOString();
    persist();
    return true;
  }

  async listPerformanceImports() {
    const u = await this.requireUser();
    return (store().perfImports ?? []).filter((x) => x.userId === u.id).map(({ userId: _u, rows: _r, ...x }) => x).reverse();
  }

  async getPerformanceImport(id: string) {
    const u = await this.requireUser();
    const x = (store().perfImports ?? []).find((i) => i.id === id && i.userId === u.id);
    if (!x) return null;
    const { userId: _u, rows, ...imp } = x;
    return { import: imp, rows: structuredClone(rows) };
  }

  async savePerformanceImport(input: PerformanceImportInput) {
    const u = await this.requireUser();
    const s = store();
    s.perfImports ??= [];
    if (s.perfImports.filter((x) => x.userId === u.id).length >= PERFORMANCE_IMPORT_LIMIT) return "limit" as const;
    // Matched analyses must be the user's own.
    const own = new Set(s.analyses.filter((a) => a.userId === u.id).map((a) => a.id));
    const id = randomUUID();
    s.perfImports.push({
      id,
      userId: u.id,
      label: input.label,
      currency: input.currency,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      shareConsent: input.shareConsent,
      adCount: input.rows.length,
      createdAt: new Date().toISOString(),
      rows: input.rows.map((r) => ({ ...r, id: randomUUID(), analysisId: r.analysisId && own.has(r.analysisId) ? r.analysisId : null })),
    });
    persist();
    return { id };
  }

  async setPerformanceShareConsent(id: string, on: boolean) {
    const u = await this.requireUser();
    const x = (store().perfImports ?? []).find((i) => i.id === id && i.userId === u.id);
    if (!x) return false;
    x.shareConsent = on;
    persist();
    return true;
  }

  async deletePerformanceImport(id: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.perfImports ?? []).length;
    s.perfImports = (s.perfImports ?? []).filter((x) => !(x.id === id && x.userId === u.id));
    persist();
    return s.perfImports.length < before;
  }

  async listWatches() {
    const u = await this.requireUser();
    return (store().watches ?? []).filter((w) => w.userId === u.id).map(({ userId: _u, seenIds: _s, ...w }) => structuredClone(w));
  }

  async addWatch(term: string, country: string) {
    const u = await this.requireUser();
    const s = store();
    s.watches ??= [];
    const mine = s.watches.filter((w) => w.userId === u.id);
    if (mine.some((w) => w.term.toLocaleLowerCase("tr-TR") === term.toLocaleLowerCase("tr-TR") && w.country === country)) return "exists" as const;
    if (mine.length >= WATCH_LIMIT) return "limit" as const;
    s.watches.push({ id: randomUUID(), userId: u.id, term, country, seenIds: [], lastCheckedAt: null, lastSummary: null, createdAt: new Date().toISOString() });
    persist();
    return "ok" as const;
  }

  async deleteWatch(id: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.watches ?? []).length;
    s.watches = (s.watches ?? []).filter((w) => !(w.id === id && w.userId === u.id));
    persist();
    return s.watches.length < before;
  }

  async listPins() {
    const u = await this.requireUser();
    return (store().pins ?? []).filter((p) => p.userId === u.id).map(({ userId: _u, ...p }) => p).reverse();
  }

  async savePin(pin: InspirationPinInput) {
    const u = await this.requireUser();
    const s = store();
    s.pins ??= [];
    const mine = s.pins.filter((p) => p.userId === u.id);
    if (mine.some((p) => p.adArchiveId === pin.adArchiveId)) return "exists" as const;
    if (mine.length >= PIN_LIMIT) return "limit" as const;
    s.pins.push({ ...pin, id: randomUUID(), userId: u.id, createdAt: new Date().toISOString() });
    persist();
    return "ok" as const;
  }

  async deletePin(id: string) {
    const u = await this.requireUser();
    const s = store();
    const before = (s.pins ?? []).length;
    s.pins = (s.pins ?? []).filter((p) => !(p.id === id && p.userId === u.id));
    persist();
    return s.pins.length < before;
  }

  async setSpeechTranscript(analysisId: string, text: string) {
    const u = await this.requireUser();
    const a = this.own(analysisId, u.id);
    if (!a || a.status !== "processing") return false;
    a.speechTranscript = text.slice(0, 6000);
    persist();
    return true;
  }

  async deleteAnalysis(id: string) {
    const u = await this.requireUser();
    const s = store();
    const idx = s.analyses.findIndex((a) => a.id === id && a.userId === u.id);
    if (idx < 0) return false;
    s.analyses.splice(idx, 1);
    for (const l of s.ledger) if (l.analysisId === id) l.analysisId = null; // FK set null, ledger row kept
    s.feedback = (s.feedback ?? []).filter((f) => f.analysisId !== id);
    s.shares = (s.shares ?? []).filter((x) => x.analysisId !== id);
    persist();
    return true;
  }

  async saveAppeal(analysisId: string, appeal: AppealOut) {
    const u = await this.requireUser();
    const a = this.own(analysisId, u.id);
    if (!a || a.status !== "completed") return false;
    a.appeal = { ...appeal, createdAt: new Date().toISOString() };
    persist();
    return true;
  }

  async applyDemoPurchase(packageId: string, eventId: string) {
    const u = await this.requireUser();
    const pkg = findPackage(packageId);
    if (!pkg) return { applied: false };
    return new MemoryAdminRepo().applyPurchase({ provider: "demo", eventId, orderId: eventId, userId: u.id, packageId: pkg.id, credits: pkg.credits, amountMinor: 0, currency: pkg.currency, isDemo: true });
  }

  async deleteAccount() {
    const u = await this.requireUser();
    const s = store();
    s.users = s.users.filter((x) => x.id !== u.id);
    delete s.profiles[u.id];
    s.brands = s.brands.filter((x) => x.userId !== u.id);
    s.audiences = (s.audiences ?? []).filter((x) => x.userId !== u.id);
    for (const g of (s.generations ?? []).filter((x) => x.userId === u.id)) for (const f of generationFiles(g.output)) delete s.genFiles?.[f];
    s.generations = (s.generations ?? []).filter((x) => x.userId !== u.id);
    s.analyses = s.analyses.filter((x) => x.userId !== u.id);
    s.ledger = s.ledger.filter((x) => x.userId !== u.id);
    s.consents = s.consents.filter((x) => x.userId !== u.id);
    s.aiRuns = s.aiRuns.filter((x) => x.userId !== u.id);
    s.team = (s.team ?? []).filter((x) => x.ownerId !== u.id && x.memberId !== u.id);
    s.invites = (s.invites ?? []).filter((x) => x.ownerId !== u.id);
    s.feedback = (s.feedback ?? []).filter((x) => x.userId !== u.id);
    s.shares = (s.shares ?? []).filter((x) => x.userId !== u.id);
    s.apiKeys = (s.apiKeys ?? []).filter((x) => x.userId !== u.id);
    s.pins = (s.pins ?? []).filter((x) => x.userId !== u.id);
    s.perfImports = (s.perfImports ?? []).filter((x) => x.userId !== u.id);
    s.watches = (s.watches ?? []).filter((x) => x.userId !== u.id);
    for (const p of s.purchases) if (p.userId === u.id) p.userId = null;
    persist();
    await this.signOut();
    return true;
  }
}


function ownerLabel(ownerId: string) {
  const s = store();
  const p = s.profiles[ownerId];
  return p?.companyName || p?.displayName || s.users.find((x) => x.id === ownerId)?.email || "Ekip";
}

function brandingFor(a: StoredAnalysis): ReportBranding {
  const s = store();
  const brand = a.brandId ? s.brands.find((b) => b.id === a.brandId) : null;
  const logo = brand ? s.logos?.[brand.id] : null;
  return {
    brandName: brand?.name ?? null,
    agencyName: s.profiles[a.userId]?.companyName ?? null,
    logo: logo ? { bytes: new Uint8Array(Buffer.from(logo.dataB64, "base64")), mime: logo.mime } : null,
  };
}

function detailOf(a: StoredAnalysis, viewerId: string): AnalysisDetail {
    const rules = new Map(catalogRules().map((r) => [r.versionId, r]));
    const r = a.result;
    return {
      ...summary(a, viewerId),
      description: a.description,
      rejectionMessage: a.rejectionMessage,
      safeText: r?.safe_text ?? null,
      scoreBreakdown: r?.score_breakdown ?? null,
      engineVersion: r?.engine_version ?? null,
      aiProvider: r?.ai_provider ?? null,
      demo: a.demo,
      completedAt: a.completedAt,
      findings: (r?.findings ?? []).map((f, i) => {
        const rule = f.rule_version_id ? rules.get(f.rule_version_id) : undefined;
        return {
          id: `${a.id}-${i}`,
          domain: f.domain,
          severity: f.severity,
          field: f.field,
          matchedText: f.matched_text,
          title: f.title,
          explanation: f.explanation,
          suggestion: f.suggestion,
          origin: f.origin,
          rule: rule
            ? {
                id: rule.id,
                version: rule.version,
                status: rule.status,
                sourceOrg: rule.sourceOrg,
                sourceTitle: rule.sourceTitle,
                sourceUrl: rule.sourceUrl,
                sourceReference: rule.sourceReference ?? null,
                effectiveDate: rule.effectiveDate ?? null,
                lastVerifiedAt: rule.lastVerifiedAt ?? null,
                legalReviewStatus: rule.legalReviewStatus,
              }
            : null,
        };
      }),
      variants: (r?.variants ?? []).map((v) => ({
        kind: v.kind,
        position: v.position,
        tone: v.tone,
        headline: v.headline,
        primaryText: v.primary_text,
        description: v.description,
        recheckRed: v.recheck_red,
        recheckYellow: v.recheck_yellow,
      })),
      appeal: a.appeal,
      asset: a.asset ? { id: a.asset.id, mime: a.asset.mime, width: a.asset.width, height: a.asset.height, sizeBytes: a.asset.sizeBytes } : null,
      frames: (a.frames ?? []).map((f) => ({ index: f.index, timeMs: f.timeMs, width: f.width, height: f.height })),
      videoMeta: a.videoMeta ?? null,
      transcript: a.transcript ?? null,
      landingUrl: a.landingUrl ?? null,
      speechTranscript: a.speechTranscript ?? null,
      hasLandingScreenshot: Boolean(a.landingScreenshot),
      creditCost: a.creditCost ?? 1,
      brandId: a.brandId,
    };
}

export class MemoryAdminRepo implements AdminRepo {
  async applyPurchase(p: Parameters<AdminRepo["applyPurchase"]>[0]) {
    return withLock(p.userId, () => {
      const s = store();
      if (!s.users.some((u) => u.id === p.userId)) throw new Error("user_not_found");
      const eventKey = `${p.provider}:${p.eventId}`;
      if (s.purchases.some((x) => x.eventKey === eventKey)) return { applied: false };
      const purchase = {
        id: randomUUID(),
        userId: p.userId,
        eventKey,
        orderId: p.orderId,
        provider: p.provider,
        packageId: p.packageId,
        credits: p.credits,
        amountMinor: p.amountMinor,
        currency: p.currency,
        status: "paid",
        isDemo: p.isDemo,
        createdAt: new Date().toISOString(),
      };
      s.purchases.push(purchase);
      const applied = insertLedger({
        userId: p.userId,
        delta: p.credits,
        reason: "purchase",
        note: p.isDemo ? "Demo satın alma (gerçek ödeme alınmadı)" : "Kredi paketi satın alımı",
        analysisId: null,
        idempotencyKey: `purchase:${p.provider}:${p.orderId || p.eventId}`,
      });
      if (!applied) purchase.status = "ignored";
      persist();
      return { applied };
    });
  }

  async purgeExpired() {
    const s = store();
    const now = Date.now();
    const before = s.analyses.length;
    s.analyses = s.analyses.filter((a) => Date.parse(a.expiresAt) > now);
    const expired = (s.generations ?? []).filter((g) => Date.parse(g.expiresAt) <= now);
    for (const g of expired) for (const f of generationFiles(g.output)) delete s.genFiles?.[f];
    s.generations = (s.generations ?? []).filter((g) => Date.parse(g.expiresAt) > now);
    persist();
    return before - s.analyses.length;
  }

  async getAppRole(userId: string) {
    // Demo only: DEMO_ADMIN_EMAILS (exact addresses or "@domain") marks admins of the in-memory store.
    if (appMode() !== "demo") return null;
    const u = store().users.find((x) => x.id === userId);
    const list = (process.env.DEMO_ADMIN_EMAILS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!u || !list.length) return null;
    return list.some((e) => (e.startsWith("@") ? u.email.endsWith(e) : u.email === e)) ? "admin" : null;
  }

  async adminListUsers(query?: string): Promise<AdminUserRow[]> {
    const s = store();
    const q = (query ?? "").trim().toLowerCase();
    return s.users
      .filter((u) => !q || u.email.includes(q))
      .slice(-200)
      .reverse()
      .map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt, balance: balanceOf(u.id), analyses: s.analyses.filter((a) => a.userId === u.id).length }));
  }

  async adminAdjustCredits(p: { adminId: string; userId: string; delta: number; reason: string; requestId: string }) {
    const s = store();
    if (!s.users.some((u) => u.id === p.userId)) return "not_found" as const;
    if (s.ledger.some((l) => l.idempotencyKey === `admin:${p.requestId}`)) return "exists" as const;
    if (balanceOf(p.userId) + p.delta < 0) return "negative_balance" as const;
    insertLedger({ userId: p.userId, delta: p.delta, reason: "admin_adjustment", note: p.reason, analysisId: null, idempotencyKey: `admin:${p.requestId}` });
    await this.recordAudit({ adminId: p.adminId, action: "credit_adjustment", targetUserId: p.userId, details: { delta: p.delta, reason: p.reason } });
    return "ok" as const;
  }

  async adminListPurchases(limit = 100): Promise<AdminPurchaseRow[]> {
    return store()
      .purchases.slice(-limit)
      .reverse()
      .map(({ eventKey, userId, orderId: _o, ...p }) => ({ ...p, userId, eventId: eventKey }));
  }

  async adminFeedbackStats(): Promise<AdminFeedbackRow[]> {
    const s = store();
    const out = new Map<string, AdminFeedbackRow>();
    for (const f of s.feedback ?? []) {
      const a = s.analyses.find((x) => x.id === f.analysisId);
      const idx = Number(f.findingId.slice((a?.id.length ?? 0) + 1));
      const finding = a?.result?.findings[idx];
      const ruleId = /^demo-(.+)-v\d+$/.exec(finding?.rule_version_id ?? "")?.[1];
      if (!finding || !ruleId) continue;
      const row = out.get(ruleId) ?? { ruleId, title: finding.title, total: 0, wrong: 0, unclear: 0, helpful: 0 };
      row.total++;
      row[f.verdict]++;
      out.set(ruleId, row);
    }
    return [...out.values()].sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.total - a.total);
  }

  async adminErrorStats(sinceIso: string): Promise<AdminErrorStats> {
    const s = store();
    const an = s.analyses.filter((a) => a.createdAt >= sinceIso);
    const byCode: Record<string, number> = {};
    for (const a of an) if (a.status === "failed") byCode[a.failureCode ?? "unknown"] = (byCode[a.failureCode ?? "unknown"] ?? 0) + 1;
    const runs = s.aiRuns.filter((r) => r.createdAt >= sinceIso);
    return {
      analyses: { total: an.length, failed: an.filter((a) => a.status === "failed").length, byCode },
      aiRuns: { total: runs.length, failed: runs.filter((r) => r.status === "failed").length, schemaInvalid: runs.filter((r) => r.status === "schema_invalid").length, fallback: runs.filter((r) => r.status === "fallback").length },
    };
  }

  async recordAudit(e: { adminId: string; action: string; targetUserId: string | null; details: Record<string, unknown> }) {
    const s = store();
    s.audit ??= [];
    s.audit.push({ id: randomUUID(), ...structuredClone(e), createdAt: new Date().toISOString() });
    persist();
  }

  async listAudit(limit = 100) {
    return structuredClone((store().audit ?? []).slice(-limit).reverse());
  }

  async listAllWatches() {
    return structuredClone(store().watches ?? []);
  }

  async saveWatchResult(id: string, r: { seenIds: string[]; summary: CompetitorSummary }) {
    const w = (store().watches ?? []).find((x) => x.id === id);
    if (!w) return;
    w.seenIds = r.seenIds.slice(-1000);
    w.lastSummary = structuredClone(r.summary);
    w.lastCheckedAt = new Date().toISOString();
    persist();
  }

  // Welcome series (P5.4) -----------------------------------------------------------------------
  async listWelcomeRecipients(sinceIso: string) {
    const s = store();
    const since = Date.parse(sinceIso);
    return s.users
      .filter((u) => Date.parse(u.createdAt) >= since && !(s.welcomeOptOut ?? []).includes(u.id))
      .map((u) => ({ userId: u.id, email: u.email, displayName: s.profiles[u.id]?.displayName ?? null, sector: s.profiles[u.id]?.defaultSector ?? null, createdAt: u.createdAt, marketing: latestMarketing(u.id), balance: balanceOf(u.id) }));
  }

  async claimWelcomeEmail(userId: string, step: number) {
    const s = store();
    s.welcomeLog ??= [];
    if (s.welcomeLog.some((r) => r.userId === userId && r.step === step)) return false;
    s.welcomeLog.push({ userId, step, sentAt: new Date().toISOString() });
    persist();
    return true;
  }

  async releaseWelcomeEmail(userId: string, step: number) {
    const s = store();
    s.welcomeLog = (s.welcomeLog ?? []).filter((r) => !(r.userId === userId && r.step === step));
    persist();
  }

  async unsubscribeEmails(userId: string) {
    const s = store();
    if (!s.users.some((u) => u.id === userId)) return;
    s.welcomeOptOut ??= [];
    if (!s.welcomeOptOut.includes(userId)) s.welcomeOptOut.push(userId);
    if (s.profiles[userId]) s.profiles[userId].seasonReminders = false;
    s.consents.push({ userId, type: "marketing_email", version: "e-posta-tercihleri", granted: false, createdAt: new Date().toISOString() });
    persist();
  }

  // Growth (P5.1, P5.2) -----------------------------------------------------------------------
  async ensureInviteCode(userId: string) {
    return withLock(`invite:${userId}`, () => {
      const s = store();
      s.inviteCodes ??= [];
      const found = s.inviteCodes.find((c) => c.userId === userId && c.kind === "invite");
      if (found) return found.code;
      let code = newCode("AD");
      while (s.inviteCodes.some((c) => c.code === code)) code = newCode("AD");
      s.inviteCodes.push({ userId, kind: "invite", code, commissionBp: null, createdAt: new Date().toISOString() });
      persist();
      return code;
    });
  }

  async getInviteOverview(userId: string): Promise<InviteOverview> {
    const inviteCode = await this.ensureInviteCode(userId);
    const s = store();
    const partner = (s.inviteCodes ?? []).find((c) => c.userId === userId && c.kind === "partner");
    const mine = (s.referrals ?? []).filter((r) => r.inviterId === userId);
    const earned = s.ledger.filter((l) => l.userId === userId && (l.reason === "referral_bonus" || l.reason === "referral_clawback")).reduce((n, l) => n + l.delta, 0);
    const commissions = (s.commissions ?? []).filter((c) => c.partnerId === userId).slice(-100).reverse();
    return {
      inviteCode,
      partner: partner ? { code: partner.code, commissionBp: partner.commissionBp ?? 0 } : null,
      invited: mine.length,
      rewarded: mine.filter((r) => r.rewardedAt && !r.clawedBackAt).length,
      earnedCredits: earned,
      pendingCommissionMinor: commissions.filter((c) => c.status === "pending" && !c.isDemo).reduce((n, c) => n + c.commissionMinor, 0),
      commissions: commissions.map(({ partnerId: _p, partnerEmail: _e, inviteeId: _i, purchaseRef: _r, ...c }) => c),
    };
  }

  async attachReferral(p: { inviteeId: string; inviteeEmail: string; code: string }): Promise<ReferralAttach> {
    return withLock("referrals", () => {
      const s = store();
      const code = (s.inviteCodes ?? []).find((c) => c.code === p.code.toUpperCase());
      if (!code) return "invalid";
      if (code.userId === p.inviteeId) return "self";
      const inviter = s.users.find((u) => u.id === code.userId);
      const hash = emailHash(p.inviteeEmail);
      if (inviter && emailHash(inviter.email) === hash) return "self";
      s.referrals ??= [];
      if (s.referrals.some((r) => r.inviteeId === p.inviteeId)) return "exists";
      s.emailClaims ??= [];
      if (s.emailClaims.includes(hash)) return "repeat";
      s.emailClaims.push(hash);
      s.referrals.push({ inviteeId: p.inviteeId, inviterId: code.userId, kind: code.kind, rewardedAt: null, rewardRef: null, clawedBackAt: null, createdAt: new Date().toISOString() });
      persist();
      return "ok";
    });
  }

  async grantPartnerCode(p: { adminId: string; userId: string; commissionBp: number }) {
    const s = store();
    if (!s.users.some((u) => u.id === p.userId)) return null;
    s.inviteCodes ??= [];
    let row = s.inviteCodes.find((c) => c.userId === p.userId && c.kind === "partner");
    if (row) row.commissionBp = p.commissionBp;
    else {
      let code = newCode("ORT");
      while (s.inviteCodes.some((c) => c.code === code)) code = newCode("ORT");
      row = { userId: p.userId, kind: "partner", code, commissionBp: p.commissionBp, createdAt: new Date().toISOString() };
      s.inviteCodes.push(row);
    }
    persist();
    await this.recordAudit({ adminId: p.adminId, action: "partner_code", targetUserId: p.userId, details: { commissionBp: p.commissionBp } });
    return row.code;
  }

  async reserveCoupon(p: { code: string; userId: string; packageId: string }): Promise<CouponReserveStatus> {
    const code = p.code.trim().toUpperCase();
    // One lock per coupon stands in for SELECT ... FOR UPDATE on the coupon row.
    return withLock(`coupon:${code}`, () => {
      const s = store();
      const c = (s.coupons ?? []).find((x) => x.code === code);
      const now = Date.now();
      if (!c || !c.active || Date.parse(c.startsAt) > now || (c.expiresAt && Date.parse(c.expiresAt) <= now)) return "invalid";
      if (c.packageIds.length && !c.packageIds.includes(p.packageId)) return "wrong_package";
      if (c.kind !== "bonus_credits") return "unsupported";
      s.couponRedemptions ??= [];
      const live = (r: NonNullable<Store["couponRedemptions"]>[number]) => r.status === "applied" || (r.status === "reserved" && now - Date.parse(r.createdAt) < COUPON_RESERVATION_MS);
      for (const r of s.couponRedemptions) if (r.couponId === c.id && r.userId === p.userId && r.status === "reserved" && !live(r)) r.status = "released";
      const open = s.couponRedemptions.find((r) => r.couponId === c.id && r.userId === p.userId && r.status === "reserved");
      if (open) {
        open.packageId = p.packageId;
        open.createdAt = new Date().toISOString();
        persist();
        return "ok";
      }
      if (s.couponRedemptions.filter((r) => r.couponId === c.id && r.userId === p.userId && live(r)).length >= c.perUserLimit) return "used";
      if (c.maxRedemptions !== null && s.couponRedemptions.filter((r) => r.couponId === c.id && live(r)).length >= c.maxRedemptions) return "exhausted";
      s.couponRedemptions.push({ id: randomUUID(), couponId: c.id, userId: p.userId, packageId: p.packageId, status: "reserved", purchaseRef: null, createdAt: new Date().toISOString(), appliedAt: null });
      persist();
      return "ok";
    });
  }

  async getCouponReservation(userId: string): Promise<CouponReservation | null> {
    const s = store();
    const now = Date.now();
    const r = (s.couponRedemptions ?? []).filter((x) => x.userId === userId && x.status === "reserved" && now - Date.parse(x.createdAt) < COUPON_RESERVATION_MS).at(-1);
    const c = r && (s.coupons ?? []).find((x) => x.id === r.couponId);
    return r && c ? { code: c.code, packageId: r.packageId, value: c.value, createdAt: r.createdAt } : null;
  }

  async releaseCouponReservation(userId: string) {
    for (const r of store().couponRedemptions ?? []) if (r.userId === userId && r.status === "reserved") r.status = "released";
    persist();
  }

  async applyGrowthAfterPurchase(p: GrowthPurchase): Promise<GrowthResult> {
    return withLock(`growth:${p.userId}`, () => {
      const s = store();
      const now = new Date().toISOString();
      const out: GrowthResult = { couponCredits: 0, referralRewarded: false, commissionRecorded: false };
      // Coupon: the newest open reservation for this package becomes "applied" with this purchase.
      s.couponRedemptions ??= [];
      let red = s.couponRedemptions.find((r) => r.purchaseRef === p.purchaseRef);
      if (!red) {
        red = s.couponRedemptions.filter((r) => r.userId === p.userId && r.status === "reserved" && r.packageId === p.packageId && Date.now() - Date.parse(r.createdAt) < COUPON_RESERVATION_MS).at(-1);
        if (red) Object.assign(red, { status: "applied", purchaseRef: p.purchaseRef, appliedAt: now });
      }
      const coupon = red && (s.coupons ?? []).find((c) => c.id === red.couponId);
      if (red && coupon?.kind === "bonus_credits") {
        insertLedger({ userId: p.userId, delta: coupon.value, reason: "coupon_bonus", note: `Kupon ek kredisi (${coupon.code})`, analysisId: null, idempotencyKey: `coupon:${red.id}` });
        out.couponCredits = coupon.value;
      }
      // Referral: only the invitee's first purchase is rewarded, once.
      const ref = (s.referrals ?? []).find((r) => r.inviteeId === p.userId);
      if (ref && !ref.rewardedAt && !ref.clawedBackAt) Object.assign(ref, { rewardedAt: now, rewardRef: p.purchaseRef });
      if (ref && ref.rewardRef === p.purchaseRef && p.referralBonus > 0) {
        insertLedger({ userId: p.userId, delta: p.referralBonus, reason: "referral_bonus", note: "Davet ödülü: ilk satın alma", analysisId: null, idempotencyKey: `referral:${p.userId}:invitee` });
        if (ref.kind === "invite") insertLedger({ userId: ref.inviterId, delta: p.referralBonus, reason: "referral_bonus", note: "Davet ödülü: davet ettiğin kişi ilk satın almasını yaptı", analysisId: null, idempotencyKey: `referral:${p.userId}:inviter` });
        out.referralRewarded = true;
      }
      // Partner: a commission record for every purchase of a referred user (paid by hand).
      const partner = ref?.kind === "partner" ? (s.inviteCodes ?? []).find((c) => c.userId === ref.inviterId && c.kind === "partner") : undefined;
      if (ref && partner?.commissionBp) {
        s.commissions ??= [];
        if (!s.commissions.some((c) => c.purchaseRef === p.purchaseRef)) {
          const partnerEmail = s.users.find((u) => u.id === ref.inviterId)?.email ?? null;
          s.commissions.push({ id: randomUUID(), partnerId: ref.inviterId, partnerEmail, inviteeId: p.userId, purchaseRef: p.purchaseRef, amountMinor: p.amountMinor, commissionBp: partner.commissionBp, commissionMinor: commissionOf(p.amountMinor, partner.commissionBp), currency: p.currency, status: "pending", isDemo: p.isDemo, createdAt: now });
        }
        out.commissionRecorded = true;
      }
      persist();
      return out;
    });
  }

  async applyRefund(p: { provider: string; orderId: string }) {
    const s = store();
    const purchase = s.purchases.find((x) => x.provider === p.provider && (x.orderId === p.orderId || x.eventKey === `${p.provider}:${p.orderId}`));
    if (!purchase?.userId) return { applied: false };
    const userId = purchase.userId;
    return withLock(userId, () => {
      const ref = `${p.provider}:${p.orderId}`;
      // Never below zero: credits already spent are not taken back.
      const take = (uid: string, amount: number, reason: "refund" | "referral_clawback", key: string, note: string) => {
        const n = Math.min(amount, balanceOf(uid));
        return n > 0 ? insertLedger({ userId: uid, delta: -n, reason, note, analysisId: null, idempotencyKey: key }) : false;
      };
      let applied = false;
      if (purchase.status === "paid") {
        applied = take(userId, purchase.credits, "refund", `refund:${ref}`, "Ödeme iadesi") || applied;
        purchase.status = "refunded";
        applied = true;
      }
      const red = (s.couponRedemptions ?? []).find((r) => r.purchaseRef === ref);
      const coupon = red && (s.coupons ?? []).find((c) => c.id === red.couponId);
      if (red && coupon?.kind === "bonus_credits" && s.ledger.some((l) => l.idempotencyKey === `coupon:${red.id}`)) take(userId, coupon.value, "refund", `coupon-refund:${red.id}`, `Kupon ek kredisi geri alındı (${coupon.code})`);
      const referral = (s.referrals ?? []).find((r) => r.inviteeId === userId && r.rewardRef === ref);
      if (referral && !referral.clawedBackAt) {
        referral.clawedBackAt = new Date().toISOString();
        for (const side of ["invitee", "inviter"] as const) {
          const grant = s.ledger.find((l) => l.idempotencyKey === `referral:${userId}:${side}`);
          if (grant) take(grant.userId, grant.delta, "referral_clawback", `referral-clawback:${userId}:${side}`, "Davet ödülü geri alındı (ödeme iadesi)");
        }
      }
      for (const c of s.commissions ?? []) if (c.purchaseRef === ref && c.status === "pending") c.status = "reversed";
      persist();
      return { applied };
    });
  }

  async createCoupon(p: CouponInput & { adminId: string }) {
    const s = store();
    s.coupons ??= [];
    if (s.coupons.some((c) => c.code === p.code)) return "exists" as const;
    const { adminId, ...input } = p;
    s.coupons.push({ ...input, id: randomUUID(), active: true, createdBy: adminId, createdAt: new Date().toISOString() });
    persist();
    await this.recordAudit({ adminId, action: "coupon_create", targetUserId: null, details: { code: p.code, kind: p.kind, value: p.value } });
    return "ok" as const;
  }

  async listCoupons(): Promise<CouponView[]> {
    const s = store();
    return (s.coupons ?? [])
      .slice()
      .reverse()
      .map(({ createdBy: _c, ...c }) => ({ ...c, redeemed: (s.couponRedemptions ?? []).filter((r) => r.couponId === c.id && r.status === "applied").length }));
  }

  async setCouponActive(p: { adminId: string; id: string; active: boolean }) {
    const c = (store().coupons ?? []).find((x) => x.id === p.id);
    if (!c) return;
    c.active = p.active;
    persist();
    await this.recordAudit({ adminId: p.adminId, action: p.active ? "coupon_activate" : "coupon_deactivate", targetUserId: null, details: { code: c.code } });
  }

  async listActiveCampaigns(): Promise<ActiveCampaign[]> {
    const now = Date.now();
    const list = await this.listCoupons();
    return list
      .filter((c) => c.active && c.kind === "bonus_credits" && c.campaignLabel && Date.parse(c.startsAt) <= now && (!c.expiresAt || Date.parse(c.expiresAt) > now) && (c.maxRedemptions === null || c.redeemed < c.maxRedemptions))
      .map((c) => ({ code: c.code, label: c.campaignLabel!, value: c.value, packageIds: c.packageIds, expiresAt: c.expiresAt }));
  }

  async adminListCommissions(limit = 200): Promise<AdminCommissionRow[]> {
    return (store().commissions ?? []).slice(-limit).reverse().map(({ inviteeId: _i, purchaseRef: _r, ...c }) => c);
  }

  async getUserContact(userId: string) {
    const s = store();
    const u = s.users.find((x) => x.id === userId);
    return u ? { email: u.email, displayName: s.profiles[u.id]?.displayName ?? null } : null;
  }

  async listSeasonReminderRecipients() {
    const s = store();
    return s.users
      .filter((u) => s.profiles[u.id]?.seasonReminders)
      .map((u) => ({ userId: u.id, email: u.email, displayName: s.profiles[u.id].displayName, sector: s.profiles[u.id].defaultSector }));
  }

  async claimSeasonReminder(userId: string, eventKey: string) {
    const s = store();
    s.reminderLog ??= [];
    if (s.reminderLog.some((r) => r.userId === userId && r.eventKey === eventKey)) return false;
    s.reminderLog.push({ userId, eventKey, sentAt: new Date().toISOString() });
    persist();
    return true;
  }

  async releaseSeasonReminder(userId: string, eventKey: string) {
    const s = store();
    s.reminderLog = (s.reminderLog ?? []).filter((r) => !(r.userId === userId && r.eventKey === eventKey));
    persist();
  }

  async listNewsletterRecipients() {
    const s = store();
    return s.users
      .filter((u) => latestMarketing(u.id))
      .map((u) => ({ userId: u.id, email: u.email, displayName: s.profiles[u.id]?.displayName ?? null, sector: s.profiles[u.id]?.defaultSector ?? null }));
  }

  async claimNewsletter(userId: string, period: string) {
    const s = store();
    s.newsletterLog ??= [];
    if (s.newsletterLog.some((r) => r.userId === userId && r.period === period)) return false;
    s.newsletterLog.push({ userId, period, sentAt: new Date().toISOString() });
    persist();
    return true;
  }

  async releaseNewsletter(userId: string, period: string) {
    const s = store();
    s.newsletterLog = (s.newsletterLog ?? []).filter((r) => !(r.userId === userId && r.period === period));
    persist();
  }

  async getSharedReview(tokenHash: string): Promise<SharedReview | null> {
    const s = store();
    const sh = (s.shares ?? []).find((x) => x.tokenHash === tokenHash);
    if (!sh || sh.revokedAt || Date.parse(sh.expiresAt) <= Date.now()) return null;
    const a = s.analyses.find((x) => x.id === sh.analysisId && x.userId === sh.userId && x.status === "completed");
    if (!a) return null;
    sh.viewCount += 1;
    persist();
    return { analysis: detailOf(a, sh.userId), branding: brandingFor(a), note: sh.note, expiresAt: sh.expiresAt };
  }

  async getSharedAssetBytes(tokenHash: string, which?: number | "screenshot") {
    const s = store();
    const sh = (s.shares ?? []).find((x) => x.tokenHash === tokenHash);
    if (!sh || sh.revokedAt || Date.parse(sh.expiresAt) <= Date.now()) return null;
    const u = s.users.find((x) => x.id === sh.userId);
    return u ? new MemoryRepo({ id: u.id, email: u.email }).getAssetBytes(sh.analysisId, which) : null;
  }

  async resolveApiKey(keyHash: string) {
    const s = store();
    const k = (s.apiKeys ?? []).find((x) => x.keyHash === keyHash && !x.revokedAt);
    if (!k) return null;
    const u = s.users.find((x) => x.id === k.userId);
    if (!u) return null;
    k.lastUsedAt = new Date().toISOString();
    s.apiUsage ??= [];
    const day = istanbulDay(new Date());
    const row = s.apiUsage.find((r) => r.keyId === k.id && r.day === day);
    if (row) row.count += 1;
    else s.apiUsage.push({ keyId: k.id, userId: u.id, day, count: 1 });
    persist();
    return { id: u.id, email: u.email };
  }

  async rateLimitHit(key: string, limit: number, windowSec: number) {
    return rateLimit(`shared:${key}`, limit, windowSec * 1000);
  }

  async purgeScaleTables() {
    const s = store();
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
    s.jobs = (s.jobs ?? []).filter((j) => !(j.finishedAt && j.finishedAt < cutoff));
    persist();
  }

  async enqueueJob(j: JobInput) {
    const s = store();
    s.jobs ??= [];
    if (j.dedupeKey && s.jobs.some((x) => x.dedupeKey === j.dedupeKey)) return null;
    const id = randomUUID();
    const now = new Date().toISOString();
    s.jobs.push({ id, userId: j.userId, kind: j.kind, attempts: 0, maxAttempts: j.maxAttempts ?? 5, payload: structuredClone(j.payload), status: "queued", runAfter: now, lockedUntil: null, dedupeKey: j.dedupeKey ?? null, lastError: null, result: null, createdAt: now, finishedAt: null });
    persist();
    return id;
  }

  async claimJobs(limit: number, lockSec: number) {
    return withLock("jobs", () => {
      const s = store();
      const now = new Date().toISOString();
      const due = (s.jobs ?? [])
        .filter((j) => (j.status === "queued" && j.runAfter <= now) || (j.status === "running" && j.lockedUntil !== null && j.lockedUntil < now))
        .sort((a, b) => a.runAfter.localeCompare(b.runAfter))
        .slice(0, limit);
      for (const j of due) {
        j.status = "running";
        j.attempts += 1;
        j.lockedUntil = new Date(Date.now() + lockSec * 1000).toISOString();
      }
      persist();
      return due.map((j) => ({ id: j.id, userId: j.userId, kind: j.kind, attempts: j.attempts, maxAttempts: j.maxAttempts, payload: structuredClone(j.payload) }));
    });
  }

  async finishJob(id: string, r: JobFinish) {
    const j = (store().jobs ?? []).find((x) => x.id === id);
    if (!j) return;
    j.lockedUntil = null;
    if (r.ok) {
      j.status = "succeeded";
      j.result = r.result ?? null;
      j.finishedAt = new Date().toISOString();
    } else if (r.retryAt) {
      j.status = "queued";
      j.runAfter = r.retryAt;
      j.lastError = r.error.slice(0, 120);
    } else {
      j.status = "failed";
      j.lastError = r.error.slice(0, 120);
      j.finishedAt = new Date().toISOString();
    }
    persist();
  }

  async listWebhooks(userId: string) {
    return (store().webhooks ?? []).filter((w) => w.userId === userId).map(({ userId: _u, secret: _s, ...w }) => w);
  }

  async createWebhook(userId: string, url: string, secret: string) {
    return withLock(`webhooks:${userId}`, () => {
      const s = store();
      s.webhooks ??= [];
      if (s.webhooks.filter((w) => w.userId === userId).length >= WEBHOOK_LIMIT) return "limit" as const;
      s.webhooks.push({ id: randomUUID(), userId, url, secret, active: true, lastStatus: null, lastDeliveryAt: null, createdAt: new Date().toISOString() });
      persist();
      return "ok" as const;
    });
  }

  async deleteWebhook(userId: string, id: string) {
    const s = store();
    const before = (s.webhooks ?? []).length;
    s.webhooks = (s.webhooks ?? []).filter((w) => !(w.userId === userId && w.id === id));
    persist();
    return s.webhooks.length < before;
  }

  async getWebhookTarget(userId: string, id: string) {
    const w = (store().webhooks ?? []).find((x) => x.userId === userId && x.id === id);
    return w ? { id: w.id, url: w.url, secret: w.secret, active: w.active } : null;
  }

  async recordWebhookDelivery(id: string, status: string) {
    const w = (store().webhooks ?? []).find((x) => x.id === id);
    if (!w) return;
    w.lastStatus = status.slice(0, 40);
    w.lastDeliveryAt = new Date().toISOString();
    persist();
  }

  async getApiUsage(userId: string, days: number) {
    const rows = (store().apiUsage ?? []).filter((r) => r.userId === userId);
    return lastDays(days).map((day) => ({ day, count: rows.filter((r) => r.day === day).reduce((n, r) => n + r.count, 0) }));
  }

  async adminFunnel(sinceIso: string): Promise<AdminFunnel> {
    const s = store();
    const users = s.users.filter((u) => u.createdAt >= sinceIso).map((u) => u.id);
    const analyzed = new Set(s.analyses.filter((a) => a.status === "completed").map((a) => a.userId));
    const bought = new Set(s.purchases.map((p) => p.userId));
    return {
      signups: users.length,
      firstAnalysis: users.filter((id) => analyzed.has(id)).length,
      firstPurchase: users.filter((id) => bought.has(id)).length,
      queuedJobs: (s.jobs ?? []).filter((j) => j.status === "queued" || j.status === "running").length,
      failedJobs: (s.jobs ?? []).filter((j) => j.status === "failed" && j.createdAt >= sinceIso).length,
    };
  }

  repoForUser(user: SessionUser): DataRepo {
    return new MemoryRepo(user);
  }
}

/** Test helper: clear all demo data. */
export function __resetMemoryStoreForTests() {
  g.__adscopeStore = { users: [], profiles: {}, brands: [], analyses: [], ledger: [], purchases: [], consents: [], aiRuns: [] };
}
