import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import type { AppealOut, RuleRecord, VideoMeta } from "@/lib/engine/types";
import type { RuleCardDef, Sector } from "@/lib/rules/catalog";
import { findPackage } from "@/lib/payments/packages";
import type {
  AdminRepo,
  AnalysisDetail,
  AnalysisSummary,
  AuthResult,
  DataRepo,
  FindingView,
  SessionUser,
  StartAnalysisResult,
} from "./types";

const BUCKET = "creatives";

type Row = Record<string, unknown>;

function toSummary(r: Row): AnalysisSummary {
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
    createdAt: r.created_at as string,
    expiresAt: (r.expires_at as string) ?? null,
  };
}

export function ruleFromRow(v: Row, card: Row): RuleRecord {
  return {
    id: card.id as string,
    domain: card.domain as RuleCardDef["domain"],
    category: card.category as string,
    sector: card.sector as Sector,
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

  private async db() {
    if (!this._client) this._client = await createUserClient();
    return this._client;
  }
  private admin() {
    return createAdminClient();
  }

  async getUser(): Promise<SessionUser | null> {
    if (this._user !== undefined) return this._user;
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
    const { data } = await (await this.db()).from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      displayName: data.display_name,
      companyName: data.company_name,
      defaultSector: data.default_sector,
      onboardingCompletedAt: data.onboarding_completed_at,
      retentionDays: data.retention_days,
    };
  }

  async updateProfile(patch: Parameters<DataRepo["updateProfile"]>[0]) {
    const u = await this.requireUser();
    const row: Row = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.companyName !== undefined) row.company_name = patch.companyName;
    if (patch.defaultSector !== undefined) row.default_sector = patch.defaultSector;
    if (patch.onboardingCompletedAt !== undefined) row.onboarding_completed_at = patch.onboardingCompletedAt;
    if (patch.retentionDays !== undefined) row.retention_days = patch.retentionDays;
    const { error } = await (await this.db()).from("profiles").update(row).eq("id", u.id);
    return !error;
  }

  async listBrands() {
    const { data } = await (await this.db()).from("brands").select("id,name,sector,tone").order("created_at");
    return (data ?? []) as Awaited<ReturnType<DataRepo["listBrands"]>>;
  }

  async createBrand(input: Parameters<DataRepo["createBrand"]>[0]) {
    const u = await this.requireUser();
    const { data, error } = await (await this.db())
      .from("brands")
      .insert({ user_id: u.id, name: input.name, sector: input.sector, tone: input.tone })
      .select("id,name,sector,tone")
      .single();
    return error ? null : (data as Awaited<ReturnType<DataRepo["createBrand"]>>);
  }

  async getRules(sector: Sector) {
    const all = await this.listAllRules();
    return all.filter((r) => (r.status === "active" || r.status === "requires_review") && (r.sector === "genel" || r.sector === sector));
  }

  async listAllRules() {
    const { data } = await (await this.db())
      .from("rule_versions")
      .select("*, rule_cards!inner(id,domain,category,sector)")
      .in("status", ["active", "requires_review"]);
    return (data ?? []).map((v: Row) => ruleFromRow(v, v.rule_cards as Row));
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
    });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("insufficient_credits")) return { ok: false, code: "insufficient_credits" };
      if (m.includes("rate_limited")) return { ok: false, code: "rate_limited" };
      if (m.includes("brand_not_found")) return { ok: false, code: "brand_not_found" };
      return { ok: false, code: "error" };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { analysis_id: string; status: AnalysisSummary["status"]; created: boolean };
    if (row.created && (p.mediaType !== "image" || p.transcript || p.landingUrl)) {
      // Users have no UPDATE grant on analyses; the server sets the media fields right after creation.
      const { error: updErr } = await this.admin()
        .from("analyses")
        .update({ media_type: p.mediaType, video_meta: p.videoMeta, transcript: p.transcript, landing_url: p.landingUrl })
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
    const { data } = await (await this.db())
      .from("analyses")
      .select("id,status,failure_code,sector,headline,primary_text,meta_risk_score,meta_risk_level,legal_risk_level,legal_finding_count,creative_score,media_type,created_at,expires_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map(toSummary);
  }

  async getAnalysis(id: string): Promise<AnalysisDetail | null> {
    const db = await this.db();
    const { data: a } = await db.from("analyses").select("*").eq("id", id).maybeSingle();
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
      ...toSummary(a),
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
    };
  }

  async getAssetBytes(analysisId: string, frameIndex?: number) {
    const db = await this.db();
    let q = db.from("analysis_assets").select("storage_path,mime_type").eq("analysis_id", analysisId);
    q = frameIndex === undefined ? q.eq("kind", "creative") : q.eq("kind", "video_frame").eq("frame_index", frameIndex);
    const { data: asset } = await q.maybeSingle();
    if (!asset) return null;
    // Download with the user client: storage policies decide.
    const { data, error } = await db.storage.from(BUCKET).download(asset.storage_path);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: asset.mime_type as string };
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
    // 2) sign out everywhere, then delete the auth user (cascades all user-owned rows; purchases keep a null user_id)
    await (await this.db()).auth.signOut({ scope: "global" });
    const { error } = await admin.auth.admin.deleteUser(u.id);
    return !error;
  }
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
}
