import "server-only";
import type { MetaAdLibrary } from "@/lib/ads-library/meta";
import { isLibraryCountry } from "@/lib/ads-library/meta";
import type { AdminRepo, CompetitorSummary } from "@/lib/data/types";
import type { EmailProvider } from "@/lib/email/provider";
import { buildDigest, isoWeek, summarize } from "./summary";

/** Real Ad Library calls per cron run; cached searches do not count. */
export const CALLS_PER_RUN = 200;

export async function runCompetitorCheck(repo: AdminRepo, library: MetaAdLibrary, email: EmailProvider | null, siteUrl: string, today = new Date()) {
  const watches = await repo.listAllWatches();
  let calls = 0;
  let checked = 0;
  let failed = 0;
  const byUser = new Map<string, { term: string; summary: CompetitorSummary }[]>();
  for (const w of watches) {
    if (!isLibraryCountry(w.country)) continue;
    const res = await library.search({ q: w.term, country: w.country, turkishOnly: false, activeOnly: true }, () => calls++ < CALLS_PER_RUN);
    if (!res.ok) {
      failed++;
      if (res.reason === "not_configured" || res.reason === "token_invalid") break;
      continue;
    }
    const { summary, seenIds } = summarize(res.ads, w.seenIds, today);
    await repo.saveWatchResult(w.id, { seenIds, summary });
    checked++;
    byUser.set(w.userId, [...(byUser.get(w.userId) ?? []), { term: w.term, summary }]);
  }
  let sent = 0;
  if (email) {
    const week = isoWeek(today);
    for (const [userId, list] of byUser) {
      const contact = await repo.getUserContact(userId);
      if (!contact) continue;
      const key = `rakip:${week}`;
      if (!(await repo.claimSeasonReminder(userId, key))) continue;
      const msg = buildDigest({ displayName: contact.displayName, siteUrl, watches: list });
      const r = await email.send({ to: contact.email, subject: msg.subject, text: msg.text, html: msg.html, idempotencyKey: `${key}:${userId}` });
      if (r.ok) sent++;
      else await repo.releaseSeasonReminder(userId, key);
    }
  }
  return { checked, failed, sent };
}
