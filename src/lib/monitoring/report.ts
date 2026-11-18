import "server-only";
import { randomUUID } from "node:crypto";
import { routeOf, scrubStack, scrubText } from "./scrub";

/**
 * Sends a scrubbed error event to Sentry when SENTRY_DSN is set (envelope endpoint, no SDK).
 * Without the DSN this does nothing. Never throws and never blocks the request for long.
 */
export function monitoringEnabled() {
  return Boolean(parseDsn(process.env.SENTRY_DSN));
}

function parseDsn(dsn: string | undefined) {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(projectId)) return null;
    return { key: u.username, host: u.host, projectId, dsn };
  } catch {
    return null;
  }
}

export function buildErrorEvent(err: unknown, ctx: { path?: string; kind?: string }) {
  const e = err instanceof Error ? err : new Error("non_error_thrown");
  return {
    event_id: randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.APP_MODE ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    exception: { values: [{ type: e.name || "Error", value: scrubText(e.message || "") }] },
    tags: { route: routeOf(ctx.path), kind: ctx.kind ?? "request", digest: (e as { digest?: string }).digest?.slice(0, 40) },
    extra: { stack: scrubStack(e.stack) },
  };
}

export async function reportError(err: unknown, ctx: { path?: string; kind?: string } = {}) {
  const d = parseDsn(process.env.SENTRY_DSN);
  if (!d) return;
  const event = buildErrorEvent(err, ctx);
  const envelope = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: d.dsn })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  try {
    await fetch(`https://${d.host}/api/${d.projectId}/envelope/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.key}, sentry_client=adscope/1.0` },
      body: envelope,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* monitoring must never break the app */
  }
}
