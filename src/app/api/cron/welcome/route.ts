import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { unsubscribeUrl } from "@/lib/email/links";
import { getEmailProvider } from "@/lib/email/provider";
import { COMMERCIAL_STEPS, buildWelcomeEmail, dueStep } from "@/lib/email/welcome";
import { siteUrl } from "@/lib/env";

export const maxDuration = 120;

/**
 * Welcome series (days 0, 1, 3, 7, 14 after signup). Call daily with `Authorization: Bearer $CRON_SECRET`.
 * Each (user, step) is claimed in welcome_email_log before sending and released if the send fails, so a
 * rerun never sends twice. Step 7 mentions paid packages and goes only to users whose latest marketing
 * consent is granted (ETK / İYS); the others are informational.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });

  const email = getEmailProvider();
  if (!email) return NextResponse.json({ ok: true, sent: 0, skipped: "email_not_configured" });

  const repo = getAdminRepo();
  const now = new Date();
  const site = siteUrl();
  let sent = 0;
  let failed = 0;
  let skippedConsent = 0;
  for (const user of await repo.listWelcomeRecipients(new Date(now.getTime() - 16 * 86_400_000).toISOString())) {
    const step = dueStep(user.createdAt, now);
    if (step === null) continue;
    if (COMMERCIAL_STEPS.has(step) && !user.marketing) {
      skippedConsent++;
      continue;
    }
    if (!(await repo.claimWelcomeEmail(user.userId, step))) continue;
    const m = buildWelcomeEmail(step, { siteUrl: site, displayName: user.displayName, sector: user.sector, balance: user.balance, unsubscribeUrl: unsubscribeUrl(site, user.userId) });
    const res = await email.send({ to: user.email, subject: m.subject, html: m.html, text: m.text, idempotencyKey: `welcome:${user.userId}:${step}` });
    if (res.ok) sent++;
    else {
      failed++;
      await repo.releaseWelcomeEmail(user.userId, step);
    }
  }
  // Counts only; never addresses or content.
  if (failed) console.error("[welcome] send_failed", { failed });
  return NextResponse.json({ ok: true, sent, failed, skippedConsent });
}

export const GET = handle;
export const POST = handle;
