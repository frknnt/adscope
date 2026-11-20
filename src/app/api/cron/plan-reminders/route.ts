import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { getEmailProvider } from "@/lib/email/provider";
import { siteUrl } from "@/lib/env";
import { sendPlanReminders } from "@/lib/payments/plan-reminder";

export const maxDuration = 120;

/**
 * Agency package renewal reminders (P12.3). Call daily with `Authorization: Bearer $CRON_SECRET`.
 * One e-mail per paid month, three days before it ends, only when the next month is not bought yet.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });

  const email = getEmailProvider();
  if (!email) return NextResponse.json({ ok: true, sent: 0, skipped: "email_not_configured" });
  const res = await sendPlanReminders(getAdminRepo(), email, siteUrl());
  // Counts only; never addresses or content.
  if (res.failed) console.error("[plan-reminders] send_failed", { failed: res.failed });
  return NextResponse.json({ ok: true, ...res });
}

export const GET = handle;
export const POST = handle;
