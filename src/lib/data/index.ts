import "server-only";
import { cache } from "react";
import { dataBackend } from "@/lib/env";
import { MemoryAdminRepo, MemoryRepo } from "./memory-repo";
import { SupabaseAdminRepo, SupabaseRepo } from "./supabase-repo";
import type { AdminRepo, DataRepo } from "./types";
import { resolveWorkspace, workspaceRepo } from "./workspace";

export function getAdminRepo(): AdminRepo {
  return dataBackend() === "supabase" ? new SupabaseAdminRepo() : new MemoryAdminRepo();
}

/** The signed-in user's own repo (never switched to a team workspace): credits page, account settings. */
export const getSessionRepo = cache((): DataRepo => (dataBackend() === "supabase" ? new SupabaseRepo() : new MemoryRepo()));

/** Own account, or a team owner's workspace when the user works there as editor (P12.1). One per request. */
export const getWorkspace = cache(() => resolveWorkspace(getSessionRepo(), getAdminRepo));

/**
 * One repo per request (React cache), acting as the signed-in user. In an editor workspace, starting
 * analyses, generating and reading the results act on the team owner's data and balance.
 */
export const getRepo = cache((): DataRepo => workspaceRepo(getSessionRepo(), getWorkspace));

export const getCurrentUser = cache(async () => getSessionRepo().getUser());
