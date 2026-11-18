import type { Instrumentation } from "next";

export function register() {}

/**
 * Server errors go to error monitoring only when SENTRY_DSN is set, scrubbed of personal data,
 * ad copy and secrets (see src/lib/monitoring/scrub.ts). The route pattern is sent, never the URL.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/monitoring/report");
  await reportError(err, { path: context.routePath, kind: context.routeType });
};
