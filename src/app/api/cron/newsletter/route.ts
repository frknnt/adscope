import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { istanbulToday } from "@/lib/calendar/season";
import { getAdminRepo } from "@/lib/data";
import { getEmailProvider } from "@/lib/email/provider";
import { siteUrl } from "@/lib/env";
import { buildNewsletter, newsletterPeriod } from "@/lib/newsletter";

export const maxDuration = 300;

/**
 * Monthly regulation newsletter to users whose latest marketing e-mail consent is granted.
 * Call once a month (or daily: the (user, month) pair is claimed in newsletter_log, so a rerun never
 * sends twice) with `Authorization: Bearer $CRON_SECRET`.
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
  const period = newsletterPeriod(today);
  let sent = 0;
  let failed = 0;
  for (const user of await repo.listNewsletterRecipients()) {
    if (!(await repo.claimNewsletter(user.userId, period))) continue;
    const message = buildNewsletter(today, { siteUrl: siteUrl(), displayName: user.displayName, sector: user.sector });
    const res = await email.send({ to: user.email, subject: message.subject, text: message.text, html: message.html, idempotencyKey: `newsletter:${user.userId}:${period}` });
    if (res.ok) sent++;
    else {
      failed++;
      await repo.releaseNewsletter(user.userId, period);
    }
  }
  if (failed) console.error("[newsletter] send_failed", { failed });
  return NextResponse.json({ ok: true, period, sent, failed });
}

export const GET = handle;
export const POST = handle;
