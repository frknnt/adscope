import "server-only";
import { cookies } from "next/headers";
import type { AdminRepo, AnalysisDetail, AnalysisSummary, DataRepo, SessionUser } from "./types";

/** Cookie that holds the team owner whose workspace an editor works in. Verified on every request. */
export const WORKSPACE_COOKIE = "adscope_alan";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Workspace =
  | { mode: "own"; user: SessionUser | null }
  | { mode: "editor"; user: SessionUser; ownerId: string; ownerLabel: string; repo: DataRepo };

/**
 * Methods an editor runs in the owner's workspace (as the owner, through the service role, filtered by
 * the owner's id). Everything else (profile, team, API keys, purchases, links, deletion, account) keeps
 * acting on the editor's own account, so an editor can never change the owner's settings or data.
 */
export const EDITOR_METHODS = new Set<keyof DataRepo>([
  "listBrands",
  "getBrandLogo",
  "getReportBranding",
  "getBalance",
  "listAudiences",
  "listBrandTemplates",
  "getBrandTemplate",
  "recordGeneration",
  "getGenerationByRequest",
  "getGeneration",
  "listGenerations",
  "saveGenerationFile",
  "readGenerationFile",
  "removeGenerationFiles",
  "startAnalysis",
  "uploadAsset",
  "completeAnalysis",
  "failAnalysis",
  "recordAiRun",
  "listAnalyses",
  "getAnalysis",
  "getAssetBytes",
  "setSpeechTranscript",
  "saveAppeal",
]);

/** Resolves the workspace of the signed-in user: own account, or a team owner's workspace as editor. */
export async function resolveWorkspace(session: DataRepo, admin: () => AdminRepo): Promise<Workspace> {
  const user = await session.getUser();
  if (!user) return { mode: "own", user: null };
  let ownerId: string | undefined;
  try {
    ownerId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  } catch {
    return { mode: "own", user }; // outside a request (tests, scripts)
  }
  if (!ownerId || !UUID_RE.test(ownerId) || ownerId === user.id) return { mode: "own", user };
  const a = admin();
  const membership = await a.getTeamMembership(ownerId, user.id);
  if (!membership || membership.role !== "editor") return { mode: "own", user };
  return { mode: "editor", user, ownerId, ownerLabel: membership.ownerLabel, repo: a.repoForUser({ id: ownerId, email: "" }, { actorId: user.id }) };
}

const notMine = <T extends AnalysisSummary>(a: T): T => ({ ...a, ownedByMe: false });

/**
 * The repo the app uses: a thin proxy over the session repo. In an editor workspace the methods in
 * EDITOR_METHODS go to the owner-acting repo; owner-only actions on reports stay hidden because the
 * analyses come back with ownedByMe=false. Team lists are empty there (the workspace already shows them).
 */
export function workspaceRepo(session: DataRepo, workspace: () => Promise<Workspace>): DataRepo {
  return new Proxy(session, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      const own = (value as (...a: unknown[]) => unknown).bind(target);
      if (prop === "listTeamAnalyses") {
        return async (...args: unknown[]) => ((await workspace()).mode === "editor" ? [] : own(...args));
      }
      if (!EDITOR_METHODS.has(prop as keyof DataRepo)) return own;
      return async (...args: unknown[]) => {
        const ws = await workspace();
        if (ws.mode !== "editor") return own(...args);
        const fn = Reflect.get(ws.repo, prop) as (...a: unknown[]) => Promise<unknown>;
        const out = await fn.apply(ws.repo, args);
        if (prop === "listAnalyses") return (out as AnalysisSummary[]).map(notMine);
        if (prop === "getAnalysis") return out ? notMine(out as AnalysisDetail) : out;
        return out;
      };
    },
  });
}
