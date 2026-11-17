import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { istanbulToday } from "@/lib/calendar/season";
import { buildReminderEmail, remindersDue } from "@/lib/calendar/reminder-email";
import { getAdminRepo } from "@/lib/data";
import { getEmailProvider } from "@/lib/email/provider";
import { siteUrl } from "@/lib/env";

export const maxDuration = 120;

/**
 * Sends season reminder e-mails to users who opted in. Call daily with `Authorization: Bearer $CRON_SECRET`.
 * One e-mail per user per event: the (user, event) pair is claimed in season_reminder_log before sending and
 * released again if the send fails, so a rerun on the same day never sends twice.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });

  const email = getEmailProvider();
  if (!email) return NextResponse.json({ ok: true, sent: 0, skipped: "email_not_configured" });

  const repo = getAdminRepo();
  const today = istanbulToday();
  let sent = 0;
  let failed = 0;
  for (const user of await repo.listSeasonReminderRecipients()) {
    for (const event of remindersDue(today, user.sector)) {
      if (!(await repo.claimSeasonReminder(user.userId, event.key))) continue;
      const message = buildReminderEmail(event, { siteUrl: siteUrl(), displayName: user.displayName, sector: user.sector });
      const res = await email.send({ to: user.email, ...message, idempotencyKey: `season:${user.userId}:${event.key}` });
      if (res.ok) sent++;
      else {
        failed++;
        await repo.releaseSeasonReminder(user.userId, event.key);
      }
    }
  }
  // Counts only; never addresses or content.
  if (failed) console.error("[season-reminders] send_failed", { failed });
  return NextResponse.json({ ok: true, sent, failed });
}

export const GET = handle;
export const POST = handle;
