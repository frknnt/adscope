import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/** Email confirmation link target (token_hash flow). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fail = NextResponse.redirect(new URL("/giris?durum=dogrulama-hatasi", url.origin));
  if (!supabaseConfig() || !tokenHash || !type || !TYPES.includes(type)) return fail;

  const supabase = await createUserClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return fail;
  return NextResponse.redirect(new URL("/panel/baslangic", url.origin));
}
