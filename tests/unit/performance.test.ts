import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv, parseReport, parseXlsx } from "@/lib/performance/parse";
import { aggregate, bestAndWorst, cellNumber, guessMapping, matchAnalysis, metricsOf, missingRequired, riskVsPerformance, totals } from "@/lib/performance/report";

const jars: Record<string, Map<string, string>> = { a: new Map() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jars.a.has(k) ? { name: k, value: jars.a.get(k)! } : undefined),
    set: (k: string, v: string) => void jars.a.set(k, v),
    delete: (k: string) => void jars.a.delete(k),
  }),
}));

const fixture = readFileSync("tests/fixtures/meta-rapor.csv");

function xlsx(rows: (string | number | { f: string })[][]) {
  const shared: string[] = [];
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheet = rows
    .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = `${col(ci)}${ri + 1}`;
      if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
      if (typeof v === "object") return `<c r="${ref}"><f>${v.f}</f><v>999</v></c>`;
      shared.push(v);
      return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
    }).join("")}</row>`)
    .join("");
  return zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="r"><sheets><sheet name="Rapor" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8(`<sst>${shared.map((s) => `<si><t>${s.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
  });
}

describe("report parsing", () => {
  it("reads a Turkish semicolon CSV, maps columns and never evaluates formulas", () => {
    const r = parseReport("rapor.csv", fixture);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = guessMapping(r.grid[0]);
    expect(missingRequired(m)).toEqual([]);
    expect(m).toMatchObject({ adName: 2, spend: 3, impressions: 4, clicks: 5, conversions: 6, revenue: 7, periodStart: 0, periodEnd: 1 });
    const agg = aggregate(r.grid, m);
    expect(agg.currency).toBe("TRY");
    expect(agg.periodStart).toBe("2026-11-01");
    expect(agg.periodEnd).toBe("2026-11-14");
    // Daily rows of the same ad add up; the total row is skipped; "=1+1" is not a number.
    expect(agg.rows.find((x) => x.adName === "Kış seti A")).toMatchObject({ spend: 2250.5, impressions: 88000, clicks: 1120, conversions: 24, revenue: 14400 });
    expect(agg.rows.find((x) => x.adName === "Hediye kutusu D")?.spend).toBe(0);
    expect(agg.rows.some((x) => x.adName === "Toplam")).toBe(false);
    expect(agg.skippedRows).toBe(1);
    expect(agg.ignoredCells).toBe(1);
  });

  it("reads English CSV and quoted fields", () => {
    const r = parseCsv('Ad name,Amount spent (USD),Impressions,Link clicks,Body (ad settings)\n"Winter, set",1,234.50,"12,000",300,"Warm ""cozy"" text"\n');
    expect(r.ok).toBe(true);
  });

  it("reads XLSX shared strings and returns formula cells as text", () => {
    const bytes = xlsx([
      ["Ad name", "Amount spent (EUR)", "Impressions", "Link clicks", "Note"],
      ["Spring A", 120.5, 4000, 80, { f: "HYPERLINK(&quot;http://evil&quot;)" }],
      ["Spring B", { f: "1+1" }, 2000, 10, "ok"],
    ]);
    const r = parseXlsx(bytes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.grid[1][4]).toBe('=HYPERLINK("http://evil")');
    expect(r.grid[2][1]).toBe("=1+1");
    const agg = aggregate(r.grid, guessMapping(r.grid[0]));
    expect(agg.currency).toBe("EUR");
    expect(agg.rows[0]).toMatchObject({ adName: "Spring A", spend: 120.5, impressions: 4000, clicks: 80 });
    expect(agg.rows[1].spend).toBe(0);
  });

  it("refuses wrong types, empty and oversized files", () => {
    expect(parseReport("x.pdf", new Uint8Array([1, 2, 3])).ok).toBe(false);
    expect(parseReport("x.csv", new Uint8Array()).ok).toBe(false);
    expect(parseReport("x.csv", new Uint8Array(5 * 1024 * 1024 + 1)).ok).toBe(false);
    expect(parseReport("x.csv", new TextEncoder().encode("Ad name\n")).ok).toBe(false);
  });

  it("parses numbers in both locales and rejects formulas and negatives", () => {
    expect(cellNumber("1.234,56")).toBe(1234.56);
    expect(cellNumber("1,234.56")).toBe(1234.56);
    expect(cellNumber("12.000")).toBe(12000);
    expect(cellNumber("12,000")).toBe(12000);
    expect(cellNumber("4,5")).toBe(4.5);
    expect(cellNumber("₺ 300")).toBe(300);
    expect(cellNumber("=SUM(A1:A3)")).toBeNull();
    expect(cellNumber("-5")).toBeNull();
    expect(cellNumber("abc")).toBeNull();
  });
});

describe("report metrics", () => {
  const rows = [
    { id: "a", spend: 100, impressions: 10000, clicks: 200, conversions: 10, revenue: 500 },
    { id: "b", spend: 100, impressions: 10000, clicks: 50, conversions: 2, revenue: 100 },
    { id: "c", spend: 50, impressions: 50, clicks: 5, conversions: 1, revenue: 900 },
  ];
  it("computes CTR, CPC, CPM, CPA and ROAS", () => {
    expect(metricsOf(rows[0])).toEqual({ ctr: 0.02, cpc: 0.5, cpm: 10, cpa: 10, roas: 5 });
    expect(metricsOf({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })).toEqual({ ctr: null, cpc: null, cpm: null, cpa: null, roas: null });
    expect(totals(rows).spend).toBe(250);
  });
  it("ranks by ROAS and ignores ads with too few impressions", () => {
    const r = bestAndWorst(rows, 1);
    expect(r.basis).toBe("roas");
    expect(r.best.map((x) => x.id)).toEqual(["a"]);
    expect(r.worst.map((x) => x.id)).toEqual(["b"]);
  });
  it("groups performance by rejection-risk level", () => {
    const g = riskVsPerformance([{ ...rows[0], riskLevel: "low" }, { ...rows[1], riskLevel: "high" }, { ...rows[2], riskLevel: null }]);
    expect(g.find((x) => x.level === "low")).toMatchObject({ ads: 1, roas: 5 });
    expect(g.find((x) => x.level === "medium")?.ads).toBe(0);
  });
  it("matches ad text to the user's analyses", () => {
    const analyses = [{ id: "x1", headline: "Kış koleksiyonu geldi", primaryText: "Sıcak tutan yün karışımlı kazaklar şimdi mağazada." }];
    expect(matchAnalysis({ adName: "Reklam 1", title: "", body: "sıcak tutan yün karışımlı kazaklar şimdi mağazada." }, analyses)).toBe("x1");
    expect(matchAnalysis({ adName: "Kış koleksiyonu geldi", title: "", body: "" }, analyses)).toBe("x1");
    expect(matchAnalysis({ adName: "Başka", title: "Kış", body: "" }, analyses)).toBeNull();
  });
});

describe("performance imports (memory backend)", () => {
  beforeEach(async () => {
    const { __resetMemoryStoreForTests } = await import("@/lib/data/memory-repo");
    __resetMemoryStoreForTests();
    jars.a.clear();
  });

  it("stores only per-ad totals, keeps share consent off by default and drops foreign analysis ids", async () => {
    const { MemoryRepo } = await import("@/lib/data/memory-repo");
    const { importReport } = await import("@/lib/performance/service");
    const repo = new MemoryRepo();
    await repo.signUp({ email: "perf@example.com", password: "Test-sifre-123", consents: { terms: "v", kvkk: "v", privacy: "v", marketing: false } });
    const res = await importReport(repo, { name: "rapor.csv", bytes: fixture, mapping: { adName: 2, spend: 3, impressions: 4, clicks: 5, conversions: 6, revenue: 7 }, label: "Kasım", shareConsent: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const got = await repo.getPerformanceImport(res.id);
    expect(got?.import).toMatchObject({ label: "Kasım", adCount: 6, shareConsent: false, currency: "TRY" });
    expect(Object.keys(got!.rows[0]).sort()).toEqual(["adName", "analysisId", "clicks", "conversions", "id", "impressions", "revenue", "spend"]);
    expect(await repo.setPerformanceShareConsent(res.id, true)).toBe(true);
    expect((await repo.listPerformanceImports())[0].shareConsent).toBe(true);
    const foreign = await repo.savePerformanceImport({ label: "x", currency: "TRY", periodStart: null, periodEnd: null, shareConsent: false, rows: [{ adName: "a", analysisId: "00000000-0000-4000-8000-000000000000", spend: 1, impressions: 1, clicks: 0, conversions: 0, revenue: 0 }] });
    expect(typeof foreign === "object" && (await repo.getPerformanceImport(foreign.id))?.rows[0].analysisId).toBeNull();
    // Missing required mapping is refused.
    const bad = await importReport(repo, { name: "rapor.csv", bytes: fixture, mapping: { adName: 2 }, label: "x", shareConsent: false });
    expect(bad.ok).toBe(false);
    expect(await repo.deletePerformanceImport(res.id)).toBe(true);
  });
});
