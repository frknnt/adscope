import type { AnalysisDetail } from "@/lib/data/types";

/**
 * Spreadsheet-safe CSV. Cells that start with = + - @ (or a tab/CR) are prefixed with an
 * apostrophe so Excel / Sheets never evaluate ad text as a formula (CSV injection).
 */
export function csvCell(value: unknown, sep: string): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes('"') || s.includes(sep) || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: unknown[][], sep: ";" | "," = ";"): string {
  // BOM so Excel opens UTF-8 Turkish text correctly; CRLF per RFC 4180.
  return "﻿" + rows.map((r) => r.map((c) => csvCell(c, sep)).join(sep)).join("\r\n") + "\r\n";
}

export const VARIANT_CSV_HEADER = ["Sıra", "Tür", "Ton", "Başlık", "Ana metin", "Açıklama", "Kırmızı bayrak", "Sarı bayrak", "Not"];

export function variantRows(a: Pick<AnalysisDetail, "variants" | "scoreBreakdown">): unknown[][] {
  const sorted = [...a.variants].sort((x, y) => (x.kind === y.kind ? x.position - y.position : x.kind === "safe" ? -1 : 1));
  const rows: unknown[][] = sorted.map((v, i) => [
    i + 1,
    v.kind === "safe" ? "Güvenli metin" : "Varyant",
    v.tone,
    v.headline,
    v.primaryText,
    v.description,
    v.recheckRed,
    v.recheckYellow,
    "Risk değerlendirmesidir, hukuki görüş değildir.",
  ]);
  const dm = a.scoreBreakdown?.dm;
  if (dm) {
    const n = rows.length;
    rows.push([n + 1, "WhatsApp / DM", "İlk mesaj (müşteri)", "", dm.first_message, "", dm.recheck_red, dm.recheck_yellow, ""]);
    rows.push([n + 2, "WhatsApp / DM", "Otomatik karşılama", "", dm.auto_greeting, "", "", "", "Köşeli parantezli alanları doldurun."]);
    rows.push([n + 3, "WhatsApp / DM", "Mesai dışı yanıt", "", dm.away_message, "", "", "", ""]);
    rows.push([n + 4, "WhatsApp / DM", "Hazır sorular", "", dm.starter_questions.join(" | "), "", "", "", ""]);
  }
  return rows;
}
