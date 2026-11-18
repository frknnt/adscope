import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdLibrary } from "@/lib/ads-library/meta";
import { runCompetitorCheck } from "@/lib/competitors/service";
import { getAdminRepo } from "@/lib/data";
import { getEmailProvider } from "@/lib/email/provider";
import { siteUrl } from "@/lib/env";

export const maxDuration = 300;

/**
 * Weekly competitor watch: checks every saved Ad Library search (cached, at most 200 real API calls
 * per run) and e-mails one digest per user per ISO week. Call with `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });
  const library = getAdLibrary();
  if (!library.enabled) return NextResponse.json({ ok: true, checked: 0, skipped: "ad_library_not_configured" });
  const res = await runCompetitorCheck(getAdminRepo(), library, getEmailProvider(), siteUrl());
  if (res.failed) console.error("[competitors] check_failed", { failed: res.failed });
  return NextResponse.json({ ok: true, ...res });
}

export const GET = handle;
export const POST = handle;
