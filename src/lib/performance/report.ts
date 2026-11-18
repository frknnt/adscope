import { fold } from "@/lib/engine/text";
import type { Grid } from "./parse";

/** Fields AdScope reads from an Ads Manager export. */
export const PERF_FIELDS = ["adName", "spend", "impressions", "clicks", "conversions", "revenue", "title", "body", "periodStart", "periodEnd"] as const;
export type PerfField = (typeof PERF_FIELDS)[number];
export const REQUIRED_FIELDS: PerfField[] = ["adName", "spend", "impressions"];

export const FIELD_LABEL: Record<PerfField, string> = {
  adName: "Reklam adı",
  spend: "Harcanan tutar",
  impressions: "Gösterim",
  clicks: "Tıklama (bağlantı tıklaması)",
  conversions: "Dönüşüm (satın alma ya da sonuç)",
  revenue: "Dönüşüm değeri (ciro)",
  title: "Başlık (reklam ayarları)",
  body: "Ana metin (reklam ayarları)",
  periodStart: "Raporlama başlangıcı",
  periodEnd: "Raporlama bitişi",
};

/** Column names of Turkish and English Ads Manager exports, best match first. */
const SYNONYMS: Record<PerfField, string[]> = {
  adName: ["reklam adı", "ad name", "reklam"],
  spend: ["harcanan tutar", "amount spent", "harcama", "spend", "cost", "maliyet"],
  impressions: ["gösterimler", "impressions", "gösterim"],
  clicks: ["bağlantı tıklamaları", "link clicks", "tıklamalar (tümü)", "clicks (all)", "tıklamalar", "clicks", "tıklama"],
  conversions: ["satın almalar", "purchases", "web sitesi satın almaları", "website purchases", "sonuçlar", "results", "dönüşümler", "conversions"],
  revenue: [
    "satın almaların dönüşüm değeri",
    "purchases conversion value",
    "satın alma dönüşüm değeri",
    "purchase conversion value",
    "web sitesi satın almalarının dönüşüm değeri",
    "website purchases conversion value",
    "dönüşüm değeri",
    "conversion value",
  ],
  title: ["başlık (reklam ayarları)", "title (ad settings)", "başlık", "headline", "title"],
  body: ["gövde (reklam ayarları)", "body (ad settings)", "metin (reklam ayarları)", "ana metin", "primary text", "body"],
  periodStart: ["raporlama başlangıcı", "reporting starts"],
  periodEnd: ["raporlama bitişi", "reporting ends"],
};

export type Mapping = Partial<Record<PerfField, number>>;

const norm = (s: string) => fold(s).replace(/\s+/g, " ").trim();

/** Guesses which column holds which field; a header matches a name exactly or with a "(...)" suffix such as "(TRY)". */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map(norm);
  const used = new Set<number>();
  const out: Mapping = {};
  for (const field of PERF_FIELDS) {
    for (const syn of SYNONYMS[field].map(norm)) {
      const idx = h.findIndex((x, i) => !used.has(i) && (x === syn || x.startsWith(`${syn} (`)));
      if (idx >= 0) {
        out[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return out;
}

export function missingRequired(m: Mapping): PerfField[] {
  return REQUIRED_FIELDS.filter((f) => m[f] === undefined);
}

/** Currency code from a header like "Amount spent (TRY)". */
export function currencyFrom(header: string | undefined): string {
  return /\(([A-Z]{3})\)/.exec(header ?? "")?.[1] ?? "TRY";
}

/**
 * Number from an exported cell: "1.234,56", "1,234.56", "1234", "₺1.234". Formula cells
 * ("=..."), text and negatives are not numbers (null).
 */
export function cellNumber(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s || /^[=+@]/.test(s)) return null;
  const t = s.replace(/[\s₺$€]|TRY|TL|USD|EUR/gi, "");
  if (!/^-?[\d.,]+$/.test(t) || t.startsWith("-")) return null;
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let n: string;
  if (lastDot >= 0 && lastComma >= 0) n = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (lastComma >= 0) n = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  else if (lastDot >= 0) n = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  else n = t;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export interface PerfRowInput {
  adName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  /** Ad text used only to match AdScope analyses at import time; never stored. */
  text: { title: string; body: string };
}

export interface Aggregated {
  rows: PerfRowInput[];
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  skippedRows: number;
  /** Cells that held a formula or text where a number was expected (read as 0). */
  ignoredCells: number;
}

export const MAX_ADS = 2000;

/** Groups the export by ad name (daily rows add up) and keeps only totals. */
export function aggregate(grid: Grid, m: Mapping): Aggregated {
  const [header, ...data] = grid;
  const byName = new Map<string, PerfRowInput>();
  let skipped = 0;
  let ignored = 0;
  let start: string | null = null;
  let end: string | null = null;
  const num = (row: string[], f: PerfField) => {
    const i = m[f];
    if (i === undefined) return 0;
    const raw = row[i];
    const v = cellNumber(raw);
    if (v === null && (raw ?? "").trim() && (raw ?? "").trim() !== "-") ignored++;
    return v ?? 0;
  };
  const txt = (row: string[], f: PerfField, max: number) => {
    const i = m[f];
    const v = i === undefined ? "" : (row[i] ?? "").trim();
    return /^[=+@-]/.test(v) ? v.replace(/^[=+@-]+/, "").slice(0, max) : v.slice(0, max);
  };
  for (const row of data) {
    const name = txt(row, "adName", 200).replace(/\s+/g, " ");
    // Summary rows ("Toplam", "Total results") and blank names are not ads.
    if (!name || /^(toplam|total|results|sonuçlar)\b/i.test(name)) {
      skipped++;
      continue;
    }
    const d = { spend: num(row, "spend"), impressions: num(row, "impressions"), clicks: num(row, "clicks"), conversions: num(row, "conversions"), revenue: num(row, "revenue") };
    const ds = isoDate(txt(row, "periodStart", 20));
    const de = isoDate(txt(row, "periodEnd", 20));
    if (ds && (!start || ds < start)) start = ds;
    if (de && (!end || de > end)) end = de;
    const prev = byName.get(name);
    if (prev) {
      prev.spend += d.spend;
      prev.impressions += d.impressions;
      prev.clicks += d.clicks;
      prev.conversions += d.conversions;
      prev.revenue += d.revenue;
      if (!prev.text.body) prev.text.body = txt(row, "body", 600);
      if (!prev.text.title) prev.text.title = txt(row, "title", 200);
    } else if (byName.size < MAX_ADS) {
      byName.set(name, { adName: name, ...d, text: { title: txt(row, "title", 200), body: txt(row, "body", 600) } });
    } else skipped++;
  }
  const rows = [...byName.values()].map((r) => ({ ...r, spend: round2(r.spend), revenue: round2(r.revenue), impressions: Math.round(r.impressions), clicks: Math.round(r.clicks), conversions: round2(r.conversions) }));
  return { rows, currency: currencyFrom(m.spend !== undefined ? header[m.spend] : undefined), periodStart: start, periodEnd: end, skippedRows: skipped, ignoredCells: ignored };
}

function isoDate(s: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PerfMetrics {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
}

export function metricsOf(r: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }): PerfMetrics {
  return {
    ctr: r.impressions > 0 ? r.clicks / r.impressions : null,
    cpc: r.clicks > 0 ? r.spend / r.clicks : null,
    cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : null,
    cpa: r.conversions > 0 ? r.spend / r.conversions : null,
    roas: r.spend > 0 && r.revenue > 0 ? r.revenue / r.spend : null,
  };
}

export type RankBy = "roas" | "cpa" | "ctr";

/** ROAS when conversion values exist, else cost per result, else CTR. */
export function rankBasis(rows: { revenue: number; conversions: number }[]): RankBy {
  if (rows.some((r) => r.revenue > 0)) return "roas";
  if (rows.some((r) => r.conversions > 0)) return "cpa";
  return "ctr";
}

/** Best and worst five ads with meaningful delivery (spend and at least 100 impressions). */
export function bestAndWorst<T extends { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>(rows: T[], n = 5) {
  const basis = rankBasis(rows);
  const eligible = rows.filter((r) => r.spend > 0 && r.impressions >= 100);
  const value = (r: T) => {
    const m = metricsOf(r);
    return basis === "roas" ? (m.roas ?? 0) : basis === "cpa" ? (m.cpa === null ? -Infinity : -m.cpa) : (m.ctr ?? 0);
  };
  const sorted = [...eligible].sort((a, b) => value(b) - value(a));
  // With few ads the two lists split the ranking instead of repeating the same ads.
  const best = sorted.slice(0, Math.min(n, Math.ceil(sorted.length / 2)));
  const worst = sorted
    .slice(best.length)
    .reverse()
    .slice(0, n);
  return { basis, best, worst };
}

export function totals(rows: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }[]) {
  const t = rows.reduce((a, r) => ({ spend: a.spend + r.spend, impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks, conversions: a.conversions + r.conversions, revenue: a.revenue + r.revenue }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
  return { ...t, spend: round2(t.spend), revenue: round2(t.revenue), ...metricsOf(t) };
}

/** Matches an ad's own text to an AdScope analysis (same headline or primary text, folded). */
export function matchAnalysis(text: { title: string; body: string; adName: string }, analyses: { id: string; headline: string; primaryText: string }[]): string | null {
  const body = norm(text.body);
  const title = norm(text.title);
  const name = norm(text.adName);
  for (const a of analyses) {
    const ah = norm(a.headline);
    const ap = norm(a.primaryText);
    if (body && ap && (body === ap || (ap.length >= 30 && body.includes(ap)) || (body.length >= 30 && ap.includes(body)))) return a.id;
    if (title && ah && title === ah && ah.length >= 8) return a.id;
    if (name && ah && name === ah && ah.length >= 8) return a.id;
  }
  return null;
}

export type RiskLevel = "low" | "medium" | "high";

/** Average CTR and ROAS per rejection-risk level of the matched analyses. */
export function riskVsPerformance(rows: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; riskLevel: RiskLevel | null }[]) {
  return (["low", "medium", "high"] as const).map((level) => {
    const group = rows.filter((r) => r.riskLevel === level);
    const t = totals(group);
    return { level, ads: group.length, ctr: t.ctr, roas: t.roas, cpa: t.cpa, spend: t.spend };
  });
}
