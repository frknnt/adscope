import { sanitize } from "@/lib/engine/rewrite";
import { fold, tidy } from "@/lib/engine/text";
import type { RuleRecord } from "@/lib/engine/types";
import type { Sector } from "@/lib/sectors";
import { SECTOR_INFO } from "@/lib/sectors";

/** Public sector guides (P5.3). Everything on a guide page comes from the rule cards and their sources. */
export const GUIDE_SLUGS = {
  "takviye-gida": "takviye_gida",
  "estetik-klinik": "estetik_klinik",
  kozmetik: "kozmetik",
  "kurs-egitim": "kurs_egitim",
  emlak: "emlak",
  finans: "finans",
} as const satisfies Record<string, Exclude<Sector, "genel">>;
export type GuideSlug = keyof typeof GUIDE_SLUGS;
export const isGuideSlug = (s: string): s is GuideSlug => Object.hasOwn(GUIDE_SLUGS, s);

export interface Guide {
  slug: GuideSlug;
  sector: Exclude<Sector, "genel">;
  label: string;
  title: string;
  description: string;
  /** Cards of this sector (tr_law and platform policy), active first. */
  cards: RuleRecord[];
  /** General cards that also apply to every sector. */
  general: RuleRecord[];
  risky: { text: string; ruleId: string; verified: boolean }[];
  safe: { from: string; to: string; ruleId: string; verified: boolean }[];
  sources: { org: string; title: string; url: string }[];
  lastVerified: string | null;
}

const visible = (r: RuleRecord) => r.status === "active" || r.status === "requires_review";
const order = (a: RuleRecord, b: RuleRecord) => (a.status === b.status ? a.id.localeCompare(b.id) : a.status === "active" ? -1 : 1);

export function buildGuide(slug: GuideSlug, all: RuleRecord[]): Guide {
  const sector = GUIDE_SLUGS[slug];
  const label = SECTOR_INFO[sector].long;
  const cards = all.filter((r) => r.sector === sector && r.domain !== "creative_quality" && visible(r)).sort(order);
  const general = all.filter((r) => r.sector === "genel" && r.domain === "tr_law" && r.status === "active").sort(order).slice(0, 6);
  const risky = cards.flatMap((r) => r.riskyExamples.slice(0, 3).map((text) => ({ text, ruleId: r.id, verified: r.status === "active" }))).slice(0, 18);
  // Safer wordings are produced by the same rewrite the product uses, from each card's own examples.
  const safe = cards
    .flatMap((r) => r.riskyExamples.slice(0, 2).map((from) => ({ from, to: tidy(sanitize(from, [r])), ruleId: r.id, verified: r.status === "active" })))
    .filter((s) => s.to && fold(s.to) !== fold(s.from))
    .slice(0, 12);
  const seen = new Set<string>();
  const sources = [...cards, ...general]
    .filter((r) => r.sourceUrl && !seen.has(r.sourceUrl) && seen.add(r.sourceUrl))
    .map((r) => ({ org: r.sourceOrg, title: r.sourceTitle, url: r.sourceUrl }));
  const dates = cards.map((r) => r.lastVerifiedAt).filter((d): d is string => Boolean(d)).sort();
  return {
    slug,
    sector,
    label,
    title: `${label} reklamlarında sık reddedilen ifadeler ve güvenli yazım`,
    description: `${label} reklamlarında Meta, Google Ads, TikTok politikaları ve Türk reklam mevzuatı açısından riskli ifadeler, daha güvenli yazım örnekleri ve resmî kaynaklar.`,
    cards,
    general,
    risky,
    safe,
    sources,
    lastVerified: dates.at(-1) ?? null,
  };
}
