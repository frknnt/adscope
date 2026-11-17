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
});

describe.skipIf(!reachable)("Supabase: client role privileges", () => {
  it("client roles have no blanket privileges on newer tables", async () => {
    const anon = createClient(URL_, PUB, opts);
    for (const t of ["team_members", "team_invites", "finding_feedback", "review_shares", "newsletter_log", "api_keys", "inspiration_pins", "season_reminder_log"]) {
      const r = await anon.from(t).select("*").limit(1);
      expect(r.error?.code, t).toBe("42501");
    }
  });
});
