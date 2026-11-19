import "server-only";
import { extractSiteSuggestion, type SiteSuggestion } from "@/lib/brand/kit";
import type { DataRepo } from "@/lib/data/types";
import { extractLanding } from "@/lib/engine/landing";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { fold } from "@/lib/engine/text";
import { fetchHtml } from "@/lib/landing/fetch";
import { guessSector, type Sector } from "@/lib/sectors";
import { topRiskyPhrases, type RiskyPhrase } from "./risky";

export interface SiteScan {
  website: string;
  suggestion: SiteSuggestion;
  sector: Sector;
  sectorConfident: boolean;
  risks: RiskyPhrase[];
  /** The page renders its content with JavaScript, so little text could be read. */
  thin: boolean;
}

/**
 * First-minute scan (P9.2): one SSRF-protected fetch of the user's site, brand-kit suggestions,
 * a sector guess and the first risky phrases the rule engine finds in the visible text. Nothing is
 * stored; the page content is untrusted data and is only text-matched.
 */
export async function scanSite(repo: DataRepo, website: string): Promise<{ ok: true; scan: SiteScan } | { ok: false; status: string }> {
  const page = await fetchHtml(website);
  if (!page.ok) return { ok: false, status: page.status };
  const suggestion = extractSiteSuggestion(page.html, page.finalUrl);
  const landing = extractLanding(page.html);
  const text = [landing.title, landing.description, ...landing.h1, landing.text].filter(Boolean).join(" . ");
  const guess = guessSector(fold(text));
  const rules = await repo.getRules(guess.sector);
  const findings = runRuleEngine({ headline: "", primaryText: text, description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } }, rules);
  return {
    ok: true,
    scan: { website, suggestion, sector: guess.sector, sectorConfident: guess.confident, risks: topRiskyPhrases(findings, rules, 3), thin: landing.jsShell },
  };
}
