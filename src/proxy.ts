import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every matched request (Supabase SSR guidance for
 * Next.js 16 `proxy.ts`). In the in-memory demo backend there is nothing to refresh.
 * Also sets baseline security headers.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key && process.env.SUPABASE_SECRET_KEY) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });
    // Do not put code between client creation and getClaims().
    await supabase.auth.getClaims();
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  // Pages whose URL carries a secret token (review link, client approval, team invite) never leak it via Referer.
  const tokenPage = request.nextUrl.pathname.startsWith("/inceleme/") || request.nextUrl.pathname.startsWith("/onay/") || request.nextUrl.pathname.startsWith("/panel/ekip/katil");
  response.headers.set("Referrer-Policy", tokenPage ? "no-referrer" : "strict-origin-when-cross-origin");
  if (tokenPage) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
