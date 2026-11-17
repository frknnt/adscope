import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaAdLibrary, parseLibraryAds } from "@/lib/ads-library/meta";

const sample = {
  data: [
    {
      id: "1234567890",
      page_name: "Örnek Kozmetik",
      ad_creative_bodies: ["Cildine iyi bak.", "Cildine iyi bak.", "İkinci metin"],
      ad_creative_link_titles: ["Yeni seri"],
      ad_delivery_start_time: "2026-10-01",
      publisher_platforms: ["FACEBOOK", "INSTAGRAM"],
      eu_total_reach: 1200,
      ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=1&access_token=SECRET",
    },
    { id: "not-a-number", page_name: "Bozuk" },
    { id: "1234567890", page_name: "Tekrar" },
  ],
  paging: { cursors: { after: "QVFIUk1" }, next: "https://graph.facebook.com/…" },
};

afterEach(() => vi.unstubAllGlobals());

describe("Meta Ad Library adapter", () => {
  it("keeps only safe fields and never exposes the snapshot URL", () => {
    const { ads, after } = parseLibraryAds(sample);
    expect(ads).toHaveLength(1);
    expect(ads[0].bodies).toEqual(["Cildine iyi bak.", "İkinci metin"]);
    expect(ads[0].libraryUrl).toBe("https://www.facebook.com/ads/library/?id=1234567890");
    expect(JSON.stringify(ads)).not.toContain("SECRET");
    expect(after).toBe("QVFIUk1");
  });

  it("reports not_configured without a token and never calls the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await new MetaAdLibrary("").search({ q: "kolajen", country: "DE", turkishOnly: true, activeOnly: true });
    expect(r).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the token in a header, EU country and Turkish language filters", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(sample), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const lib = new MetaAdLibrary("tok_test", "v24.0", "https://graph.example");
    const r = await lib.search({ q: "  kolajen   serum ", country: "NL", turkishOnly: true, activeOnly: false });
    expect(r.ok).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    const u = new URL(url);
    expect(u.pathname).toBe("/v24.0/ads_archive");
    expect(u.searchParams.get("search_terms")).toBe("kolajen serum");
    expect(u.searchParams.get("ad_reached_countries")).toBe('["NL"]');
    expect(u.searchParams.get("languages")).toBe('["tr"]');
    expect(u.searchParams.get("ad_active_status")).toBe("ALL");
    expect(u.searchParams.get("fields")).not.toContain("ad_snapshot_url");
    expect(url).not.toContain("tok_test");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok_test");
  });

  it("maps Graph API errors and asks the limiter only on a cache miss", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 })));
    const lib = new MetaAdLibrary("tok", "v24.0", "https://graph.example");
    expect(await lib.search({ q: "zayıflama", country: "DE", turkishOnly: false, activeOnly: true })).toEqual({ ok: false, reason: "token_invalid" });
    expect(await lib.search({ q: "zayıflama 2", country: "DE", turkishOnly: false, activeOnly: true }, () => false)).toEqual({ ok: false, reason: "rate_limited" });
    // Unknown country never reaches the API.
    expect(await lib.search({ q: "abc", country: "TR" as never, turkishOnly: false, activeOnly: true })).toEqual({ ok: false, reason: "invalid_query" });
  });
});
