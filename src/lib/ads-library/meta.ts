import "server-only";

/**
 * Meta Ad Library adapter (Graph API `ads_archive`).
 *
 * - Enabled only when META_AD_LIBRARY_TOKEN is set (a user access token of a Meta developer app
 *   whose owner completed identity confirmation for the Ad Library API).
 * - For non-political ads the API returns only ads delivered in the EU (DSA transparency), so the
 *   country list is EU-only. Turkey-only ads are not available through the API.
 * - We never return `ad_snapshot_url`: Meta embeds the access token in it. Each ad links to the
 *   public Ad Library page instead.
 * - Search terms and results are not logged.
 */

export const LIBRARY_COUNTRIES = {
  DE: "Almanya",
  NL: "Hollanda",
  AT: "Avusturya",
  BE: "Belçika",
  FR: "Fransa",
  DK: "Danimarka",
  SE: "İsveç",
  BG: "Bulgaristan",
  GR: "Yunanistan",
  CY: "Kıbrıs (AB)",
} as const;
export type LibraryCountry = keyof typeof LIBRARY_COUNTRIES;
export const isLibraryCountry = (v: unknown): v is LibraryCountry => typeof v === "string" && v in LIBRARY_COUNTRIES;

export interface LibraryAd {
  id: string;
  pageName: string;
  bodies: string[];
  titles: string[];
  descriptions: string[];
  deliveryStart: string | null;
  deliveryStop: string | null;
  platforms: string[];
  languages: string[];
  euReach: number | null;
  libraryUrl: string;
}

export interface LibraryQuery {
  q: string;
  country: LibraryCountry;
  turkishOnly: boolean;
  activeOnly: boolean;
  after?: string | null;
}

export type LibraryResult =
  | { ok: true; ads: LibraryAd[]; after: string | null }
  | { ok: false; reason: "not_configured" | "token_invalid" | "rate_limited" | "timeout" | "api_error" | "invalid_query" };

const FIELDS = [
  "id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
].join(",");

const CURSOR_RE = /^[A-Za-z0-9_=-]{1,400}$/;
const ID_RE = /^[0-9]{1,30}$/;
const PAGE_SIZE = 24;

const strings = (v: unknown, max: number, each: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.trim().slice(0, each)).filter(Boolean) : [];
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Keeps only the fields we use, with length caps; drops rows without a numeric id. */
export function parseLibraryAds(json: unknown): { ads: LibraryAd[]; after: string | null } {
  const root = (json ?? {}) as { data?: unknown; paging?: { cursors?: { after?: unknown }; next?: unknown } };
  const rows = Array.isArray(root.data) ? root.data : [];
  const ads: LibraryAd[] = [];
  const seen = new Set<string>();
  for (const raw of rows.slice(0, 50)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    if (!ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ads.push({
      id,
      pageName: typeof r.page_name === "string" ? r.page_name.trim().slice(0, 200) : "",
      // Dynamic creatives can carry many near-identical bodies; three are enough for inspiration.
      bodies: [...new Set(strings(r.ad_creative_bodies, 10, 2200))].slice(0, 3),
      titles: [...new Set(strings(r.ad_creative_link_titles, 10, 300))].slice(0, 3),
      descriptions: [...new Set(strings(r.ad_creative_link_descriptions, 10, 300))].slice(0, 2),
      deliveryStart: day(r.ad_delivery_start_time),
      deliveryStop: day(r.ad_delivery_stop_time),
      platforms: strings(r.publisher_platforms, 6, 30),
      languages: strings(r.languages, 6, 10),
      euReach: typeof r.eu_total_reach === "number" && Number.isFinite(r.eu_total_reach) ? r.eu_total_reach : null,
      libraryUrl: `https://www.facebook.com/ads/library/?id=${id}`,
    });
  }
  const after = root.paging?.next && typeof root.paging?.cursors?.after === "string" && CURSOR_RE.test(root.paging.cursors.after) ? root.paging.cursors.after : null;
  return { ads, after };
}

/** META_GRAPH_BASE_URL (test mocks) is ignored in production so the token can only go to Meta. */
function graphBaseUrl() {
  const prod = process.env.APP_MODE === "production" || process.env.NODE_ENV === "production";
  const custom = process.env.META_GRAPH_BASE_URL;
  return (!prod && custom ? custom : "https://graph.facebook.com").replace(/\/+$/, "");
}

/** Small per-process cache so repeated searches do not spend the app's Graph API quota. */
const cache = new Map<string, { at: number; value: { ads: LibraryAd[]; after: string | null } }>();
const CACHE_MS = 10 * 60_000;

export class MetaAdLibrary {
  readonly enabled: boolean;

  constructor(
    private token = process.env.META_AD_LIBRARY_TOKEN,
    private version = /^v\d{1,3}\.\d$/.test(process.env.META_GRAPH_VERSION ?? "") ? process.env.META_GRAPH_VERSION! : "v24.0",
    private baseUrl = graphBaseUrl(),
  ) {
    this.enabled = Boolean(token);
  }

  /** `allow` is asked only on a cache miss, so callers can rate-limit real API calls. */
  async search(query: LibraryQuery, allow: () => boolean = () => true): Promise<LibraryResult> {
    if (!this.token) return { ok: false, reason: "not_configured" };
    const q = query.q.replace(/\s+/g, " ").trim().slice(0, 100);
    if (q.length < 2 || !isLibraryCountry(query.country)) return { ok: false, reason: "invalid_query" };
    const after = query.after && CURSOR_RE.test(query.after) ? query.after : null;

    const params = new URLSearchParams({
      search_terms: q,
      ad_reached_countries: JSON.stringify([query.country]),
      ad_type: "ALL",
      ad_active_status: query.activeOnly ? "ACTIVE" : "ALL",
      search_type: "KEYWORD_UNORDERED",
      fields: FIELDS,
      limit: String(PAGE_SIZE),
    });
    if (query.turkishOnly) params.set("languages", JSON.stringify(["tr"]));
    if (after) params.set("after", after);

    const key = params.toString();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, ...hit.value };
    if (!allow()) return { ok: false, reason: "rate_limited" };

    try {
      const res = await fetch(`${this.baseUrl}/${this.version}/ads_archive?${key}`, {
        // Token in the header, not the URL, so it never shows up in proxy logs.
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as { error?: { code?: number } } | null;
      if (!res.ok || json?.error) {
        const code = json?.error?.code;
        if (code === 190 || code === 10 || res.status === 401) return { ok: false, reason: "token_invalid" };
        if (code === 4 || code === 17 || code === 613 || res.status === 429) return { ok: false, reason: "rate_limited" };
        return { ok: false, reason: "api_error" };
      }
      const value = parseLibraryAds(json);
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), value });
      return { ok: true, ...value };
    } catch (e) {
      return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "api_error" };
    }
  }
}

export function getAdLibrary(): MetaAdLibrary {
  return new MetaAdLibrary();
}
