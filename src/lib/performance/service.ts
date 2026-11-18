import "server-only";
import type { DataRepo } from "@/lib/data/types";
import { parseReport } from "./parse";
import { aggregate, guessMapping, matchAnalysis, missingRequired, PERF_FIELDS, type Mapping, type PerfField } from "./report";

export interface Inspection {
  headers: string[];
  mapping: Mapping;
  missing: PerfField[];
  sample: string[][];
  dataRows: number;
  truncated: boolean;
}

export function inspectReport(name: string, bytes: Uint8Array): { ok: true; inspection: Inspection } | { ok: false; error: string } {
  const parsed = parseReport(name, bytes);
  if (!parsed.ok) return parsed;
  const [header, ...rows] = parsed.grid;
  const headers = header.map((h) => h.trim().slice(0, 120));
  const mapping = guessMapping(headers);
  return { ok: true, inspection: { headers, mapping, missing: missingRequired(mapping), sample: rows.slice(0, 3).map((r) => headers.map((_, i) => (r[i] ?? "").slice(0, 60))), dataRows: rows.length, truncated: parsed.truncated } };
}

/** Validates a user-chosen mapping against the header count. */
export function cleanMapping(raw: Record<string, unknown>, headerCount: number): Mapping {
  const out: Mapping = {};
  const used = new Set<number>();
  for (const f of PERF_FIELDS) {
    const v = raw[f];
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,3}$/.test(v) ? Number(v) : -1;
    if (n >= 0 && n < headerCount && !used.has(n)) {
      out[f] = n;
      used.add(n);
    }
  }
  return out;
}

export async function importReport(
  repo: DataRepo,
  p: { name: string; bytes: Uint8Array; mapping: Record<string, unknown>; label: string; shareConsent: boolean },
): Promise<{ ok: true; id: string; skippedRows: number; ignoredCells: number; matched: number } | { ok: false; error: string }> {
  const parsed = parseReport(p.name, p.bytes);
  if (!parsed.ok) return parsed;
  const mapping = cleanMapping(p.mapping, parsed.grid[0].length);
  const missing = missingRequired(mapping);
  if (missing.length) return { ok: false, error: "Reklam adı, harcanan tutar ve gösterim sütunlarını eşleştirmen gerekiyor." };
  const agg = aggregate(parsed.grid, mapping);
  if (!agg.rows.length) return { ok: false, error: "Dosyada reklam satırı bulunamadı." };
  const analyses = (await repo.listAnalyses(500)).filter((a) => a.status === "completed" && a.ownedByMe);
  let matched = 0;
  const rows = agg.rows.map((r) => {
    const analysisId = matchAnalysis({ ...r.text, adName: r.adName }, analyses);
    if (analysisId) matched++;
    // The ad's own text was only needed for matching; it is not stored.
    return { adName: r.adName, analysisId, spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, revenue: r.revenue };
  });
  const saved = await repo.savePerformanceImport({ label: p.label, currency: agg.currency, periodStart: agg.periodStart, periodEnd: agg.periodEnd, shareConsent: p.shareConsent, rows });
  if (saved === "limit") return { ok: false, error: "En fazla 50 rapor saklanabilir. Eski bir raporu silip tekrar dene." };
  if (saved === "error") return { ok: false, error: "Rapor kaydedilemedi. Lütfen tekrar dene." };
  return { ok: true, id: saved.id, skippedRows: agg.skippedRows, ignoredCells: agg.ignoredCells, matched };
}
