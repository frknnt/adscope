import { describe, expect, it } from "vitest";
import type { AnalysisSummary } from "@/lib/data/types";
import { toCsv } from "@/lib/export/csv";
import { dashboardStats, filterReports, parseReportFilters, REPORT_CSV_HEADER, reportRows, worstLevel } from "@/lib/panel/reports";

const BRAND = "11111111-1111-4111-8111-111111111111";

function a(p: Partial<AnalysisSummary>): AnalysisSummary {
  return {
    id: p.id ?? "x",
    status: "completed",
    failureCode: null,
    sector: "genel",
    headline: "",
    primaryText: "",
    metaRiskScore: 20,
    metaRiskLevel: "low",
    legalRiskLevel: "low",
    legalFindingCount: 0,
    creativeScore: 70,
    mediaType: "image",
    platform: "meta",
    brandId: null,
    createdAt: "2026-11-10T10:00:00Z",
    expiresAt: null,
    ownedByMe: true,
    ...p,
  };
}

const items = [
  a({ id: "1", headline: "Detoks çayı", metaRiskScore: 80, metaRiskLevel: "high", brandId: BRAND, createdAt: "2026-11-15T10:00:00Z" }),
  a({ id: "2", headline: "Kış kampanyası", platform: "tiktok", legalRiskLevel: "medium", createdAt: "2026-10-20T10:00:00Z" }),
  a({ id: "3", headline: "Yarım kalan", status: "failed", metaRiskScore: null, metaRiskLevel: null, legalRiskLevel: null, createdAt: "2026-11-16T10:00:00Z" }),
];

describe("report filters", () => {
  it("parses only known values from URL params", () => {
    const f = parseReportFilters({ q: "  çay ", platform: "tiktok", risk: "high", marka: BRAND, sirala: "eski", gorunum: "liste" });
    expect(f).toEqual({ q: "çay", platform: "tiktok", risk: "high", brand: BRAND, sort: "eski", view: "liste" });
    const bad = parseReportFilters({ platform: "x", risk: "kritik", marka: "' or 1=1", gorunum: ["liste", "izgara"] });
    expect(bad).toMatchObject({ platform: null, risk: null, brand: null, view: "liste" });
  });

  it("filters by text, platform, brand and worst risk level", () => {
    const f = parseReportFilters({});
    expect(filterReports(items, { ...f, q: "DETOKS" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterReports(items, { ...f, platform: "tiktok" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterReports(items, { ...f, brand: BRAND }).map((x) => x.id)).toEqual(["1"]);
    expect(filterReports(items, { ...f, brand: "yok" }).map((x) => x.id)).toEqual(["3", "2"]);
    expect(filterReports(items, { ...f, risk: "medium" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterReports(items, { ...f, sort: "eski" }).map((x) => x.id)).toEqual(["2", "1", "3"]);
    expect(worstLevel({ metaRiskLevel: "low", legalRiskLevel: "high" })).toBe("high");
  });
});

describe("dashboard stats", () => {
  it("counts this Istanbul month, averages the last completed risks and counts high risk", () => {
    const s = dashboardStats(items, new Date("2026-11-17T09:00:00Z"));
    expect(s).toEqual({ thisMonth: 1, avgRisk: 50, highRisk: 1 });
    expect(dashboardStats([], new Date())).toEqual({ thisMonth: 0, avgRisk: null, highRisk: 0 });
  });

  it("uses the Istanbul calendar month, not UTC", () => {
    const late = a({ createdAt: "2026-10-31T22:30:00Z" }); // 1 Kasım 01:30 in Istanbul
    expect(dashboardStats([late], new Date("2026-11-05T09:00:00Z")).thisMonth).toBe(1);
  });
});

describe("report CSV", () => {
  it("keeps the disclaimer and neutralises formula-like ad text", () => {
    const csv = toCsv([REPORT_CSV_HEADER, ...reportRows([a({ headline: "=HYPERLINK(1)" })], () => "")]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("Risk değerlendirmesidir, hukuki görüş değildir.");
  });
});
