import "server-only";
import { cache } from "react";
import { dataBackend } from "@/lib/env";
import { MemoryAdminRepo, MemoryRepo } from "./memory-repo";
import { SupabaseAdminRepo, SupabaseRepo } from "./supabase-repo";
import type { AdminRepo, DataRepo } from "./types";

/** One repo per request (React cache), acting as the signed-in user. */
export const getRepo = cache((): DataRepo => (dataBackend() === "supabase" ? new SupabaseRepo() : new MemoryRepo()));

export function getAdminRepo(): AdminRepo {
  return dataBackend() === "supabase" ? new SupabaseAdminRepo() : new MemoryAdminRepo();
}

export const getCurrentUser = cache(async () => getRepo().getUser());
