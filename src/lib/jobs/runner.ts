import "server-only";
import { after } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import type { JobRecord } from "@/lib/data/types";
import { deliverWebhook } from "@/lib/webhooks/deliver";
import { retryDelayMs } from "@/lib/webhooks/sign";

/**
 * Background job queue (P7.1). Jobs live in the database and are claimed with `for update skip
 * locked`, so the per-minute cron, `after()` hooks and several instances can run side by side
 * without taking the same job twice. A crashed worker's job is picked up again once its lock
 * expires. Heavy media work (video frames, creatives, bulk checks) stays in the browser or in the
 * request by design; the queue carries the work that must survive the request: webhook delivery.
 */
const LOCK_SECONDS = 60;

export async function processJobs(limit = 10): Promise<{ claimed: number; succeeded: number; failed: number; retried: number }> {
  const admin = getAdminRepo();
  const jobs = await admin.claimJobs(limit, LOCK_SECONDS);
  const out = { claimed: jobs.length, succeeded: 0, failed: 0, retried: 0 };
  for (const job of jobs) {
    const r: JobOutcome = await runJob(job).catch(() => ({ ok: false as const, error: "exception" }));
    if (r.ok) {
      await admin.finishJob(job.id, { ok: true, result: r.result });
      out.succeeded += 1;
    } else if (job.attempts >= job.maxAttempts || r.permanent) {
      await admin.finishJob(job.id, { ok: false, error: r.error, retryAt: null });
      out.failed += 1;
    } else {
      await admin.finishJob(job.id, { ok: false, error: r.error, retryAt: new Date(Date.now() + retryDelayMs(job.attempts)).toISOString() });
      out.retried += 1;
    }
  }
  return out;
}

type JobOutcome = { ok: true; result?: Record<string, unknown> } | { ok: false; error: string; permanent?: boolean };

async function runJob(job: JobRecord): Promise<JobOutcome> {
  if (job.kind === "webhook_delivery") return runWebhook(job);
  return { ok: false, error: "unknown_kind", permanent: true };
}

async function runWebhook(job: JobRecord): Promise<JobOutcome> {
  const admin = getAdminRepo();
  const p = job.payload as { webhookId?: string; event?: string; analysisId?: string };
  if (!job.userId || !p.webhookId || !p.analysisId) return { ok: false, error: "bad_payload", permanent: true };
  const target = await admin.getWebhookTarget(job.userId, p.webhookId);
  if (!target || !target.active) return { ok: false, error: "webhook_removed", permanent: true };
  const a = await admin.repoForUser({ id: job.userId, email: "" }).getAnalysis(p.analysisId);
  if (!a) return { ok: false, error: "analysis_missing", permanent: true };
  // Minimal payload: no ad copy, no personal data. The customer fetches the report with its API key.
  const body = JSON.stringify({
    id: job.id,
    type: p.event ?? "analysis.completed",
    created_at: new Date().toISOString(),
    data: {
      analysis_id: a.id,
      status: a.status,
      platform: a.platform,
      platform_risk_level: a.metaRiskLevel,
      legal_risk_level: a.legalRiskLevel,
      creative_score: a.creativeScore,
      report_url: `${siteUrl()}/api/v1/analyses/${a.id}`,
    },
    disclaimer: "Risk değerlendirmesidir, hukuki görüş değildir.",
  });
  const r = await deliverWebhook(target.url, target.secret, body, job.id);
  const status = r.ok ? String(r.status) : r.status ? String(r.status) : r.code;
  await admin.recordWebhookDelivery(target.id, status);
  if (r.ok) return { ok: true, result: { status: r.status } };
  return { ok: false, error: `delivery_${r.code}`, permanent: r.code === "invalid_url" };
}

/** Queues analysis.completed for every active webhook of the user (once per webhook and analysis). */
export async function queueAnalysisWebhooks(userId: string, analysisId: string) {
  const admin = getAdminRepo();
  const hooks = (await admin.listWebhooks(userId)).filter((h) => h.active);
  let queued = 0;
  for (const h of hooks) {
    const id = await admin.enqueueJob({ userId, kind: "webhook_delivery", payload: { webhookId: h.id, event: "analysis.completed", analysisId }, dedupeKey: `wh:${h.id}:${analysisId}` });
    if (id) queued += 1;
  }
  return queued;
}

/** After a new report: queue its webhooks and try to deliver them once the response is sent. */
export function afterAnalysisCompleted(userId: string, analysisId: string) {
  try {
    after(async () => {
      try {
        if (await queueAnalysisWebhooks(userId, analysisId)) await processJobs(5);
      } catch {
        /* the per-minute cron retries queued jobs */
      }
    });
  } catch {
    /* outside a request (tests): nothing to do */
  }
}
