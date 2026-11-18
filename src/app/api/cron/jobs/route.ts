import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { processJobs } from "@/lib/jobs/runner";

export const maxDuration = 60;

/**
 * Job queue worker (P7.1). Vercel calls it every 5 minutes with `Authorization: Bearer $CRON_SECRET`;
 * new jobs are also tried right after the request that created them (after()). Claiming uses
 * `for update skip locked`, so overlapping runs never take the same job.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });
  const totals = { claimed: 0, succeeded: 0, failed: 0, retried: 0 };
  const started = Date.now();
  // Up to 5 batches or ~40 s, whichever comes first.
  for (let i = 0; i < 5 && Date.now() - started < 40_000; i++) {
    const r = await processJobs(20);
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
    if (r.claimed < 20) break;
  }
  await getAdminRepo().purgeScaleTables();
  return NextResponse.json({ ok: true, ...totals });
}

export const GET = handle;
export const POST = handle;
