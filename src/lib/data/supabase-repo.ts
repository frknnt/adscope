import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import type { AppealOut, RuleRecord, VideoMeta } from "@/lib/engine/types";
import type { RuleCardDef, Sector } from "@/lib/rules/catalog";
import { findPackage } from "@/lib/payments/packages";
import { API_KEY_LIMIT, PIN_LIMIT, TEAM_LIMIT } from "./limits";
import type {
  AdminRepo,
  AnalysisDetail,
  AnalysisSummary,
  AuthResult,
  Brand,
  BrandInput,
  DataRepo,
  FindingFeedback,
  InspirationPinInput,
  FindingView,
  ReportBranding,
  SessionUser,
  SharedReview,
  StartAnalysisResult,
  TeamState,
} from "./types";
import type { Platform } from "@/lib/platforms";

const BUCKET = "creatives";

type Row = Record<string, unknown>;

const BRAND_COLS = "id,user_id,name,sector,tone,banned_words,voice_notes,preferred_cta,logo_path,logo_mime";

function toBrand(r: Row): Brand {
  return {
    id: r.id as string,
    name: r.name as string,
    sector: r.sector as Sector,
    tone: r.tone as Brand["tone"],
    bannedWords: (r.banned_words as string[]) ?? [],
    voiceNotes: (r.voice_notes as string) ?? null,
    preferredCta: (r.preferred_cta as string) ?? null,
    hasLogo: Boolean(r.logo_path),
  };
}

function brandRow(input: Partial<BrandInput>): Row {
  const row: Row = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.sector !== undefined) row.sector = input.sector;
  if (input.tone !== undefined) row.tone = input.tone;
  if (input.bannedWords !== undefined) row.banned_words = input.bannedWords;
  if (input.voiceNotes !== undefined) row.voice_notes = input.voiceNotes;
  if (input.preferredCta !== undefined) row.preferred_cta = input.preferredCta;
  return row;
}

/** Downloads a brand logo after checking it lives in the brand owner's own folder. */
async function downloadLogo(db: SupabaseClient, brand: Row | null): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const path = brand?.logo_path as string | null | undefined;
  if (!brand || !path || !path.startsWith(`${brand.user_id as string}/brand-logos/`)) return null;
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: (brand.logo_mime as string) ?? "image/png" };
}

async function brandingOf(db: SupabaseClient, admin: SupabaseClient, analysis: Row): Promise<ReportBranding> {
  const brandId = analysis.brand_id as string | null;
  const { data: brand } = brandId ? await db.from("brands").select(BRAND_COLS).eq("id", brandId).maybeSingle() : { data: null };
  const { data: owner } = await admin.from("profiles").select("company_name").eq("id", analysis.user_id as string).maybeSingle();
  return {
    brandName: (brand?.name as string) ?? null,
    agencyName: (owner?.company_name as string) ?? null,
    logo: await downloadLogo(db, brand as Row | null),
  };
}

function toSummary(r: Row, viewerId?: string): AnalysisSummary {
  return {
    id: r.id as string,
    status: r.status as AnalysisSummary["status"],
    failureCode: (r.failure_code as string) ?? null,
    sector: r.sector as Sector,
    headline: (r.headline as string) ?? "",
    primaryText: (r.primary_text as string) ?? "",
    metaRiskScore: (r.meta_risk_score as number) ?? null,
    metaRiskLevel: (r.meta_risk_level as AnalysisSummary["metaRiskLevel"]) ?? null,
    legalRiskLevel: (r.legal_risk_level as AnalysisSummary["legalRiskLevel"]) ?? null,
    legalFindingCount: (r.legal_finding_count as number) ?? null,
    creativeScore: (r.creative_score as number) ?? null,
    mediaType: r.media_type === "video" ? "video" : "image",
    platform: ((r.platform as Platform) ?? "meta"),
    brandId: (r.brand_id as string) ?? null,
    createdAt: r.created_at as string,
    expiresAt: (r.expires_at as string) ?? null,
    ownedByMe: viewerId === undefined || viewerId === r.user_id,
  };
}

const SUMMARY_COLS =
  "id,user_id,status,failure_code,sector,headline,primary_text,meta_risk_score,meta_risk_level,legal_risk_level,legal_finding_count,creative_score,media_type,platform,brand_id,created_at,expires_at";

export function ruleFromRow(v: Row, card: Row): RuleRecord {
  return {
    id: card.id as string,
    domain: card.domain as RuleCardDef["domain"],
    category: card.category as string,
    sector: card.sector as Sector,
    platform: (card.platform as RuleCardDef["platform"]) ?? undefined,
    version: v.version as number,
    status: v.status as RuleCardDef["status"],
    riskLevel: v.risk_level as RuleCardDef["riskLevel"],
    title: v.title as string,
    description: v.description as string,
    riskyExamples: (v.risky_examples as string[]) ?? [],
    matchPatterns: (v.match_patterns as string[]) ?? [],
    safeReplacements: (v.safe_replacements as RuleCardDef["safeReplacements"]) ?? [],
    flagTrigger: (v.flag_trigger as RuleCardDef["flagTrigger"]) ?? undefined,
    safeFix: v.safe_fix as string,
    sourceOrg: v.source_org as string,
    sourceTitle: v.source_title as string,
    sourceUrl: v.source_url as string,
    sourceReference: (v.source_reference as string) ?? undefined,
    effectiveDate: (v.effective_date as string) ?? undefined,
    lastVerifiedAt: (v.last_verified_at as string) ?? undefined,
    verificationNote: (v.verification_note as string) ?? "",
    legalReviewStatus: v.legal_review_status as RuleCardDef["legalReviewStatus"],
    versionId: v.id as string,
  };
}

function authError(message: string | undefined): AuthResult {
  const m = (message ?? "").toLowerCase();
  if (m.includes("already")) return { ok: false, code: "exists" };
  if (m.includes("password")) return { ok: false, code: "weak_password" };
  if (m.includes("not confirmed")) return { ok: false, code: "not_confirmed" };
  if (m.includes("invalid")) return { ok: false, code: "invalid_credentials" };
  return { ok: false, code: "error" };
}

export class SupabaseRepo implements DataRepo {
  readonly backend = "supabase" as const;
  private _client: SupabaseClient | null = null;
  private _user: SessionUser | null | undefined;

  /**
   * acting: act as this user without a browser session (enterprise API). The service-role
   * client is used then, so every query below that can see other users' rows filters by user id,
   * and team (shared) data is never exposed through an API key.
   */
  constructor(private readonly acting: SessionUser | null = null) {
    if (acting) this._user = acting;
  }

  private async db() {
    if (!this._client) this._client = this.acting ? createAdminClient() : await createUserClient();
    return this._client;
  }
  private admin() {
    return createAdminClient();
  }

  async getUser(): Promise<SessionUser | null> {
    if (this._user !== undefined) return this._user;
    if (this.acting) return this.acting;
    const { data } = await (await this.db()).auth.getClaims();
    const claims = data?.claims;
    this._user = claims?.sub ? { id: claims.sub, email: (claims.email as string) ?? "" } : null;
    return this._user;
  }

  private async requireUser() {
    const u = await this.getUser();
    if (!u) throw new Error("unauthenticated");
    return u;
  }

  async signUp(input: Parameters<DataRepo["signUp"]>[0]): Promise<AuthResult> {
    const supabase = await this.db();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: `${siteUrl()}/auth/confirm` },
    });
    if (error) return authError(error.message);
    // Supabase returns a user with no identities when the email is already registered (enumeration protection).
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { ok: false, code: "exists" };
    if (data.user) {
      const rows = [
        { consent_type: "terms", document_version: input.consents.terms, granted: true },
        { consent_type: "kvkk_notice", document_version: input.consents.kvkk, granted: true },
        { consent_type: "privacy_policy", document_version: input.consents.privacy, granted: true },
        { consent_type: "marketing_email", document_version: input.consents.terms, granted: input.consents.marketing },
      ].map((r) => ({ ...r, user_id: data.user!.id }));
      // Consent rows are written with the admin client because the session may not exist yet (email confirmation).
      await this.admin().from("user_consents").insert(rows);
    }
    return { ok: true, needsConfirmation: !data.session };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await (await this.db()).auth.signInWithPassword({ email, password });
    if (error) return authError(error.message);
    return { ok: true };
  }

  async signOut() {
    await (await this.db()).auth.signOut();
  }

  async getProfile() {
    const u = await this.getUser();
    if (!u) return null;
    const db = await this.db();
    const [{ data }, { data: consent }] = await Promise.all([
      db.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      db.from("user_consents").select("granted").eq("user_id", u.id).eq("consent_type", "marketing_email").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!data) return null;
    return {
      id: data.id,
      displayName: data.display_name,
      companyName: data.company_name,
      defaultSector: data.default_sector,
      onboardingCompletedAt: data.onboarding_completed_at,
      retentionDays: data.retention_days,
      seasonReminders: Boolean(data.season_reminders),
      newsletter: Boolean(consent?.granted),
    };
  }

  async setNewsletter(enabled: boolean, documentVersion: string) {
    const u = await this.requireUser();
    const { error } = await (await this.db())
      .from("user_consents")
      .insert({ user_id: u.id, consent_type: "marketing_email", document_version: documentVersion, granted: enabled });
    return !error;
  }

  async updateProfile(patch: Parameters<DataRepo["updateProfile"]>[0]) {
    const u = await this.requireUser();
    const row: Row = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.companyName !== undefined) row.company_name = patch.companyName;
    if (patch.defaultSector !== undefined) row.default_sector = patch.defaultSector;
    if (patch.onboardingCompletedAt !== undefined) row.onboarding_completed_at = patch.onboardingCompletedAt;
    if (patch.retentionDays !== undefined) row.retention_days = patch.retentionDays;
    if (patch.seasonReminders !== undefined) row.season_reminders = patch.seasonReminders;
    const { error } = await (await this.db()).from("profiles").update(row).eq("id", u.id);
    return !error;
  }

  async listBrands() {
    const u = await this.requireUser();
    const { data } = await (await this.db()).from("brands").select(BRAND_COLS).eq("user_id", u.id).order("created_at");
    return (data ?? []).map(toBrand);
  }

  async createBrand(input: BrandInput) {
    const u = await this.requireUser();
    const { data, error } = await (await this.db())
      .from("brands")
      .insert({ user_id: u.id, ...brandRow(input) })
      .select(BRAND_COLS)
      .single();
    return error ? null : toBrand(data);
  }

  async updateBrand(id: string, patch: Partial<BrandInput>) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db()).from("brands").update(brandRow(patch), { count: "exact" }).eq("id", id).eq("user_id", u.id);
    return !error && (count ?? 0) > 0;
  }

  async deleteBrand(id: string) {
    const u = await this.requireUser();
    const db = await this.db();
    const { data: b } = await db.from("brands").select("logo_path").eq("id", id).eq("user_id", u.id).maybeSingle();
    if (!b) return false;
    if (b.logo_path) await db.storage.from(BUCKET).remove([b.logo_path]);
    const { error, count } = await db.from("brands").delete({ count: "exact" }).eq("id", id).eq("user_id", u.id);
    return !error && (count ?? 0) > 0;
  }

  async setBrandLogo(id: string, logo: { bytes: Uint8Array; mime: string; ext: string } | null) {
    const u = await this.requireUser();
    const db = await this.db();
    const { data: b } = await db.from("brands").select("id,logo_path").eq("id", id).eq("user_id", u.id).maybeSingle();
    if (!b) return false;
    let path: string | null = null;
    if (logo) {
      path = `${u.id}/brand-logos/${id}-${crypto.randomUUID()}.${logo.ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, logo.bytes, { contentType: logo.mime, upsert: false });
      if (error) return false;
    }
    // logo_path is server-set only (no column grant for users).
    const { error } = await this.admin()
      .from("brands")
      .update({ logo_path: path, logo_mime: logo ? logo.mime : null })
      .eq("id", id)
      .eq("user_id", u.id);
    if (error) {
      if (path) await db.storage.from(BUCKET).remove([path]);
      return false;
    }
    if (b.logo_path) await db.storage.from(BUCKET).remove([b.logo_path]);
    return true;
  }

  async getBrandLogo(id: string) {
    const u = await this.getUser();
    if (!u) return null;
    const db = await this.db();
    let q = db.from("brands").select(BRAND_COLS).eq("id", id);
    if (this.acting) q = q.eq("user_id", u.id);
    const { data } = await q.maybeSingle();
    return downloadLogo(db, data as Row | null);
  }

  async getReportBranding(analysisId: string) {
    const u = await this.getUser();
    if (!u) return null;
    const db = await this.db();
    let q = db.from("analyses").select("id,user_id,brand_id").eq("id", analysisId);
    if (this.acting) q = q.eq("user_id", u.id);
    const { data: a } = await q.maybeSingle();
    if (!a) return null;
    return brandingOf(db, this.admin(), a);
  }

  async getRules(sector: Sector) {
    const all = await this.listAllRules();
    return all.filter((r) => (r.status === "active" || r.status === "requires_review") && (r.sector === "genel" || r.sector === sector));
  }

  async listAllRules() {
    const { data } = await (await this.db())
      .from("rule_versions")
      .select("*, rule_cards!inner(id,domain,category,sector,platform)")
      .in("status", ["active", "requires_review"]);
    // Only the newest usable version of each card (an older one may linger until the seed retires it).
    const latest = new Map<string, Row>();
    for (const v of (data ?? []) as Row[]) {
      const prev = latest.get(v.rule_card_id as string);
      if (!prev || (v.version as number) > (prev.version as number)) latest.set(v.rule_card_id as string, v);
    }
    return [...latest.values()].map((v: Row) => ruleFromRow(v, v.rule_cards as Row));
  }

  async getBalance() {
    const { data } = await (await this.db()).rpc("get_credit_balance");
    return typeof data === "number" ? data : 0;
  }

  async listLedger() {
    const { data } = await (await this.db())
      .from("credit_ledger")
      .select("id,delta,reason,note,analysis_id,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((r) => ({
      id: String(r.id),
      delta: r.delta,
      reason: r.reason,
      note: r.note,
      analysisId: r.analysis_id,
      createdAt: r.created_at,
    }));
  }

  async listPurchases() {
    const { data } = await (await this.db())
      .from("purchase_events")
      .select("id,provider,package_id,credits,amount_minor,currency,status,is_demo,created_at")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id,
      provider: r.provider,
      packageId: r.package_id,
      credits: r.credits,
      amountMinor: r.amount_minor,
      currency: r.currency,
      status: r.status,
      isDemo: r.is_demo,
      createdAt: r.created_at,
    }));
  }

  async startAnalysis(p: Parameters<DataRepo["startAnalysis"]>[0]): Promise<StartAnalysisResult> {
    const u = await this.requireUser();
    const { data, error } = await this.admin().rpc("start_analysis", {
      p_user_id: u.id,
      p_client_request_id: p.clientRequestId,
      p_brand_id: p.brandId,
      p_sector: p.sector,
      p_headline: p.headline,
      p_primary_text: p.primaryText,
      p_description: p.description,
      p_rejection_message: p.rejectionMessage,
      p_demo: p.demo,
      p_hourly_limit: p.hourlyLimit,
      p_credit_cost: p.creditCost,
    });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("insufficient_credits")) return { ok: false, code: "insufficient_credits" };
      if (m.includes("rate_limited")) return { ok: false, code: "rate_limited" };
      if (m.includes("brand_not_found")) return { ok: false, code: "brand_not_found" };
      return { ok: false, code: "error" };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { analysis_id: string; status: AnalysisSummary["status"]; created: boolean };
    const platform = p.platform ?? "meta";
    if (row.created && (p.mediaType !== "image" || p.transcript || p.landingUrl || platform !== "meta")) {
      // Users have no UPDATE grant on analyses; the server sets the media fields right after creation.
      const { error: updErr } = await this.admin()
        .from("analyses")
        .update({ media_type: p.mediaType, video_meta: p.videoMeta, transcript: p.transcript, landing_url: p.landingUrl, platform })
        .eq("id", row.analysis_id)
        .eq("user_id", u.id);
      if (updErr) {
        await this.failAnalysis(row.analysis_id, "start_failed");
        return { ok: false, code: "error" };
      }
    }
    return { ok: true, analysisId: row.analysis_id, status: row.status, created: row.created };
  }

  async uploadAsset(
    analysisId: string,
    bytes: Uint8Array,
    meta: Parameters<DataRepo["uploadAsset"]>[2],
    ext: string,
    sha256: string,
    opts: Parameters<DataRepo["uploadAsset"]>[5] = { kind: "creative" },
  ) {
    const u = await this.requireUser();
    const path = `${u.id}/${analysisId}/${crypto.randomUUID()}.${ext}`;
    // Upload with the USER client so storage ownership policies are enforced.
    const { error } = await (await this.db()).storage.from(BUCKET).upload(path, bytes, {
      contentType: meta.mime,
      upsert: false,
    });
    if (error) return false;
    const { error: insErr } = await this.admin().from("analysis_assets").insert({
      analysis_id: analysisId,
      user_id: u.id,
      storage_path: path,
      mime_type: meta.mime,
      size_bytes: meta.sizeBytes,
      width: meta.width,
      height: meta.height,
      sha256,
      kind: opts.kind,
      frame_index: opts.kind === "video_frame" ? (opts.frameIndex ?? 0) : null,
      frame_time_ms: opts.kind === "video_frame" ? (opts.frameTimeMs ?? 0) : null,
    });
    if (insErr) {
      // Do not leave an orphaned object behind.
      await (await this.db()).storage.from(BUCKET).remove([path]);
      return false;
    }
    return true;
  }

  async completeAnalysis(analysisId: string, result: Parameters<DataRepo["completeAnalysis"]>[1]) {
    const { data, error } = await this.admin().rpc("complete_analysis", { p_analysis_id: analysisId, p_result: result });
    if (error) return "error" as const;
    return data as Awaited<ReturnType<DataRepo["completeAnalysis"]>>;
  }

  async failAnalysis(analysisId: string, code: string) {
    await this.admin().rpc("fail_analysis", { p_analysis_id: analysisId, p_code: code });
  }

  async recordAiRun(run: Parameters<DataRepo["recordAiRun"]>[0]) {
    const u = await this.getUser();
    if (!u) return;
    await this.admin().from("ai_runs").insert({
      analysis_id: run.analysisId,
      user_id: u.id,
      provider: run.provider,
      model: run.model,
      purpose: run.purpose,
      status: run.status,
      latency_ms: run.latencyMs,
      input_tokens: run.inputTokens ?? null,
      output_tokens: run.outputTokens ?? null,
      error_code: run.errorCode ?? null,
    });
  }

  async listAnalyses(limit = 100) {
    const u = await this.requireUser();
    const { data } = await (await this.db())
      .from("analyses")
      .select(SUMMARY_COLS)
      .eq("user_id", u.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r) => toSummary(r));
  }

  async listTeamAnalyses(limit = 100) {
    const u = await this.requireUser();
    if (this.acting) return [];
    const db = await this.db();
    const { data: teams } = await db.from("team_members").select("owner_id").eq("member_id", u.id);
    const owners = (teams ?? []).map((t) => t.owner_id as string);
    if (!owners.length) return [];
    const [{ data }, labels] = await Promise.all([
      db.from("analyses").select(SUMMARY_COLS).in("user_id", owners).order("created_at", { ascending: false }).limit(limit),
      this.ownerLabels(owners),
    ]);
    return (data ?? []).map((r) => ({ ...toSummary(r, u.id), ownerLabel: labels.get(r.user_id as string) ?? "Ekip" }));
  }

  /** Display names of team owners (read with the service role only after membership was verified). */
  private async ownerLabels(ownerIds: string[]) {
    const { data } = await this.admin().from("profiles").select("id,company_name,display_name").in("id", ownerIds);
    const out = new Map<string, string>();
    for (const p of data ?? []) out.set(p.id, p.company_name || p.display_name || "Ekip");
    return out;
  }

  async getAnalysis(id: string): Promise<AnalysisDetail | null> {
    const u = await this.getUser();
    if (!u) return null;
    return loadDetail(await this.db(), id, u.id, this.acting ? u.id : undefined);
  }

  async getAssetBytes(analysisId: string, which?: number | "screenshot") {
    const db = await this.db();
    let q = db.from("analysis_assets").select("storage_path,mime_type").eq("analysis_id", analysisId);
    if (this.acting) q = q.eq("user_id", (await this.requireUser()).id);
    q =
      which === undefined ? q.eq("kind", "creative") : which === "screenshot" ? q.eq("kind", "landing_screenshot") : q.eq("kind", "video_frame").eq("frame_index", which);
    const { data: asset } = await q.maybeSingle();
    if (!asset) return null;
    // Download with the user client: storage policies decide.
    const { data, error } = await db.storage.from(BUCKET).download(asset.storage_path);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: asset.mime_type as string };
  }

  async setSpeechTranscript(analysisId: string, text: string) {
    const u = await this.requireUser();
    const { error } = await this.admin()
      .from("analyses")
      .update({ speech_transcript: text.slice(0, 6000) })
      .eq("id", analysisId)
      .eq("user_id", u.id)
      .eq("status", "processing");
    return !error;
  }

  async deleteAnalysis(id: string) {
    const db = await this.db();
    const { data: assets } = await db.from("analysis_assets").select("storage_path").eq("analysis_id", id);
    if (assets?.length) await db.storage.from(BUCKET).remove(assets.map((a) => a.storage_path));
    const { error, count } = await db.from("analyses").delete({ count: "exact" }).eq("id", id);
    return !error && (count ?? 0) > 0;
  }

  async saveAppeal(analysisId: string, appeal: AppealOut) {
    const u = await this.requireUser();
    const { error } = await this.admin().rpc("upsert_appeal_draft", { p_analysis_id: analysisId, p_user_id: u.id, p_appeal: appeal });
    return !error;
  }

  async applyDemoPurchase(packageId: string, eventId: string) {
    const u = await this.requireUser();
    const pkg = findPackage(packageId);
    if (!pkg) return { applied: false };
    return new SupabaseAdminRepo().applyPurchase({
      provider: "demo",
      eventId,
      orderId: eventId,
      userId: u.id,
      packageId: pkg.id,
      credits: pkg.credits,
      amountMinor: 0,
      currency: pkg.currency,
      isDemo: true,
    });
  }

  async deleteAccount() {
    const u = await this.requireUser();
    const admin = this.admin();
    // 1) storage objects under the user's folder (walk analysis folders)
    const { data: assets } = await admin.from("analysis_assets").select("storage_path").eq("user_id", u.id);
    if (assets?.length) await admin.storage.from(BUCKET).remove(assets.map((a) => a.storage_path));
    const { data: logos } = await admin.from("brands").select("logo_path").eq("user_id", u.id).not("logo_path", "is", null);
    if (logos?.length) await admin.storage.from(BUCKET).remove(logos.map((b) => b.logo_path as string));
    // 2) sign out everywhere, then delete the auth user (cascades all user-owned rows; purchases keep a null user_id)
    await (await this.db()).auth.signOut({ scope: "global" });
    const { error } = await admin.auth.admin.deleteUser(u.id);
    return !error;
  }

  async listFindingFeedback(analysisId: string) {
    const u = await this.requireUser();
    const { data } = await (await this.db())
      .from("finding_feedback")
      .select("finding_id,verdict,reason,note")
      .eq("user_id", u.id)
      .eq("analysis_id", analysisId);
    return (data ?? []).map((r) => ({ findingId: r.finding_id, verdict: r.verdict, reason: r.reason, note: r.note }));
  }

  async saveFindingFeedback(analysisId: string, fb: FindingFeedback) {
    const u = await this.requireUser();
    const db = await this.db();
    const { error } = await db
      .from("finding_feedback")
      .insert({ user_id: u.id, analysis_id: analysisId, finding_id: fb.findingId, verdict: fb.verdict, reason: fb.reason, note: fb.note });
    if (!error) return true;
    if (error.code !== "23505") return false;
    const { error: updErr, count } = await db
      .from("finding_feedback")
      .update({ verdict: fb.verdict, reason: fb.reason, note: fb.note }, { count: "exact" })
      .eq("user_id", u.id)
      .eq("finding_id", fb.findingId);
    return !updErr && (count ?? 0) > 0;
  }

  async getTeam(): Promise<TeamState> {
    const u = await this.requireUser();
    const db = await this.db();
    const [{ data: members }, { data: invites }, { data: memberships }] = await Promise.all([
      db.from("team_members").select("member_id,member_email,created_at").eq("owner_id", u.id).order("created_at"),
      db.from("team_invites").select("id,email,expires_at").eq("owner_id", u.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
      db.from("team_members").select("owner_id,created_at").eq("member_id", u.id),
    ]);
    const labels = memberships?.length ? await this.ownerLabels(memberships.map((m) => m.owner_id)) : new Map<string, string>();
    return {
      members: (members ?? []).map((m) => ({ memberId: m.member_id, email: m.member_email, createdAt: m.created_at })),
      invites: (invites ?? []).map((i) => ({ id: i.id, email: i.email, expiresAt: i.expires_at })),
      memberships: (memberships ?? []).map((m) => ({ ownerId: m.owner_id, ownerLabel: labels.get(m.owner_id) ?? "Ekip", createdAt: m.created_at })),
    };
  }

  async createTeamInvite(email: string, tokenHash: string, expiresAt: string) {
    const u = await this.requireUser();
    const e = email.trim().toLowerCase();
    if (e === u.email.toLowerCase()) return "self" as const;
    const team = await this.getTeam();
    if (team.members.some((m) => m.email.toLowerCase() === e)) return "exists" as const;
    if (team.members.length + team.invites.filter((i) => i.email !== e).length >= TEAM_LIMIT) return "limit" as const;
    const db = await this.db();
    await db.from("team_invites").delete().eq("owner_id", u.id).eq("email", e).is("accepted_at", null);
    const { error } = await db.from("team_invites").insert({ owner_id: u.id, email: e, token_hash: tokenHash, expires_at: expiresAt });
    return error ? ("error" as const) : ("ok" as const);
  }

  async deleteTeamInvite(id: string) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db()).from("team_invites").delete({ count: "exact" }).eq("id", id).eq("owner_id", u.id);
    return !error && (count ?? 0) > 0;
  }

  async removeTeamMember(memberId: string) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db()).from("team_members").delete({ count: "exact" }).eq("owner_id", u.id).eq("member_id", memberId);
    return !error && (count ?? 0) > 0;
  }

  async leaveTeam(ownerId: string) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db()).from("team_members").delete({ count: "exact" }).eq("owner_id", ownerId).eq("member_id", u.id);
    return !error && (count ?? 0) > 0;
  }

  async acceptTeamInvite(tokenHash: string) {
    const u = await this.requireUser();
    if (this.acting) return "error" as const;
    const admin = this.admin();
    const { data: inv } = await admin
      .from("team_invites")
      .select("id,owner_id,email")
      .eq("token_hash", tokenHash)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!inv) return "invalid" as const;
    if (inv.owner_id === u.id) return "self" as const;
    if (inv.email !== u.email.toLowerCase()) return "wrong_email" as const;
    const { error } = await admin
      .from("team_members")
      .upsert({ owner_id: inv.owner_id, member_id: u.id, member_email: inv.email }, { onConflict: "owner_id,member_id", ignoreDuplicates: true });
    if (error) return "error" as const;
    await admin.from("team_invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
    return "ok" as const;
  }

  async createReviewShare(analysisId: string, tokenHash: string, expiresAt: string, note: string | null) {
    const u = await this.requireUser();
    const { error } = await (await this.db())
      .from("review_shares")
      .insert({ user_id: u.id, analysis_id: analysisId, token_hash: tokenHash, expires_at: expiresAt, note });
    return !error;
  }

  async listReviewShares(analysisId: string) {
    const u = await this.requireUser();
    const { data } = await (await this.db())
      .from("review_shares")
      .select("id,analysis_id,note,expires_at,revoked_at,view_count,created_at")
      .eq("user_id", u.id)
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id,
      analysisId: r.analysis_id,
      note: r.note,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      viewCount: r.view_count,
      createdAt: r.created_at,
    }));
  }

  async revokeReviewShare(id: string) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db())
      .from("review_shares")
      .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", u.id)
      .is("revoked_at", null);
    return !error && (count ?? 0) > 0;
  }

  async listApiKeys() {
    const u = await this.requireUser();
    const { data } = await (await this.db())
      .from("api_keys")
      .select("id,name,key_prefix,created_at,last_used_at,revoked_at")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false });
    return (data ?? []).map((k) => ({ id: k.id, name: k.name, prefix: k.key_prefix, createdAt: k.created_at, lastUsedAt: k.last_used_at, revokedAt: k.revoked_at }));
  }

  async createApiKey(name: string, prefix: string, keyHash: string) {
    const u = await this.requireUser();
    if (this.acting) return "error" as const;
    const keys = await this.listApiKeys();
    if (keys.filter((k) => !k.revokedAt).length >= API_KEY_LIMIT) return "limit" as const;
    const { error } = await (await this.db()).from("api_keys").insert({ user_id: u.id, name, key_prefix: prefix, key_hash: keyHash });
    return error ? ("error" as const) : ("ok" as const);
  }

  async revokeApiKey(id: string) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db())
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", u.id)
      .is("revoked_at", null);
    return !error && (count ?? 0) > 0;
  }

  async listPins() {
    const u = await this.requireUser();
    const { data } = await (await this.db())
      .from("inspiration_pins")
      .select("id,ad_archive_id,page_name,title,body,country,delivery_start,note,created_at")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false })
      .limit(PIN_LIMIT);
    return (data ?? []).map((p) => ({
      id: p.id,
      adArchiveId: p.ad_archive_id,
      pageName: p.page_name,
      title: p.title,
      body: p.body,
      country: p.country,
      deliveryStart: p.delivery_start,
      note: p.note,
      createdAt: p.created_at,
    }));
  }

  async savePin(pin: InspirationPinInput) {
    const u = await this.requireUser();
    const db = await this.db();
    const { count } = await db.from("inspiration_pins").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    if ((count ?? 0) >= PIN_LIMIT) return "limit" as const;
    const { error } = await db.from("inspiration_pins").insert({
      user_id: u.id,
      ad_archive_id: pin.adArchiveId,
      page_name: pin.pageName,
      title: pin.title,
      body: pin.body,
      country: pin.country,
      delivery_start: pin.deliveryStart,
      note: pin.note,
    });
    if (error?.code === "23505") return "exists" as const;
    return error ? ("error" as const) : ("ok" as const);
  }

  async deletePin(id: string) {
    const u = await this.requireUser();
    const { error, count } = await (await this.db()).from("inspiration_pins").delete({ count: "exact" }).eq("id", id).eq("user_id", u.id);
    return !error && (count ?? 0) > 0;
  }
}

/**
 * Loads one analysis with its findings, variants, appeal and asset list. With a user client RLS
 * decides visibility; with the service role (API key, review link) ownerId must be given.
 */
async function loadDetail(db: SupabaseClient, id: string, viewerId: string, ownerId?: string): Promise<AnalysisDetail | null> {
    let aq = db.from("analyses").select("*").eq("id", id);
    if (ownerId) aq = aq.eq("user_id", ownerId);
    const { data: a } = await aq.maybeSingle();
    if (!a) return null;
    const [{ data: findings }, { data: variants }, { data: appeal }, { data: asset }] = await Promise.all([
      db
        .from("findings")
        .select("*, rule_versions(id,version,status,source_org,source_title,source_url,source_reference,effective_date,last_verified_at,legal_review_status,rule_card_id)")
        .eq("analysis_id", id)
        .order("position"),
      db.from("generated_variants").select("*").eq("analysis_id", id).order("kind").order("position"),
      db.from("appeal_drafts").select("*").eq("analysis_id", id).maybeSingle(),
      db.from("analysis_assets").select("id,kind,frame_index,frame_time_ms,mime_type,width,height,size_bytes").eq("analysis_id", id),
    ]);
    const assets = (asset ?? []) as Row[];
    const creative = assets.find((x) => x.kind === "creative") ?? null;
    const frames = assets
      .filter((x) => x.kind === "video_frame")
      .map((x) => ({
        index: x.frame_index as number,
        timeMs: (x.frame_time_ms as number) ?? 0,
        width: (x.width as number) ?? null,
        height: (x.height as number) ?? null,
      }))
      .sort((x, y) => x.index - y.index);
    const fv: FindingView[] = (findings ?? []).map((f: Row) => {
      const rv = f.rule_versions as Row | null;
      return {
        id: f.id as string,
        domain: f.domain as FindingView["domain"],
        severity: f.severity as FindingView["severity"],
        field: (f.field as string) ?? null,
        matchedText: (f.matched_text as string) ?? null,
        title: f.title as string,
        explanation: f.explanation as string,
        suggestion: f.suggestion as string,
        origin: f.origin as string,
        rule: rv
          ? {
              id: rv.rule_card_id as string,
              version: rv.version as number,
              status: rv.status as RuleRecord["status"],
              sourceOrg: rv.source_org as string,
              sourceTitle: rv.source_title as string,
              sourceUrl: rv.source_url as string,
              sourceReference: (rv.source_reference as string) ?? null,
              effectiveDate: (rv.effective_date as string) ?? null,
              lastVerifiedAt: (rv.last_verified_at as string) ?? null,
              legalReviewStatus: rv.legal_review_status as string,
            }
          : null,
      };
    });
    return {
      ...toSummary(a, viewerId),
      brandId: (a.brand_id as string) ?? null,
      description: a.description,
      rejectionMessage: a.rejection_message,
      safeText: a.safe_text,
      scoreBreakdown: a.score_breakdown,
      engineVersion: a.engine_version,
      aiProvider: a.ai_provider,
      demo: a.demo,
      completedAt: a.completed_at,
      findings: fv,
      variants: (variants ?? [])
        .map((v: Row) => ({
          kind: v.kind as "safe" | "variant",
          position: v.position as number,
          tone: v.tone as string,
          headline: v.headline as string,
          primaryText: v.primary_text as string,
          description: v.description as string,
          recheckRed: v.recheck_red as number,
          recheckYellow: v.recheck_yellow as number,
        }))
        .sort((x, y) => (x.kind === y.kind ? x.position - y.position : x.kind === "safe" ? -1 : 1)),
      appeal: appeal
        ? {
            rejection_message: appeal.rejection_message,
            detected_policies: appeal.detected_policies,
            recommendation: appeal.recommendation,
            explanation_tr: appeal.explanation_tr,
            draft_tr: appeal.draft_tr,
            draft_en: appeal.draft_en,
            checklist: appeal.checklist,
            createdAt: appeal.created_at,
          }
        : null,
      asset: creative
        ? {
            id: creative.id as string,
            mime: creative.mime_type as string,
            width: (creative.width as number) ?? null,
            height: (creative.height as number) ?? null,
            sizeBytes: creative.size_bytes as number,
          }
        : null,
      frames,
      videoMeta: (a.video_meta as VideoMeta | null) ?? null,
      transcript: a.transcript ?? null,
      landingUrl: a.landing_url ?? null,
      speechTranscript: a.speech_transcript ?? null,
      hasLandingScreenshot: assets.some((x) => x.kind === "landing_screenshot"),
      creditCost: (a.credit_cost as number) ?? 1,
    };
}


export class SupabaseAdminRepo implements AdminRepo {
  private admin = createAdminClient();

  async applyPurchase(p: Parameters<AdminRepo["applyPurchase"]>[0]) {
    const { data, error } = await this.admin.rpc("apply_purchase_event", {
      p_provider: p.provider,
      p_event_id: p.eventId,
      p_order_id: p.orderId,
      p_user_id: p.userId,
      p_package_id: p.packageId,
      p_credits: p.credits,
      p_amount_minor: p.amountMinor,
      p_currency: p.currency,
      p_is_demo: p.isDemo,
    });
    if (error) throw new Error("purchase_failed");
    const row = (Array.isArray(data) ? data[0] : data) as { applied: boolean } | null;
    return { applied: Boolean(row?.applied) };
  }

  async purgeExpired() {
    const { data: expired } = await this.admin
      .from("analyses")
      .select("id, analysis_assets(storage_path)")
      .lt("expires_at", new Date().toISOString())
      .limit(500);
    if (!expired?.length) return 0;
    const paths = expired.flatMap((a) => ((a.analysis_assets as { storage_path: string }[]) ?? []).map((x) => x.storage_path));
    if (paths.length) await this.admin.storage.from(BUCKET).remove(paths);
    await this.admin.from("analyses").delete().in("id", expired.map((a) => a.id));
    return expired.length;
  }

  async listSeasonReminderRecipients() {
    const { data: profiles } = await this.admin
      .from("profiles")
      .select("id, display_name, default_sector")
      .eq("season_reminders", true)
      .limit(1000);
    const out: Awaited<ReturnType<AdminRepo["listSeasonReminderRecipients"]>> = [];
    for (const p of profiles ?? []) {
      const { data } = await this.admin.auth.admin.getUserById(p.id);
      const u = data?.user;
      if (!u?.email || !u.email_confirmed_at) continue;
      out.push({ userId: p.id, email: u.email, displayName: p.display_name, sector: p.default_sector });
    }
    return out;
  }

  async claimSeasonReminder(userId: string, eventKey: string) {
    const { data, error } = await this.admin
      .from("season_reminder_log")
      .upsert({ user_id: userId, event_key: eventKey }, { onConflict: "user_id,event_key", ignoreDuplicates: true })
      .select("user_id");
    if (error) return false;
    return (data ?? []).length > 0;
  }

  async releaseSeasonReminder(userId: string, eventKey: string) {
    await this.admin.from("season_reminder_log").delete().eq("user_id", userId).eq("event_key", eventKey);
  }

  async listNewsletterRecipients() {
    const { data: rows } = await this.admin
      .from("user_consents")
      .select("user_id,granted,created_at")
      .eq("consent_type", "marketing_email")
      .order("created_at", { ascending: false })
      .limit(20000);
    const latest = new Map<string, boolean>();
    for (const r of rows ?? []) if (!latest.has(r.user_id)) latest.set(r.user_id, r.granted);
    const ids = [...latest].filter(([, g]) => g).map(([id]) => id);
    if (!ids.length) return [];
    const { data: profiles } = await this.admin.from("profiles").select("id,display_name,default_sector").in("id", ids);
    const out: Awaited<ReturnType<AdminRepo["listNewsletterRecipients"]>> = [];
    for (const p of profiles ?? []) {
      const { data } = await this.admin.auth.admin.getUserById(p.id);
      const u = data?.user;
      if (!u?.email || !u.email_confirmed_at) continue;
      out.push({ userId: p.id, email: u.email, displayName: p.display_name, sector: p.default_sector });
    }
    return out;
  }

  async claimNewsletter(userId: string, period: string) {
    const { data, error } = await this.admin
      .from("newsletter_log")
      .upsert({ user_id: userId, period }, { onConflict: "user_id,period", ignoreDuplicates: true })
      .select("user_id");
    if (error) return false;
    return (data ?? []).length > 0;
  }

  async releaseNewsletter(userId: string, period: string) {
    await this.admin.from("newsletter_log").delete().eq("user_id", userId).eq("period", period);
  }

  private async shareFor(tokenHash: string) {
    const { data } = await this.admin
      .from("review_shares")
      .select("id,user_id,analysis_id,note,expires_at,revoked_at,view_count")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
    return data;
  }

  async getSharedReview(tokenHash: string): Promise<SharedReview | null> {
    const sh = await this.shareFor(tokenHash);
    if (!sh) return null;
    const analysis = await loadDetail(this.admin, sh.analysis_id, sh.user_id, sh.user_id);
    if (!analysis || analysis.status !== "completed") return null;
    await this.admin.from("review_shares").update({ view_count: (sh.view_count ?? 0) + 1 }).eq("id", sh.id);
    const branding = await brandingOf(this.admin, this.admin, { user_id: sh.user_id, brand_id: analysis.brandId });
    return { analysis, branding, note: sh.note, expiresAt: sh.expires_at };
  }

  async getSharedAssetBytes(tokenHash: string, which?: number | "screenshot") {
    const sh = await this.shareFor(tokenHash);
    if (!sh) return null;
    return new SupabaseRepo({ id: sh.user_id, email: "" }).getAssetBytes(sh.analysis_id, which);
  }

  async resolveApiKey(keyHash: string) {
    const { data: k } = await this.admin.from("api_keys").select("id,user_id").eq("key_hash", keyHash).is("revoked_at", null).maybeSingle();
    if (!k) return null;
    const { data } = await this.admin.auth.admin.getUserById(k.user_id);
    if (!data?.user) return null;
    await this.admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
    return { id: k.user_id as string, email: data.user.email ?? "" };
  }

  repoForUser(user: SessionUser): DataRepo {
    return new SupabaseRepo(user);
  }
}
