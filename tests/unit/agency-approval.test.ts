import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// One cookie jar per "browser" (owner a, member b, outsider c).
const jars: Record<string, Map<string, string>> = { a: new Map(), b: new Map(), c: new Map() };
let current: "a" | "b" | "c" = "a";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars[current].has(k) ? { name: k, value: jars[current].get(k)! } : undefined),
    set: (k: string, v: string) => void jars[current].set(k, v),
    delete: (k: string) => void jars[current].delete(k),
  }),
}));

const { MemoryRepo, MemoryAdminRepo, __resetMemoryStoreForTests, catalogRules } = await import("@/lib/data/memory-repo");
const { resolveWorkspace, workspaceRepo, WORKSPACE_COOKIE } = await import("@/lib/data/workspace");
const { runPipeline } = await import("@/lib/engine/pipeline");
const { approvalBadge, approvalCounts, approvalItems, badgesByAnalysis, cleanReviewerName } = await import("@/lib/approval");
const { parseApprovalForm, submitApprovalForm } = await import("@/lib/approval/service");
const { hashToken, newToken } = await import("@/lib/security/tokens");
const { MemoryOutbox } = await import("@/lib/email/provider");

const consents = { terms: "v1", kvkk: "v1", privacy: "v1", marketing: false };
const as = (who: "a" | "b" | "c") => {
  current = who;
  return new MemoryRepo();
};
const admin = () => new MemoryAdminRepo();
const params = (id = randomUUID()) => ({
  clientRequestId: id,
  brandId: null,
  sector: "genel" as const,
  headline: "Kış indirimi",
  primaryText: "Tüm ürünlerde yüzde 20 indirim, stoklarla sınırlı.",
  description: "",
  rejectionMessage: null,
  demo: true,
  hourlyLimit: 100,
  mediaType: "image" as const,
  videoMeta: null,
  transcript: null,
  landingUrl: null,
  creditCost: 1,
});
const result = async () =>
  (
    await runPipeline({
      input: { sector: "genel", headline: "Kış indirimi", primaryText: "Tüm ürünlerde yüzde 20 indirim, stoklarla sınırlı.", description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
      rules: catalogRules(),
      ai: null,
    })
  ).result;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function completedAnalysis(repo: InstanceType<typeof MemoryRepo>) {
  const s = await repo.startAnalysis(params());
  if (!s.ok) throw new Error("start failed");
  await repo.uploadAsset(s.analysisId, png, { mime: "image/png", width: 10, height: 10, sizeBytes: png.length }, "png", "x");
  expect(await repo.completeAnalysis(s.analysisId, await result())).toBe("completed");
  return (await repo.getAnalysis(s.analysisId))!;
}

/** b joins a's team with the given role. */
async function join(role: "viewer" | "editor") {
  const { token } = newToken();
  expect(await as("a").createTeamInvite("b@example.com", hashToken(token), new Date(Date.now() + 86400_000).toISOString(), role)).toBe("ok");
  expect(await as("b").acceptTeamInvite(hashToken(token))).toBe("ok");
}

/** The app's repo for the current browser (workspace aware), like getRepo() in a request. */
function appRepo(who: "a" | "b" | "c") {
  current = who;
  const session = new MemoryRepo();
  let ws: ReturnType<typeof resolveWorkspace> | null = null;
  return { repo: workspaceRepo(session, () => (ws ??= resolveWorkspace(session, admin))), workspace: () => (ws ??= resolveWorkspace(session, admin)) };
}

beforeEach(async () => {
  __resetMemoryStoreForTests();
  for (const j of Object.values(jars)) j.clear();
  await as("a").signUp({ email: "a@example.com", password: "Test-sifre-123", consents });
  await as("b").signUp({ email: "b@example.com", password: "Test-sifre-123", consents });
  await as("c").signUp({ email: "c@example.com", password: "Test-sifre-123", consents });
});

describe("client approval items and badges", () => {
  it("lists the original text, the safe text, each variant and the image", async () => {
    const a = await completedAnalysis(as("a"));
    const keys = approvalItems(a).map((i) => i.key);
    expect(keys[0]).toBe("text:original");
    expect(keys).toContain("image");
    expect(keys.filter((k) => k.startsWith("text:v")).length).toBe(a.variants.filter((v) => v.kind === "variant").length);
    const video = approvalItems({ ...a, mediaType: "video", asset: null, frames: [{ index: 0, timeMs: 0, width: 1, height: 1 }] });
    expect(video.map((i) => i.key)).toContain("video");
    expect(video.map((i) => i.key)).not.toContain("image");
  });

  it("rejection wins, then change requests; approved only when every item is approved", () => {
    const at = (s: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, s)).toISOString();
    const keys = ["text:original", "image"];
    expect(approvalBadge(keys, [])).toBe("pending");
    expect(approvalBadge(keys, [{ itemKey: "text:original", decision: "approved", updatedAt: at(1) }])).toBe("pending");
    expect(approvalBadge(keys, [{ itemKey: "text:original", decision: "approved", updatedAt: at(1) }, { itemKey: "image", decision: "approved", updatedAt: at(2) }])).toBe("approved");
    expect(approvalBadge(keys, [{ itemKey: "text:original", decision: "changes_requested", updatedAt: at(1) }, { itemKey: "image", decision: "approved", updatedAt: at(2) }])).toBe("changes_requested");
    expect(approvalBadge(keys, [{ itemKey: "text:original", decision: "changes_requested", updatedAt: at(1) }, { itemKey: "image", decision: "rejected", updatedAt: at(2) }])).toBe("rejected");
    // A later decision on the same item replaces the earlier one (e.g. a second link).
    expect(approvalBadge(keys, [{ itemKey: "image", decision: "rejected", updatedAt: at(1) }, { itemKey: "image", decision: "approved", updatedAt: at(3) }, { itemKey: "text:original", decision: "approved", updatedAt: at(2) }])).toBe("approved");
    expect(approvalCounts(keys, [{ itemKey: "image", decision: "rejected", updatedAt: at(1) }])).toEqual({ approved: 0, changes_requested: 0, rejected: 1, pending: 1 });
    expect(cleanReviewerName("  Ayşe\u0000  Yılmaz ")).toBe("Ayşe Yılmaz");
    expect(cleanReviewerName("   ")).toBeNull();
  });

  it("requires a name and a comment for change requests and rejections", () => {
    const f = new FormData();
    f.set("d:text:original", "approved");
    expect(parseApprovalForm(f).ok).toBe(false);
    f.set("reviewerName", "Ayşe");
    expect(parseApprovalForm(f)).toEqual({ ok: true, value: { reviewerName: "Ayşe", items: [{ itemKey: "text:original", decision: "approved", comment: null }] } });
    f.set("d:image", "rejected");
    expect(parseApprovalForm(f).ok).toBe(false);
    f.set("c:image", "Ürün rengi yanlış.");
    expect(parseApprovalForm(f).ok).toBe(true);
    f.set("d:../etc", "approved");
    expect(parseApprovalForm(f).ok).toBe(false);
  });
});

describe("client approval link (demo backend)", () => {
  it("only the owner of a completed analysis creates, lists and revokes links", async () => {
    const a = await completedAnalysis(as("a"));
    const keys = approvalItems(a).map((i) => i.key);
    const { hash } = newToken();
    const exp = new Date(Date.now() + 86400_000).toISOString();
    expect(await as("c").createApprovalLink(a.id, hash, exp, null, keys)).toBe(false);
    expect(await as("a").createApprovalLink(a.id, hash, exp, null, ["text:original", "../x"])).toBe(false);
    expect(await as("a").createApprovalLink(a.id, hash, exp, "Not", keys)).toBe(true);
    expect(await as("c").listApprovalLinks(a.id)).toEqual([]);
    const [link] = await as("a").listApprovalLinks(a.id);
    expect(link.itemKeys).toEqual(keys);
    expect(await as("c").revokeApprovalLink(link.id)).toBe(false);
    expect(await as("a").revokeApprovalLink(link.id)).toBe(true);
    expect(await admin().getApprovalLink(hash)).toBeNull();
  });

  it("stores the customer's decisions per item, replaces them on resubmit and notifies the owner", async () => {
    const a = await completedAnalysis(as("a"));
    const keys = approvalItems(a).map((i) => i.key);
    const { token, hash } = newToken();
    await as("a").createApprovalLink(a.id, hash, new Date(Date.now() + 86400_000).toISOString(), null, keys);

    const shared = await admin().getApprovalLink(hash);
    expect(shared?.analysis.id).toBe(a.id);
    expect((await admin().getApprovalAssetBytes(hash))?.mime).toBe("image/png");

    expect((await admin().submitApproval(hash, { reviewerName: "Ayşe", items: [{ itemKey: "video", decision: "approved", comment: null }] })).ok).toBe(false);

    const before = MemoryOutbox.messages().length;
    const f = new FormData();
    f.set("reviewerName", "Ayşe");
    f.set("d:text:original", "changes_requested");
    f.set("c:text:original", "İndirim oranını yüzde 15 yapalım.");
    f.set("d:image", "approved");
    expect((await submitApprovalForm(token, f)).ok).toBe(true);
    const mail = MemoryOutbox.messages().slice(before);
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toBe("a@example.com");
    // Customer name and comments stay in AdScope.
    expect(mail[0].text).not.toContain("Ayşe");
    expect(mail[0].text).not.toContain("yüzde 15");
    expect(mail[0].text).toContain("hukuki görüş değildir");

    let [link] = await as("a").listApprovalLinks(a.id);
    expect(link.decisions).toHaveLength(2);
    expect(badgesByAnalysis(await as("a").listApprovalOverview())[a.id]).toBe("changes_requested");

    const g = new FormData();
    g.set("reviewerName", "Ayşe");
    for (const k of keys) g.set(`d:${k}`, "approved");
    expect((await submitApprovalForm(token, g)).ok).toBe(true);
    [link] = await as("a").listApprovalLinks(a.id);
    expect(link.decisions).toHaveLength(keys.length);
    expect(badgesByAnalysis(await as("a").listApprovalOverview())[a.id]).toBe("approved");
    expect(await as("c").listApprovalOverview()).toEqual([]);
  });

  it("rejects expired links and deletes decisions with the analysis", async () => {
    const a = await completedAnalysis(as("a"));
    const { token, hash } = newToken();
    await as("a").createApprovalLink(a.id, hash, new Date(Date.now() - 1000).toISOString(), null, ["text:original"]);
    const f = new FormData();
    f.set("reviewerName", "Ayşe");
    f.set("d:text:original", "approved");
    expect((await submitApprovalForm(token, f)).ok).toBe(false);
    expect(await admin().getApprovalLink(hash)).toBeNull();

    const fresh = newToken();
    await as("a").createApprovalLink(a.id, fresh.hash, new Date(Date.now() + 60_000).toISOString(), null, ["text:original"]);
    expect((await submitApprovalForm(fresh.token, f)).ok).toBe(true);
    expect(await as("a").deleteAnalysis(a.id)).toBe(true);
    expect(await as("a").listApprovalOverview()).toEqual([]);
    expect(await admin().getApprovalLink(fresh.hash)).toBeNull();
  });
});

describe("team editor role", () => {
  it("only the owner changes a member's role", async () => {
    await join("viewer");
    const b = (await as("b").getUser())!;
    expect((await as("b").getTeam()).memberships[0].role).toBe("viewer");
    const ownerId = (await as("a").getUser())!.id;
    expect(await as("b").setTeamMemberRole(ownerId, "editor")).toBe(false);
    expect(await as("c").setTeamMemberRole(b.id, "editor")).toBe(false);
    expect(await as("a").setTeamMemberRole(b.id, "editor")).toBe(true);
    expect((await as("a").getTeam()).members[0].role).toBe("editor");
    expect((await admin().getTeamMembership(ownerId, b.id))?.role).toBe("editor");
  });

  it("an editor starts analyses in the owner's workspace and the owner's balance pays, once, on success", async () => {
    await join("editor");
    const ownerId = (await as("a").getUser())!.id;
    const editorId = (await as("b").getUser())!.id;
    jars.b.set(WORKSPACE_COOKIE, ownerId);

    const { repo, workspace } = appRepo("b");
    const ws = await workspace();
    expect(ws.mode).toBe("editor");
    expect((await repo.getUser())!.id).toBe(editorId);
    expect(await repo.getBalance()).toBe(3);

    const id = randomUUID();
    const s = await repo.startAnalysis(params(id));
    if (!s.ok) throw new Error("start failed");
    expect((await repo.startAnalysis(params(id))).ok).toBe(true); // double click: same analysis
    await repo.uploadAsset(s.analysisId, png, { mime: "image/png", width: 10, height: 10, sizeBytes: png.length }, "png", "x");
    const [x, y] = await Promise.all([repo.completeAnalysis(s.analysisId, await result()), repo.completeAnalysis(s.analysisId, await result())]);
    expect([x, y].sort()).toEqual(["already_completed", "completed"]);

    expect(await as("a").getBalance()).toBe(2);
    expect(await as("b").getBalance()).toBe(3);
    // The analysis belongs to the owner; for the editor it is not "own" (no delete, no links).
    expect((await as("a").getAnalysis(s.analysisId))?.ownedByMe).toBe(true);
    const seen = await appRepo("b").repo.getAnalysis(s.analysisId);
    expect(seen?.ownedByMe).toBe(false);
    expect(await appRepo("b").repo.deleteAnalysis(s.analysisId)).toBe(false);
    expect(await appRepo("b").repo.listTeamAnalyses()).toEqual([]);
    expect((await appRepo("b").repo.listAnalyses()).map((r) => r.id)).toContain(s.analysisId);
  });

  it("an editor's generation charges the owner and failures charge nothing", async () => {
    await join("editor");
    const ownerId = (await as("a").getUser())!.id;
    jars.b.set(WORKSPACE_COOKIE, ownerId);
    const { repo } = appRepo("b");
    const req = randomUUID();
    const g = await repo.recordGeneration({ clientRequestId: req, kind: "copy", creditCost: 2, brandId: null, platform: null, output: {} });
    expect(g.status).toBe("created");
    expect((await repo.recordGeneration({ clientRequestId: req, kind: "copy", creditCost: 2, brandId: null, platform: null, output: {} })).status).toBe("exists");
    expect(await as("a").getBalance()).toBe(1);
    expect((await appRepo("b").repo.recordGeneration({ clientRequestId: randomUUID(), kind: "copy", creditCost: 2, brandId: null, platform: null, output: {} })).status).toBe("insufficient_credits");
    expect(await as("a").getBalance()).toBe(1);
    expect(await as("b").getBalance()).toBe(3);
  });

  it("viewers, outsiders and removed editors stay in their own account", async () => {
    await join("viewer");
    const ownerId = (await as("a").getUser())!.id;
    const editorId = (await as("b").getUser())!.id;
    jars.b.set(WORKSPACE_COOKIE, ownerId);
    expect((await appRepo("b").workspace()).mode).toBe("own");
    jars.c.set(WORKSPACE_COOKIE, ownerId);
    expect((await appRepo("c").workspace()).mode).toBe("own");
    const s = await appRepo("c").repo.startAnalysis(params());
    expect(s.ok).toBe(true);
    expect(await as("a").getBalance()).toBe(3);
    expect((await as("a").listAnalyses()).length).toBe(0);

    await as("a").setTeamMemberRole(editorId, "editor");
    expect((await appRepo("b").workspace()).mode).toBe("editor");
    await as("a").removeTeamMember(editorId);
    expect((await appRepo("b").workspace()).mode).toBe("own");
  });

  it("an editor cannot change the owner's brands, team, links or account", async () => {
    await join("editor");
    const ownerId = (await as("a").getUser())!.id;
    const brand = await as("a").createBrand({ name: "Kahve", sector: "genel", tone: "samimi" });
    jars.b.set(WORKSPACE_COOKIE, ownerId);
    const { repo } = appRepo("b");
    expect((await repo.listBrands()).map((x) => x.id)).toEqual([brand!.id]);
    expect(await repo.deleteBrand(brand!.id)).toBe(false);
    expect(await repo.updateBrand(brand!.id, { name: "Değişti" })).toBe(false);
    expect((await as("a").listBrands())[0].name).toBe("Kahve");
    const a = await completedAnalysis(as("a"));
    expect(await appRepo("b").repo.createApprovalLink(a.id, newToken().hash, new Date(Date.now() + 60_000).toISOString(), null, ["text:original"])).toBe(false);
    expect(await appRepo("b").repo.createReviewShare(a.id, newToken().hash, new Date(Date.now() + 60_000).toISOString(), null)).toBe(false);
    expect((await appRepo("b").repo.getTeam()).members).toEqual([]);
  });
});
