import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/env";

/** Per-request client acting as the signed-in user (publishable key + session cookies). RLS applies. */
export async function createUserClient() {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Privileged client using the secret key. Bypasses RLS: only for server-side trusted operations. */
export function createAdminClient() {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  return createClient(cfg.url, cfg.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
