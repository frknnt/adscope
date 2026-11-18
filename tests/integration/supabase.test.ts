/**
 * Integration tests against a running local Supabase stack (`supabase start` + `supabase db reset`).
 * Uses the same RPCs, RLS policies and storage policies the app uses. Skips when the stack is not reachable.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { runPipeline } from "@/lib/engine/pipeline";
import { ruleFromRow } from "@/lib/data/supabase-repo";

// Values come from `npx supabase status -o env` (API_URL, PUBLISHABLE_KEY, SECRET_KEY) or .env.local.
// Never hard-code keys here; the suite is skipped when they are not provided.
const URL_ = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUB = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

let reachable = false;
try {
  if (!URL_ || !PUB || !SECRET) throw new Error("not configured");
  const r = await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: PUB }, signal: AbortSignal.timeout(2000) });
  reachable = r.ok;
} catch {
  reachable = false;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () => createClient(URL_, SECRET, opts);

async function newUser(): Promise<{ id: string; email: string; client: SupabaseClient }> {
  const email = `it-${randomUUID()}@example.com`;
  const password = "Test-sifre-123";
  const anon = createClient(URL_, PUB, opts);
  const { data, error } = await anon.auth.signUp({ email, password });
  if (error || !data.user) throw new Error(`signup failed: ${error?.message}`);
  const client = createClient(URL_, PUB, opts);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw new Error(s.error.message);
  return { id: data.user.id, email, client };
}

async function startAnalysis(userId: string, requestId = randomUUID(), cost?: number) {
  const { data, error } = await admin().rpc("start_analysis", {
    p_user_id: userId, p_client_request_id: requestId, p_brand_id: null, p_sector: "takviye_gida",
    p_headline: "Test", p_primary_text: "7 günde 5 kilo ver! Garantili sonuç.", p_description: "", p_rejection_message: null, p_demo: true, p_hourly_limit: 100,
    ...(cost === undefined ? {} : { p_credit_cost: cost }),
  });
  if (error) throw new Error(error.message);
  return (data as { analysis_id: string; status: string; created: boolean }[])[0];
}

async function engineResult() {
  const { data } = await admin().from("rule_versions").select("*, rule_cards(*)").in("status", ["active", "requires_review"]);
  const rules = (data ?? []).map((r) => ruleFromRow(r, r.rule_cards));
  const { result } = await runPipeline({
    input: { sector: "takviye_gida", headline: "Test", primaryText: "7 günde 5 kilo ver! Garantili sonuç.", description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
    rules,
    ai: null,
  });
  return result;
}

const balance = async (c: SupabaseClient) => Number((await c.rpc("get_credit_balance")).data);

describe.skipIf(!reachable)("Supabase: auth, RLS, storage, credits", () => {
  let a: Awaited<ReturnType<typeof newUser>>;
  let b: Awaited<ReturnType<typeof newUser>>;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
  });

  it("grants the 3-credit signup bonus exactly once", async () => {
    expect(await balance(a.client)).toBe(3);
    const { data } = await a.client.from("credit_ledger").select("reason, delta, idempotency_key");
    expect(data?.filter((r) => r.reason === "signup_bonus")).toHaveLength(1);
    // A second bonus row with the same key is rejected by the unique idempotency key.
    const dup = await admin().from("credit_ledger").insert({ user_id: a.id, delta: 3, reason: "signup_bonus", idempotency_key: `signup_bonus:${a.id}` });
    expect(dup.error).not.toBeNull();
    expect(await balance(a.client)).toBe(3);
  });

  it("users cannot write credits or call privileged functions", async () => {
    const ins = await a.client.from("credit_ledger").insert({ user_id: a.id, delta: 100, reason: "admin_adjustment", idempotency_key: randomUUID() });
    expect(ins.error).not.toBeNull();
    const rpc = await a.client.rpc("apply_purchase_event", {
      p_provider: "demo", p_event_id: randomUUID(), p_order_id: "x", p_user_id: a.id, p_package_id: "baslangic", p_credits: 30, p_amount_minor: 0, p_currency: "TRY", p_is_demo: true,
    });
    expect(rpc.error).not.toBeNull();
    const start = await a.client.rpc("start_analysis", {
      p_user_id: b.id, p_client_request_id: randomUUID(), p_brand_id: null, p_sector: "genel", p_headline: "", p_primary_text: "x", p_description: "", p_rejection_message: null, p_demo: true, p_hourly_limit: 100,
    });
    expect(start.error).not.toBeNull();
    const anon = createClient(URL_, PUB, opts);
    expect((await anon.from("analyses").select("id")).data ?? []).toHaveLength(0);
    expect((await anon.from("credit_ledger").select("id")).data ?? []).toHaveLength(0);
  });

  it("ledger rows are immutable", async () => {
    const { data } = await admin().from("credit_ledger").select("id").eq("user_id", a.id).limit(1).single();
    const upd = await admin().from("credit_ledger").update({ delta: 999 }).eq("id", data!.id);
    expect(upd.error).not.toBeNull();
    const del = await admin().from("credit_ledger").delete().eq("id", data!.id);
    expect(del.error).not.toBeNull();
  });

  it("a completed analysis costs exactly one credit, even when completed twice", async () => {
    const started = await startAnalysis(a.id);
    expect(started.created).toBe(true);
    const result = await engineResult();
    const first = await admin().rpc("complete_analysis", { p_analysis_id: started.analysis_id, p_result: result });
    const second = await admin().rpc("complete_analysis", { p_analysis_id: started.analysis_id, p_result: result });
    expect(first.data).toBe("completed");
    expect(second.data).toBe("already_completed");
    expect(await balance(a.client)).toBe(2);
    const { data: findings } = await a.client.from("findings").select("id").eq("analysis_id", started.analysis_id);
    expect((findings ?? []).length).toBeGreaterThan(0);
  });

  it("a failed analysis consumes nothing and cannot be completed later", async () => {
    const before = await balance(a.client);
    const started = await startAnalysis(a.id);
    await admin().rpc("fail_analysis", { p_analysis_id: started.analysis_id, p_code: "engine_error" });
    const late = await admin().rpc("complete_analysis", { p_analysis_id: started.analysis_id, p_result: await engineResult() });
    expect(late.data).toBe("already_failed");
    expect(await balance(a.client)).toBe(before);
  });

  it("double submit with the same request id returns the same analysis", async () => {
    const id = randomUUID();
    const [x, y] = await Promise.all([startAnalysis(a.id, id), startAnalysis(a.id, id)]);
    expect(x.analysis_id).toBe(y.analysis_id);
    expect([x.created, y.created].filter(Boolean)).toHaveLength(1);
  });

  it("refuses to start when the balance is zero", async () => {
    const c = await newUser();
    for (let i = 0; i < 3; i++) {
      const s = await startAnalysis(c.id);
      await admin().rpc("complete_analysis", { p_analysis_id: s.analysis_id, p_result: await engineResult() });
    }
    expect(await balance(c.client)).toBe(0);
    const res = await admin().rpc("start_analysis", {
      p_user_id: c.id, p_client_request_id: randomUUID(), p_brand_id: null, p_sector: "genel", p_headline: "", p_primary_text: "x", p_description: "", p_rejection_message: null, p_demo: true, p_hourly_limit: 100,
    });
    expect(res.error?.message ?? "").toMatch(/insufficient_credits/);
  });

  it("users cannot read or modify each other's analyses", async () => {
    const mine = await startAnalysis(a.id);
    const seen = await b.client.from("analyses").select("id").eq("id", mine.analysis_id);
    expect(seen.data).toHaveLength(0);
    const upd = await b.client.from("analyses").update({ headline: "hacked" }).eq("id", mine.analysis_id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b.client.from("analyses").delete().eq("id", mine.analysis_id).select();
    expect(del.data ?? []).toHaveLength(0);
    const still = await a.client.from("analyses").select("headline").eq("id", mine.analysis_id).single();
    expect(still.data?.headline).toBe("Test");
    // Cannot steal a row by rewriting user_id on own rows either.
    const own = await a.client.from("profiles").update({ id: b.id }).eq("id", a.id).select();
    expect(own.error ?? (own.data ?? []).length === 0).toBeTruthy();
  });

  it("storage: users can only write and read inside their own folder", async () => {
    const bytes = readFileSync("tests/fixtures/ad.png");
    const ownPath = `${a.id}/${randomUUID()}/x.png`;
    const up = await a.client.storage.from("creatives").upload(ownPath, bytes, { contentType: "image/png" });
    expect(up.error).toBeNull();
    const foreign = await a.client.storage.from("creatives").upload(`${b.id}/${randomUUID()}/x.png`, bytes, { contentType: "image/png" });
    expect(foreign.error).not.toBeNull();
    const readByB = await b.client.storage.from("creatives").download(ownPath);
    expect(readByB.error).not.toBeNull();
    const readByA = await a.client.storage.from("creatives").download(ownPath);
    expect(readByA.error).toBeNull();
    const delByB = await b.client.storage.from("creatives").remove([ownPath]);
    expect(delByB.data ?? []).toHaveLength(0);
    const bad = await a.client.storage.from("creatives").upload(`${a.id}/${randomUUID()}/x.svg`, Buffer.from("<svg/>"), { contentType: "image/svg+xml" });
    expect(bad.error).not.toBeNull();
  });

  it("a payment webhook delivered twice adds credit once", async () => {
    const before = await balance(b.client);
    const args = { p_provider: "lemonsqueezy", p_event_id: `order_created:${randomUUID()}`, p_order_id: randomUUID(), p_user_id: b.id, p_package_id: "baslangic", p_credits: 30, p_amount_minor: 19900, p_currency: "TRY", p_is_demo: false };
    const [r1, r2] = await Promise.all([admin().rpc("apply_purchase_event", args), admin().rpc("apply_purchase_event", args)]);
    expect(r1.error?.message ?? null).toBeNull();
    expect(r2.error?.message ?? null).toBeNull();
    const applied = [r1, r2].map((r) => (r.data as { applied: boolean }[])[0].applied);
    expect(applied.filter(Boolean)).toHaveLength(1);
    expect(await balance(b.client)).toBe(before + 30);
  });

  it("draft rule versions are not readable by clients", async () => {
    const { data } = await a.client.from("rule_versions").select("status");
    expect((data ?? []).some((r) => r.status === "draft")).toBe(false);
    expect((data ?? []).length).toBeGreaterThan(10);
  });

  it("video analyses keep frames per analysis and enforce media constraints", async () => {
    const run = await startAnalysis(a.id);
    const id = run.analysis_id;
    // A video row must carry its metadata; users cannot set media fields themselves.
    const noMeta = await admin().from("analyses").update({ media_type: "video" }).eq("id", id);
    expect(noMeta.error).not.toBeNull();
    const byUser = await a.client.from("analyses").update({ transcript: "x" }).eq("id", id).select();
    expect(byUser.data ?? []).toHaveLength(0);
    const meta = { mime: "video/mp4", durationSec: 12, width: 1080, height: 1920, sizeBytes: 1000, frameCount: 2 };
    const ok = await admin().from("analyses").update({ media_type: "video", video_meta: meta, transcript: "Merhaba", landing_url: "https://ornek.com/" }).eq("id", id);
    expect(ok.error).toBeNull();
    const badUrl = await admin().from("analyses").update({ landing_url: "javascript:alert(1)" }).eq("id", id);
    expect(badUrl.error).not.toBeNull();

    const row = (i: number) => ({ analysis_id: id, user_id: a.id, storage_path: `${a.id}/${id}/${randomUUID()}.jpg`, mime_type: "image/jpeg", size_bytes: 10, width: 1080, height: 1920, sha256: "a".repeat(64), kind: "video_frame", frame_index: i, frame_time_ms: i * 1000 });
    expect((await admin().from("analysis_assets").insert([row(0), row(1)])).error).toBeNull();
    expect((await admin().from("analysis_assets").insert(row(1))).error).not.toBeNull(); // one row per frame index
    expect((await admin().from("analysis_assets").insert({ ...row(2), kind: "creative" })).error).not.toBeNull(); // creative has no frame index
    const frames = await a.client.from("analysis_assets").select("frame_index").eq("analysis_id", id).order("frame_index");
    expect(frames.data?.map((f) => f.frame_index)).toEqual([0, 1]);
    expect((await b.client.from("analysis_assets").select("id").eq("analysis_id", id)).data ?? []).toHaveLength(0);

    // Landing and transcript findings are accepted by complete_analysis.
    const result = await engineResult();
    result.findings.push({ ...result.findings[0], rule_version_id: null, domain: "creative_quality", severity: "info", field: "landing_page", matched_text: null, origin: "heuristic" });
    expect((await admin().rpc("complete_analysis", { p_analysis_id: id, p_result: result })).data).toBe("completed");
    const fields = await a.client.from("findings").select("field").eq("analysis_id", id);
    expect(fields.data?.some((f) => f.field === "landing_page")).toBe(true);
  });

  it("a video analysis records and consumes its own cost of two credits", async () => {
    const c = await newUser();
    const bad = await admin().rpc("start_analysis", {
      p_user_id: c.id, p_client_request_id: randomUUID(), p_brand_id: null, p_sector: "genel", p_headline: "", p_primary_text: "x",
      p_description: "", p_rejection_message: null, p_demo: true, p_hourly_limit: 100, p_credit_cost: 9,
    });
    expect(bad.error?.message).toContain("invalid_cost");
    const run = await startAnalysis(c.id, randomUUID(), 2);
    const meta = { mime: "video/mp4", durationSec: 12, width: 1080, height: 1920, sizeBytes: 1000, frameCount: 1 };
    expect((await admin().from("analyses").update({ media_type: "video", video_meta: meta }).eq("id", run.analysis_id)).error).toBeNull();
    const result = await engineResult();
    result.findings.push({ ...result.findings[0], rule_version_id: null, domain: "creative_quality", severity: "info", origin: "heuristic", field: "speech", matched_text: "7 günde 5 kilo" });
    const done = await admin().rpc("complete_analysis", { p_analysis_id: run.analysis_id, p_result: result });
    expect(done.error?.message ?? null).toBeNull();
    expect(done.data).toBe("completed");
    expect((await admin().rpc("complete_analysis", { p_analysis_id: run.analysis_id, p_result: result })).data).toBe("already_completed");
    expect(await balance(c.client)).toBe(1);
    const row = await c.client.from("credit_ledger").select("delta, note").eq("analysis_id", run.analysis_id).single();
    expect(row.data).toMatchObject({ delta: -2, note: "Video analizi tamamlandı" });
    const fields = await c.client.from("findings").select("field").eq("analysis_id", run.analysis_id);
    expect(fields.data?.some((f) => f.field === "speech")).toBe(true);
    // One credit left: another video cannot start, and the user cannot change the cost.
    const second = await admin().rpc("start_analysis", {
      p_user_id: c.id, p_client_request_id: randomUUID(), p_brand_id: null, p_sector: "genel", p_headline: "", p_primary_text: "x",
      p_description: "", p_rejection_message: null, p_demo: true, p_hourly_limit: 100, p_credit_cost: 2,
    });
    expect(second.error?.message).toContain("insufficient_credits");
    const tamper = await c.client.from("analyses").update({ credit_cost: 1 }).eq("id", run.analysis_id).select();
    expect(tamper.data ?? []).toHaveLength(0);
  });

  it("season reminders: users toggle their own opt-in, only the server writes the log", async () => {
    const own = await a.client.from("profiles").update({ season_reminders: true }).eq("id", a.id).select("season_reminders");
    expect(own.data?.[0]?.season_reminders).toBe(true);
    const other = await a.client.from("profiles").update({ season_reminders: true }).eq("id", b.id).select();
    expect(other.data ?? []).toHaveLength(0);
    expect((await a.client.from("season_reminder_log").insert({ user_id: a.id, event_key: "x-2027" })).error).not.toBeNull();
    expect((await admin().from("season_reminder_log").insert({ user_id: a.id, event_key: "efsane-cuma-2027" })).error).toBeNull();
    expect((await admin().from("season_reminder_log").insert({ user_id: a.id, event_key: "efsane-cuma-2027" })).error).not.toBeNull();
    expect((await a.client.from("season_reminder_log").select("event_key")).data?.map((r) => r.event_key)).toEqual(["efsane-cuma-2027"]);
    expect((await b.client.from("season_reminder_log").select("event_key")).data ?? []).toHaveLength(0);
  });

  it("checkout consents: owner inserts and reads own rows only, unknown types are rejected", async () => {
    const rows = [
      { user_id: a.id, consent_type: "pre_information", document_version: "2026-11-17", granted: true },
      { user_id: a.id, consent_type: "distance_sales", document_version: "2026-11-17", granted: true },
    ];
    expect((await a.client.from("user_consents").insert(rows)).error).toBeNull();
    // Another user can neither write a consent in a's name nor read a's consents.
    expect((await b.client.from("user_consents").insert({ ...rows[0], user_id: a.id })).error).not.toBeNull();
    const { data: seen } = await b.client.from("user_consents").select("id").eq("user_id", a.id);
    expect(seen ?? []).toHaveLength(0);
    // Consents are append-only and the type list is closed.
    expect((await a.client.from("user_consents").insert({ ...rows[0], consent_type: "anything" })).error).not.toBeNull();
    const { data: own } = await a.client.from("user_consents").select("consent_type").in("consent_type", ["pre_information", "distance_sales"]);
    expect(own).toHaveLength(2);
    await a.client.from("user_consents").delete().eq("user_id", a.id);
    const { data: still } = await admin().from("user_consents").select("id").eq("user_id", a.id).in("consent_type", ["pre_information", "distance_sales"]);
    expect(still).toHaveLength(2);
  });

  it("allows one landing screenshot per analysis", async () => {
    const run = await startAnalysis(b.id);
    const shot = { analysis_id: run.analysis_id, user_id: b.id, storage_path: `${b.id}/${run.analysis_id}/${randomUUID()}.png`, mime_type: "image/png", size_bytes: 10, width: 1280, height: 2000, sha256: "b".repeat(64), kind: "landing_screenshot" };
    expect((await admin().from("analysis_assets").insert(shot)).error).toBeNull();
    expect((await admin().from("analysis_assets").insert({ ...shot, storage_path: `${b.id}/${run.analysis_id}/${randomUUID()}.png` })).error).not.toBeNull();
    expect((await admin().from("analysis_assets").insert({ ...shot, storage_path: `${b.id}/${run.analysis_id}/${randomUUID()}.png`, kind: "landing_screenshot", frame_index: 0 })).error).not.toBeNull();
  });
});

describe.skipIf(!reachable)("Supabase: agency mode, feedback, review links, API keys, inspiration board", () => {
  let owner: Awaited<ReturnType<typeof newUser>>;
  let viewer: Awaited<ReturnType<typeof newUser>>;
  let stranger: Awaited<ReturnType<typeof newUser>>;
  let analysisId: string;
  let findingId: string;
  const hex = () => randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

  beforeAll(async () => {
    [owner, viewer, stranger] = await Promise.all([newUser(), newUser(), newUser()]);
    const s = await startAnalysis(owner.id);
    await admin().rpc("complete_analysis", { p_analysis_id: s.analysis_id, p_result: await engineResult() });
    analysisId = s.analysis_id;
    const { data } = await owner.client.from("findings").select("id").eq("analysis_id", analysisId).not("rule_version_id", "is", null).limit(1).single();
    findingId = data!.id;
    // Membership is created by the server when an invite is accepted; clients cannot insert it.
    const self = await viewer.client.from("team_members").insert({ owner_id: owner.id, member_id: viewer.id, member_email: viewer.email });
    expect(self.error).not.toBeNull();
    const { error } = await admin().from("team_members").insert({ owner_id: owner.id, member_id: viewer.id, member_email: viewer.email });
    expect(error).toBeNull();
  });

  it("team viewers read the owner's analyses and findings but cannot change them", async () => {
    const seen = await viewer.client.from("analyses").select("id").eq("id", analysisId);
    expect(seen.data).toHaveLength(1);
    const f = await viewer.client.from("findings").select("id").eq("analysis_id", analysisId);
    expect((f.data ?? []).length).toBeGreaterThan(0);
    const upd = await viewer.client.from("analyses").update({ headline: "x" }).eq("id", analysisId).select();
    expect(upd.data ?? []).toHaveLength(0);
    const none = await stranger.client.from("analyses").select("id").eq("id", analysisId);
    expect(none.data).toHaveLength(0);
  });

  it("feedback: only the finding's owner can leave it, and the rule version is filled in", async () => {
    const mine = await owner.client.from("finding_feedback").insert({ analysis_id: analysisId, finding_id: findingId, verdict: "wrong", reason: "context_ok" }).select("rule_version_id").single();
    expect(mine.error).toBeNull();
    expect(mine.data?.rule_version_id).toBeTruthy();
    const team = await viewer.client.from("finding_feedback").insert({ analysis_id: analysisId, finding_id: findingId, verdict: "helpful" });
    expect(team.error).not.toBeNull();
    // Column grants: finding_id / user_id cannot be rewritten.
    const move = await owner.client.from("finding_feedback").update({ user_id: stranger.id }).eq("finding_id", findingId);
    expect(move.error).not.toBeNull();
    const ok = await owner.client.from("finding_feedback").update({ verdict: "unclear" }).eq("finding_id", findingId).select("verdict");
    expect(ok.data?.[0]?.verdict).toBe("unclear");
  });

  it("review links: owner-only, completed analyses only, and only revoked_at can change", async () => {
    const expires = new Date(Date.now() + 7 * 864e5).toISOString();
    const own = await owner.client.from("review_shares").insert({ analysis_id: analysisId, token_hash: hex(), expires_at: expires }).select("id").single();
    expect(own.error).toBeNull();
    const other = await viewer.client.from("review_shares").insert({ analysis_id: analysisId, token_hash: hex(), expires_at: expires });
    expect(other.error).not.toBeNull();
    const tooLong = await owner.client.from("review_shares").insert({ analysis_id: analysisId, token_hash: hex(), expires_at: new Date(Date.now() + 60 * 864e5).toISOString() });
    expect(tooLong.error).not.toBeNull();
    const bump = await owner.client.from("review_shares").update({ view_count: 99 }).eq("id", own.data!.id);
    expect(bump.error).not.toBeNull();
    const anon = await createClient(URL_, PUB, opts).from("review_shares").select("id");
    expect(anon.data ?? []).toHaveLength(0);
  });

  it("API keys are private to their owner and the hash cannot be rewritten", async () => {
    const k = await owner.client.from("api_keys").insert({ name: "CRM", key_prefix: "ads_live_abcd", key_hash: hex() }).select("id").single();
    expect(k.error).toBeNull();
    const peek = await stranger.client.from("api_keys").select("id").eq("id", k.data!.id);
    expect(peek.data).toHaveLength(0);
    const swap = await owner.client.from("api_keys").update({ key_hash: hex() }).eq("id", k.data!.id);
    expect(swap.error).not.toBeNull();
  });

  it("brand kit: owner writes valid kit values, viewers read, others cannot change them", async () => {
    const kit = { primary_color: "#0b1b3f", secondary_color: "#ff6a4d", font: "inter", tagline: "Her gün", audience_note: "25-40 yaş", required_phrases: ["Kampanya stokla sınırlıdır."], website: "https://ornek.com/" };
    const { data: brand, error } = await owner.client.from("brands").insert({ user_id: owner.id, name: `Kit ${randomUUID().slice(0, 6)}`, ...kit }).select("id").single();
    expect(error).toBeNull();
    const seen = await viewer.client.from("brands").select("primary_color, required_phrases").eq("id", brand!.id).single();
    expect(seen.data).toMatchObject({ primary_color: "#0b1b3f", required_phrases: ["Kampanya stokla sınırlıdır."] });
    const viewerEdit = await viewer.client.from("brands").update({ primary_color: "#000000" }, { count: "exact" }).eq("id", brand!.id);
    expect(viewerEdit.count ?? 0).toBe(0);
    for (const bad of [{ primary_color: "red" }, { font: "comic-sans" }, { website: "http://ornek.com" }, { required_phrases: Array.from({ length: 11 }, (_, i) => `ibare ${i}`) }]) {
      expect((await owner.client.from("brands").update(bad).eq("id", brand!.id)).error).not.toBeNull();
    }
  });

  it("brand logo paths are written by the server only", async () => {
    const bad = await owner.client.from("brands").insert({ user_id: owner.id, name: "Marka", sector: "genel", logo_path: `${stranger.id}/brand-logos/x.png` });
    expect(bad.error).not.toBeNull();
    const good = await owner.client.from("brands").insert({ user_id: owner.id, name: "Marka", sector: "kozmetik", banned_words: ["ucuz"] }).select("id").single();
    expect(good.error).toBeNull();
    const viewerSees = await viewer.client.from("brands").select("id").eq("id", good.data!.id);
    expect(viewerSees.data).toHaveLength(1);
  });

  it("inspiration pins are private and validated", async () => {
    const pin = await owner.client.from("inspiration_pins").insert({ ad_archive_id: "123456789", page_name: "Örnek", body: "Metin", country: "DE" }).select("id").single();
    expect(pin.error).toBeNull();
    const dup = await owner.client.from("inspiration_pins").insert({ ad_archive_id: "123456789", country: "DE" });
    expect(dup.error?.code).toBe("23505");
    const bad = await owner.client.from("inspiration_pins").insert({ ad_archive_id: "abc", country: "DE" });
    expect(bad.error).not.toBeNull();
    const other = await viewer.client.from("inspiration_pins").select("id");
    expect(other.data ?? []).toHaveLength(0);
  });

  it("generations: written only through record_generation, charged once per request, private to the owner", async () => {
    const direct = await owner.client.from("generations").insert({ user_id: owner.id, client_request_id: randomUUID(), kind: "copy", credit_cost: 0, output: {} });
    expect(direct.error).not.toBeNull();
    const before = await balance(owner.client);
    const req = randomUUID();
    const call = () => admin().rpc("record_generation", { p_user_id: owner.id, p_client_request_id: req, p_kind: "copy", p_credit_cost: 1, p_brand_id: null, p_platform: "meta", p_output: { headlines: [] } });
    const first = await call();
    expect(first.error).toBeNull();
    expect((first.data as { status: string }[])[0].status).toBe("created");
    const again = await call();
    expect((again.data as { status: string }[])[0].status).toBe("exists");
    expect(await balance(owner.client)).toBe(before - 1);
    const id = (first.data as { generation_id: string }[])[0].generation_id;
    expect((await owner.client.from("generations").select("id").eq("id", id)).data).toHaveLength(1);
    expect((await stranger.client.from("generations").select("id").eq("id", id)).data ?? []).toHaveLength(0);
    const tamper = await owner.client.from("generations").update({ credit_cost: 0 }).eq("id", id);
    expect(tamper.error).not.toBeNull();
    // Without enough credit nothing is stored and nothing is charged.
    const broke = await admin().rpc("record_generation", { p_user_id: stranger.id, p_client_request_id: randomUUID(), p_kind: "creative", p_credit_cost: 20, p_brand_id: null, p_platform: null, p_output: {} });
    expect((broke.data as { status: string }[])[0].status).toBe("insufficient_credits");
    expect((await stranger.client.from("generations").select("id")).data ?? []).toHaveLength(0);
    // Clients cannot call the RPC themselves.
    const self = await owner.client.rpc("record_generation", { p_user_id: owner.id, p_client_request_id: randomUUID(), p_kind: "copy", p_credit_cost: 0, p_brand_id: null, p_platform: null, p_output: {} });
    expect(self.error).not.toBeNull();
  });

  it("generated files: ZIPs fit the private bucket, only the owner reads them", async () => {
    const path = `${owner.id}/generations/${randomUUID()}-adscope.zip`;
    const zip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);
    const up = await owner.client.storage.from("creatives").upload(path, zip, { contentType: "application/zip" });
    expect(up.error).toBeNull();
    expect((await stranger.client.storage.from("creatives").download(path)).error).not.toBeNull();
    expect((await owner.client.storage.from("creatives").download(path)).error).toBeNull();
    const foreign = await stranger.client.storage.from("creatives").upload(`${owner.id}/generations/${randomUUID()}-x.zip`, zip, { contentType: "application/zip" });
    expect(foreign.error).not.toBeNull();
  });

  it("audiences: owner adds profiles to own brands only, team reads, ages are checked", async () => {
    const { data: brand } = await owner.client.from("brands").insert({ user_id: owner.id, name: `Kitle ${randomUUID().slice(0, 6)}` }).select("id").single();
    const row = { user_id: owner.id, brand_id: brand!.id, name: "Ev kahvecileri", age_min: 25, age_max: 40, need: "Hızlı sabah kahvesi" };
    const ok = await owner.client.from("audiences").insert(row).select("id").single();
    expect(ok.error).toBeNull();
    expect((await viewer.client.from("audiences").select("id").eq("id", ok.data!.id)).data).toHaveLength(1);
    expect((await stranger.client.from("audiences").select("id").eq("id", ok.data!.id)).data ?? []).toHaveLength(0);
    const foreign = await stranger.client.from("audiences").insert({ ...row, user_id: stranger.id });
    expect(foreign.error).not.toBeNull();
    expect((await owner.client.from("audiences").insert({ ...row, age_min: 16 })).error).not.toBeNull();
    expect((await owner.client.from("audiences").insert({ ...row, age_min: 50, age_max: 30 })).error).not.toBeNull();
    const viewerEdit = await viewer.client.from("audiences").update({ name: "Değişti" }, { count: "exact" }).eq("id", ok.data!.id);
    expect(viewerEdit.count ?? 0).toBe(0);
  });

  it("performance imports: owner-only, rows only into own imports, consent is the only editable field", async () => {
    const imp = await owner.client.from("performance_imports").insert({ user_id: owner.id, label: "Kasım" }).select("id,share_consent").single();
    expect(imp.error).toBeNull();
    expect(imp.data!.share_consent).toBe(false);
    const row = { import_id: imp.data!.id, user_id: owner.id, ad_name: "Kış seti", spend: 10, impressions: 1000, clicks: 20 };
    expect((await owner.client.from("performance_rows").insert(row)).error).toBeNull();
    expect((await stranger.client.from("performance_rows").insert({ ...row, user_id: stranger.id })).error).not.toBeNull();
    expect((await owner.client.from("performance_rows").insert({ ...row, spend: -1 })).error).not.toBeNull();
    expect((await stranger.client.from("performance_imports").select("id").eq("id", imp.data!.id)).data ?? []).toHaveLength(0);
    expect((await viewer.client.from("performance_rows").select("id").eq("import_id", imp.data!.id)).data ?? []).toHaveLength(0);
    expect((await owner.client.from("performance_imports").update({ label: "Değişti" }).eq("id", imp.data!.id)).error).not.toBeNull();
    expect((await owner.client.from("performance_imports").update({ share_consent: true }, { count: "exact" }).eq("id", imp.data!.id)).count).toBe(1);
    expect((await owner.client.from("performance_rows").update({ spend: 1 }).eq("import_id", imp.data!.id)).error).not.toBeNull();
  });

  it("admin: client roles cannot read the audit log or call admin functions, and cannot make themselves admin", async () => {
    expect((await owner.client.from("admin_audit_log").select("id").limit(1)).error?.code).toBe("42501");
    expect((await owner.client.from("admin_audit_log").insert({ admin_id: owner.id, action: "credit_adjustment" })).error).not.toBeNull();
    expect((await owner.client.rpc("admin_user_balances", { p_user_ids: [owner.id] })).error).not.toBeNull();
    // user_metadata is user-editable; the app only trusts app_metadata, which the client cannot change.
    await owner.client.auth.updateUser({ data: { role: "admin" } });
    const { data } = await owner.client.auth.getUser();
    expect(data.user?.app_metadata?.role).toBeUndefined();
  });

  it("competitor watches: owner-only, results are written by the server only", async () => {
    const w = await owner.client.from("competitor_watches").insert({ user_id: owner.id, term: `kahve ${randomUUID().slice(0, 6)}`, country: "DE" }).select("id").single();
    expect(w.error).toBeNull();
    expect((await stranger.client.from("competitor_watches").select("id").eq("id", w.data!.id)).data ?? []).toHaveLength(0);
    expect((await stranger.client.from("competitor_watches").insert({ user_id: owner.id, term: "x y", country: "DE" })).error).not.toBeNull();
    expect((await owner.client.from("competitor_watches").update({ last_summary: { newCount: 99 } }).eq("id", w.data!.id)).error).not.toBeNull();
    expect((await owner.client.from("competitor_watches").select("seen_ids").eq("id", w.data!.id)).error).not.toBeNull();
  });
});

describe.skipIf(!reachable)("Supabase: client role privileges", () => {
  it("client roles have no blanket privileges on newer tables", async () => {
    const anon = createClient(URL_, PUB, opts);
    for (const t of ["team_members", "team_invites", "finding_feedback", "review_shares", "newsletter_log", "api_keys", "inspiration_pins", "season_reminder_log", "generations", "audiences", "performance_imports", "performance_rows", "competitor_watches", "admin_audit_log", "coupons", "coupon_redemptions", "invite_codes", "referrals", "referral_email_claims", "affiliate_commissions", "welcome_email_log", "rate_limit_buckets", "jobs", "api_webhooks", "api_usage"]) {
      const r = await anon.from(t).select("*").limit(1);
      expect(r.error?.code, t).toBe("42501");
    }
  });
});

describe.skipIf(!reachable)("Supabase: invites, coupons, commissions", () => {
  it("owners read their own growth rows only; clients cannot write them or call reserve_coupon", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const code = `IT-${randomUUID().slice(0, 8).toUpperCase()}`;
    expect((await admin().from("invite_codes").insert({ user_id: owner.id, kind: "invite", code })).error).toBeNull();
    expect((await owner.client.from("invite_codes").select("code")).data?.map((r) => r.code)).toEqual([code]);
    expect((await stranger.client.from("invite_codes").select("code").eq("user_id", owner.id)).data ?? []).toHaveLength(0);
    expect((await stranger.client.from("invite_codes").insert({ user_id: stranger.id, kind: "partner", code: "IT-KENDIM1", commission_bp: 5000 })).error).not.toBeNull();
    expect((await stranger.client.from("referrals").insert({ invitee_id: stranger.id, inviter_id: owner.id, kind: "invite" })).error).not.toBeNull();
    expect((await stranger.client.from("coupons").select("id").limit(1)).error?.code).toBe("42501");
    expect((await stranger.client.from("referral_email_claims").select("email_hash").limit(1)).error?.code).toBe("42501");
    expect((await stranger.client.rpc("reserve_coupon", { p_code: "X", p_user_id: stranger.id, p_package_id: "baslangic" })).error).not.toBeNull();
    expect((await stranger.client.from("credit_ledger").insert({ user_id: stranger.id, delta: 5, reason: "referral_bonus", idempotency_key: `x:${randomUUID()}` })).error).not.toBeNull();
    // Commission rows: the partner reads them, but not the invitee id column.
    await admin().from("affiliate_commissions").insert({ partner_id: owner.id, invitee_id: stranger.id, purchase_ref: `it:${randomUUID()}`, amount_minor: 1000, commission_bp: 2000, commission_minor: 200 });
    expect((await owner.client.from("affiliate_commissions").select("commission_minor")).data?.[0]?.commission_minor).toBe(200);
    expect((await owner.client.from("affiliate_commissions").select("invitee_id")).error).not.toBeNull();
    expect((await stranger.client.from("affiliate_commissions").select("id")).data ?? []).toHaveLength(0);
  });

  it("welcome e-mail log: owner reads own rows, only the server writes; the opt-out column is the user's", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    expect((await admin().from("welcome_email_log").insert({ user_id: owner.id, step: 0 })).error).toBeNull();
    expect((await admin().from("welcome_email_log").insert({ user_id: owner.id, step: 0 })).error?.code).toBe("23505");
    expect((await admin().from("welcome_email_log").insert({ user_id: owner.id, step: 2 })).error).not.toBeNull();
    expect((await owner.client.from("welcome_email_log").select("step")).data).toEqual([{ step: 0 }]);
    expect((await stranger.client.from("welcome_email_log").select("step").eq("user_id", owner.id)).data ?? []).toHaveLength(0);
    expect((await owner.client.from("welcome_email_log").insert({ user_id: owner.id, step: 1 })).error).not.toBeNull();
    expect((await owner.client.from("profiles").update({ welcome_emails: false }, { count: "exact" }).eq("id", owner.id)).count).toBe(1);
    expect((await stranger.client.from("profiles").update({ welcome_emails: false }, { count: "exact" }).eq("id", owner.id)).count ?? 0).toBe(0);
  });

  it("concurrency: reserve_coupon holds the total limit under parallel calls", async () => {
    const creator = await newUser();
    const code = `IT${randomUUID().slice(0, 8).toUpperCase()}`;
    expect((await admin().from("coupons").insert({ code, kind: "bonus_credits", value: 2, max_redemptions: 3, created_by: creator.id })).error).toBeNull();
    const users = await Promise.all(Array.from({ length: 8 }, () => newUser()));
    const res = await Promise.all(users.map((u) => admin().rpc("reserve_coupon", { p_code: code, p_user_id: u.id, p_package_id: "baslangic" })));
    const statuses = res.map((r) => (r.data as { status: string }[])[0]?.status);
    expect(statuses.filter((s) => s === "ok")).toHaveLength(3);
    expect(statuses.filter((s) => s === "exhausted")).toHaveLength(5);
  });

  it("concurrency: only one purchase claims the first-purchase referral reward", async () => {
    const inviter = await newUser();
    const invitee = await newUser();
    await admin().from("referrals").insert({ invitee_id: invitee.id, inviter_id: inviter.id, kind: "invite" });
    const claims = await Promise.all(["a", "b", "c", "d"].map((o) =>
      admin().from("referrals").update({ rewarded_at: new Date().toISOString(), reward_ref: `it:${o}` }).eq("invitee_id", invitee.id).is("rewarded_at", null).select("invitee_id"),
    ));
    expect(claims.filter((c) => (c.data ?? []).length === 1)).toHaveLength(1);
    expect((await invitee.client.from("referrals").select("inviter_id")).data?.[0]?.inviter_id).toBe(inviter.id);
    // The same e-mail can be claimed once.
    const hash = "a".repeat(63) + "b";
    await admin().from("referral_email_claims").delete().eq("email_hash", hash);
    expect((await admin().from("referral_email_claims").insert({ email_hash: hash })).error).toBeNull();
    expect((await admin().from("referral_email_claims").insert({ email_hash: hash })).error?.code).toBe("23505");
  });
});

describe.skipIf(!reachable)("Supabase: limiter, job queue, webhooks, API usage", () => {
  it("rate_limit_hit counts across callers and blocks after the limit; clients cannot call it", async () => {
    const key = `it:${randomUUID()}`;
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push((await admin().rpc("rate_limit_hit", { p_key: key, p_limit: 3, p_window_seconds: 60 })).data?.[0]);
    expect(hits.map((h) => h?.allowed)).toEqual([true, true, true, false]);
    expect(hits[3]?.retry_after).toBeGreaterThan(0);
    const u = await newUser();
    expect((await u.client.rpc("rate_limit_hit", { p_key: key, p_limit: 3, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await u.client.from("rate_limit_buckets").select("key").limit(1)).error?.code).toBe("42501");
  });

  it("claim_jobs never hands the same job to two workers; owners see progress, not the payload", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const dedupe = `it:${randomUUID()}`;
    const ins = await admin().from("jobs").insert({ user_id: owner.id, kind: "webhook_delivery", payload: { secret: "never-visible" }, dedupe_key: dedupe }).select("id").single();
    expect(ins.error).toBeNull();
    expect((await admin().from("jobs").insert({ user_id: owner.id, kind: "webhook_delivery", payload: {}, dedupe_key: dedupe })).error?.code).toBe("23505");
    const claims = await Promise.all([0, 1, 2, 3].map(() => admin().rpc("claim_jobs", { p_limit: 50, p_lock_seconds: 60 })));
    const mine = claims.flatMap((c) => (c.data ?? []) as { id: string }[]).filter((j) => j.id === ins.data!.id);
    expect(mine).toHaveLength(1);
    expect((await owner.client.from("jobs").select("status,attempts").eq("id", ins.data!.id)).data).toEqual([{ status: "running", attempts: 1 }]);
    expect((await owner.client.from("jobs").select("payload")).error).not.toBeNull();
    expect((await stranger.client.from("jobs").select("id").eq("id", ins.data!.id)).data ?? []).toHaveLength(0);
    expect((await owner.client.from("jobs").insert({ user_id: owner.id, kind: "webhook_delivery" })).error).not.toBeNull();
    expect((await owner.client.rpc("claim_jobs", { p_limit: 1, p_lock_seconds: 60 })).error).not.toBeNull();
    await admin().from("jobs").delete().eq("id", ins.data!.id);
  });

  it("webhooks: https only, the secret is never readable by the client, owners read their own rows", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    expect((await admin().from("api_webhooks").insert({ user_id: owner.id, url: "http://ornek.com/h", secret: "s".repeat(40) })).error).not.toBeNull();
    expect((await admin().from("api_webhooks").insert({ user_id: owner.id, url: "https://ornek.com/h", secret: "s".repeat(40) })).error).toBeNull();
    expect((await owner.client.from("api_webhooks").select("url")).data).toEqual([{ url: "https://ornek.com/h" }]);
    expect((await owner.client.from("api_webhooks").select("secret")).error).not.toBeNull();
    expect((await stranger.client.from("api_webhooks").select("url").eq("user_id", owner.id)).data ?? []).toHaveLength(0);
    expect((await owner.client.from("api_webhooks").insert({ user_id: owner.id, url: "https://x.com/", secret: "s".repeat(40) })).error).not.toBeNull();
  });

  it("api_usage: api_usage_hit counts per key and day; owners read their own counts only", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const key = await admin().from("api_keys").insert({ user_id: owner.id, name: "it", key_prefix: "ads_live_itxx", key_hash: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "") }).select("id").single();
    expect(key.error).toBeNull();
    for (let i = 0; i < 3; i++) expect((await admin().rpc("api_usage_hit", { p_key_id: key.data!.id, p_user_id: owner.id })).error).toBeNull();
    expect((await owner.client.from("api_usage").select("count")).data).toEqual([{ count: 3 }]);
    expect((await stranger.client.from("api_usage").select("count").eq("user_id", owner.id)).data ?? []).toHaveLength(0);
    expect((await owner.client.rpc("api_usage_hit", { p_key_id: key.data!.id, p_user_id: owner.id })).error).not.toBeNull();
  });
});
