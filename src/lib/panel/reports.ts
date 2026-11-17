import type { AnalysisSummary } from "@/lib/data/types";
import type { Level } from "@/lib/engine/types";
import { isPlatform, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import { SECTOR_LABEL } from "@/lib/sectors";

/** Report list filters, read from URL search params. Anything unknown is ignored. */
export interface ReportFilters {
  q: string;
  brand: string | null;
  platform: Platform | null;
  risk: Level | null;
  sort: "yeni" | "eski";
  view: "izgara" | "liste";
}

const LEVELS = ["low", "medium", "high"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseReportFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const risk = one(sp.risk);
  const platform = one(sp.platform);
  const brand = one(sp.marka);
  return {
    q: one(sp.q).trim().slice(0, 80),
    brand: brand === "yok" || UUID.test(brand) ? brand : null,
    platform: isPlatform(platform) ? platform : null,
    risk: (LEVELS as readonly string[]).includes(risk) ? (risk as Level) : null,
    sort: one(sp.sirala) === "eski" ? "eski" : "yeni",
    view: one(sp.gorunum) === "liste" ? "liste" : "izgara",
  };
}

export function reportTitle(a: Pick<AnalysisSummary, "headline" | "primaryText">): string {
  return a.headline || a.primaryText.slice(0, 80) || "Başlıksız reklam";
}

/** The worse of the Meta and legal levels: what a "risk" filter or badge should reflect. */
export function worstLevel(a: Pick<AnalysisSummary, "metaRiskLevel" | "legalRiskLevel">): Level | null {
  const order: Record<Level, number> = { low: 0, medium: 1, high: 2 };
  const ls = [a.metaRiskLevel, a.legalRiskLevel].filter((l): l is Level => !!l);
  if (!ls.length) return null;
  return ls.reduce((x, y) => (order[y] > order[x] ? y : x));
}

export function filterReports(items: AnalysisSummary[], f: ReportFilters): AnalysisSummary[] {
  const q = f.q.toLocaleLowerCase("tr-TR");
  const out = items.filter((a) => {
    if (f.platform && a.platform !== f.platform) return false;
    if (f.brand === "yok" ? a.brandId !== null : f.brand && a.brandId !== f.brand) return false;
    if (f.risk && (a.status !== "completed" || worstLevel(a) !== f.risk)) return false;
    if (q && !`${a.headline} ${a.primaryText}`.toLocaleLowerCase("tr-TR").includes(q)) return false;
    return true;
  });
  out.sort((x, y) => (f.sort === "eski" ? x.createdAt.localeCompare(y.createdAt) : y.createdAt.localeCompare(x.createdAt)));
  return out;
}

export interface DashboardStats {
  /** Analyses started in the current Istanbul calendar month. */
  thisMonth: number;
  /** Mean Meta rejection risk of the last 10 completed analyses; null when there are none. */
  avgRisk: number | null;
  /** Completed analyses with a high Meta or legal level. */
  highRisk: number;
}

function istanbulMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).format(new Date(iso));
}

export function dashboardStats(items: AnalysisSummary[], now: Date): DashboardStats {
  const month = istanbulMonth(now.toISOString());
  const completed = [...items].filter((a) => a.status === "completed").sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const last = completed.slice(0, 10).filter((a) => a.metaRiskScore !== null);
  return {
    thisMonth: items.filter((a) => a.status !== "failed" && istanbulMonth(a.createdAt) === month).length,
    avgRisk: last.length ? Math.round(last.reduce((s, a) => s + (a.metaRiskScore ?? 0), 0) / last.length) : null,
    highRisk: completed.filter((a) => a.metaRiskLevel === "high" || a.legalRiskLevel === "high").length,
  };
}

export const REPORT_CSV_HEADER = ["Başlık", "Marka", "Platform", "Sektör", "Tür", "Durum", "Meta ret riski", "Meta düzeyi", "Mevzuat düzeyi", "Kreatif skoru", "Tarih", "Not"];

const LEVEL_TR: Record<Level, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };
const STATUS_TR = { completed: "Tamamlandı", processing: "İşleniyor", failed: "Tamamlanamadı" } as const;

export function reportRows(items: AnalysisSummary[], brandName: (id: string | null) => string): unknown[][] {
  return items.map((a) => [
    reportTitle(a),
    brandName(a.brandId),
    PLATFORM_SHORT[a.platform],
    SECTOR_LABEL[a.sector],
    a.mediaType === "video" ? "Video" : "Görsel",
    STATUS_TR[a.status],
    a.metaRiskScore ?? "",
    a.metaRiskLevel ? LEVEL_TR[a.metaRiskLevel] : "",
    a.legalRiskLevel ? LEVEL_TR[a.legalRiskLevel] : "",
    a.creativeScore ?? "",
    a.createdAt,
    "Risk değerlendirmesidir, hukuki görüş değildir.",
  ]);
}
