import { strFromU8, unzipSync } from "fflate";

/**
 * Reads an Ads Manager export (CSV or XLSX) into a grid of strings. The file is untrusted:
 * size and row limits apply, formulas are never evaluated (a formula cell is returned as its
 * formula text, starting with "="), and nothing is executed or fetched.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20_000;
export const MAX_COLS = 120;
const MAX_CELL = 2000;

export type Grid = string[][];
export type ParseResult = { ok: true; grid: Grid; truncated: boolean } | { ok: false; error: string };

const cell = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, MAX_CELL);

export function detectKind(name: string, bytes: Uint8Array): "csv" | "xlsx" | null {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return /\.xlsx$/i.test(name) || !/\.csv$/i.test(name) ? "xlsx" : null;
  if (/\.(csv|txt)$/i.test(name)) return "csv";
  return null;
}

export function parseReport(name: string, bytes: Uint8Array): ParseResult {
  if (bytes.byteLength === 0) return { ok: false, error: "Dosya boş." };
  if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: "Dosya en fazla 5 MB olabilir." };
  const kind = detectKind(name, bytes);
  if (!kind) return { ok: false, error: "Yalnızca CSV ya da XLSX dosyası yükleyebilirsin." };
  try {
    return kind === "csv" ? parseCsv(decodeText(bytes)) : parseXlsx(bytes);
  } catch {
    return { ok: false, error: "Dosya okunamadı. Reklam Yöneticisi'nden CSV ya da XLSX olarak yeniden dışa aktarmayı dene." };
  }
}

function decodeText(bytes: Uint8Array): string {
  // UTF-16 LE (Excel "Unicode text") or UTF-8 with or without BOM.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(text: string): ParseResult {
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/));
  const delim = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const rows: Grid = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let truncated = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') (field += '"'), i++;
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      if (row.length < MAX_COLS) row.push(cell(field));
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.length < MAX_COLS) row.push(cell(field));
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
      if (rows.length > MAX_ROWS) {
        truncated = true;
        break;
      }
    } else field += c;
  }
  if (!truncated && (field || row.length)) {
    row.push(cell(field));
    if (row.some((x) => x.trim())) rows.push(row);
  }
  if (rows.length < 2) return { ok: false, error: "Dosyada başlık satırı ve en az bir veri satırı olmalı." };
  return { ok: true, grid: rows.slice(0, MAX_ROWS + 1), truncated };
}

const XML_ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unxml(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return XML_ENT[e.toLowerCase()] ?? "";
  });
}

function colIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseXlsx(bytes: Uint8Array): ParseResult {
  let total = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      const wanted = f.name === "xl/sharedStrings.xml" || f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name);
      if (!wanted) return false;
      // Zip bomb guard: refuse oversized entries before inflating them.
      total += f.originalSize;
      if (f.originalSize > 60 * 1024 * 1024 || total > 120 * 1024 * 1024) throw new Error("too_large");
      return true;
    },
  });
  const shared: string[] = [];
  const ss = files["xl/sharedStrings.xml"];
  if (ss) {
    for (const m of strFromU8(ss).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  }
  // First sheet in workbook order.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = files["xl/workbook.xml"] && strFromU8(files["xl/workbook.xml"]);
  const rels = files["xl/_rels/workbook.xml.rels"] && strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const firstRid = wb ? /<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1] : undefined;
  if (firstRid && rels) {
    const target = new RegExp(`<Relationship\\b[^>]*Id="${firstRid.replace(/[^\w]/g, "")}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstRid.replace(/[^\w]/g, "")}"`).exec(rels)?.[1];
    if (target && /^(\/?xl\/)?worksheets\/sheet\d+\.xml$/.test(target)) sheetPath = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
  }
  const sheet = files[sheetPath];
  if (!sheet) return { ok: false, error: "Çalışma sayfası bulunamadı." };
  const xml = strFromU8(sheet);
  const rows: Grid = [];
  let truncated = false;
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const out: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? "";
      const idx = colIndex(/\br="([A-Z]+)\d*"/.exec(attrs)?.[1] ?? String.fromCharCode(65 + Math.min(25, out.length)));
      if (idx >= MAX_COLS) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(body)?.[1];
      let value: string;
      if (formula !== undefined) value = `=${unxml(formula)}`; // never evaluated, never trusted as a number
      else if (type === "s") value = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1])] ?? "";
      else if (type === "inlineStr") value = unxml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
      else value = unxml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      while (out.length < idx) out.push("");
      out[idx] = cell(value);
    }
    if (out.some((x) => x.trim())) rows.push(out);
    if (rows.length > MAX_ROWS) {
      truncated = true;
      break;
    }
  }
  if (rows.length < 2) return { ok: false, error: "Dosyada başlık satırı ve en az bir veri satırı olmalı." };
  return { ok: true, grid: rows.slice(0, MAX_ROWS + 1), truncated };
}
