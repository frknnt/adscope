import "server-only";
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname } from "node:path";
import { cookies } from "next/headers";
import { demoSessionSecret, retentionDefaultDays } from "@/lib/env";
import type { AnalysisResult, AppealOut, ImageMeta, RuleRecord, VideoMeta } from "@/lib/engine/types";
import { RULE_CATALOG, type Sector } from "@/lib/rules/catalog";
import type { Platform } from "@/lib/platforms";
import { findPackage } from "@/lib/payments/packages";
import { API_KEY_LIMIT, PIN_LIMIT, TEAM_LIMIT } from "./limits";
import type {
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
  purchases: (PurchaseRecord & { userId: string | null; eventKey: string })[];
  consents: { userId: string; type: string; version: string; granted: boolean; createdAt: string }[];
  aiRuns: (AiRunRecord & { userId: string; createdAt: string })[];
  reminderLog?: { userId: string; eventKey: string; sentAt: string }[];
  logos?: Record<string, { mime: string; dataB64: string }>;
  team?: { ownerId: string; memberId: string; email: string; createdAt: string }[];
  invites?: { id: string; ownerId: string; email: string; tokenHash: string; expiresAt: string; acceptedAt: string | null; createdAt: string }[];
  feedback?: (FindingFeedback & { userId: string; analysisId: string; createdAt: string })[];
  shares?: (ReviewShare & { userId: string; tokenHash: string })[];
  newsletterLog?: { userId: string; period: string; sentAt: string }[];
  apiKeys?: (ApiKeyView & { userId: string; keyHash: string })[];
  pins?: (InspirationPin & { userId: string })[];
}

type StoredBrand = Store["brands"][number];
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
    insertLedger({ userId: user.id, delta: 3, reason: "signup_bonus", note: "Kayıt hediyesi: 3 ücretsiz analiz", analysisId: null, idempotencyKey: `signup_bonus:${user.id}` });
    const now = new Date().toISOString();
    s.consents.push(
      { userId: user.id, type: "terms", version: input.consents.terms, granted: true, createdAt: now },
      { userId: user.id, type: "kvkk_notice", version: input.consents.kvkk, granted: true, createdAt: now },
      { userId: user.id, type: "privacy_policy", version: input.consents.privacy, granted: true, createdAt: now },
      { userId: user.id, type: "marketing_email", version: input.consents.terms, granted: input.consents.marketing, createdAt: now },
    );
    persist();
    await this.setSession(user.id);
    return { ok: true };
  }

  /** Test hook: re-running the bonus grant must not add credits twice. */
  static regrantSignupBonusForTest(userId: string) {
    return insertLedger({ userId, delta: 3, reason: "signup_bonus", note: "Kayıt hediyesi", analysisId: null, idempotencyKey: `signup_bonus:${userId}` });
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
    persist();
    return before - s.analyses.length;
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
    persist();
    return { id: u.id, email: u.email };
  }

  repoForUser(user: SessionUser): DataRepo {
    return new MemoryRepo(user);
  }
}

/** Test helper: clear all demo data. */
export function __resetMemoryStoreForTests() {
  g.__adscopeStore = { users: [], profiles: {}, brands: [], analyses: [], ledger: [], purchases: [], consents: [], aiRuns: [] };
}
