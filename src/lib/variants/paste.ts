/**
 * "Platformun ürettiği varyantları yapıştır" (P9.3): ad texts written by a platform's own AI tools,
 * pasted one per line. Pure helpers shared by the panel, the public page and the tests.
 */

export const PASTE_MAX = { panel: 20, public: 5 } as const;
export const VARIANT_MAX_CHARS = 600;
export const VARIANT_MIN_CHARS = 3;

/** Line prefixes that copy-paste brings along: bullets, "1." / "2)" numbering, "Başlık 1:" labels. */
const PREFIX = /^\s*(?:[-*•·–—>]+|\(?\d{1,2}[.)\]:-]|(?:başlık|baslik|metin|açıklama|aciklama|headline|text|description|varyant)\s*\d{0,2}\s*[:.-])\s*/i;

/** Splits pasted text into variants: one per line, prefixes and wrapping quotes removed, exact repeats dropped. */
export function parseVariantLines(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of String(raw ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    let t = line.replace(/\s+/g, " ").trim();
    for (let i = 0; i < 2; i++) t = t.replace(PREFIX, "").trim();
    t = t.replace(/^["“”'‘’](.*)["“”'‘’]$/, "$1").trim();
    if ([...t].length < VARIANT_MIN_CHARS) continue;
    const key = t.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** A user-facing reason when the pasted list cannot be checked, otherwise null. */
export function pasteProblem(lines: string[], max: number): string | null {
  if (!lines.length) return "En az bir varyant yapıştır. Her satır bir varyant sayılır.";
  if (lines.length > max) return `Tek seferde en fazla ${max} varyant kontrol edilebilir; ${lines.length} satır bulundu.`;
  if (lines.some((l) => [...l].length > VARIANT_MAX_CHARS)) return `Her varyant en fazla ${VARIANT_MAX_CHARS} karakter olabilir.`;
  return null;
}

export interface VariantRow {
  n: number;
  text: string;
  platformScore: number;
  platformLevel: "low" | "medium" | "high";
  legalLevel: "low" | "medium" | "high";
  red: number;
  yellow: number;
  /** The most severe rule-based finding, if any. */
  top: { title: string; matched: string | null; ruleId: string | null; verified: boolean } | null;
  /** Rewritten text; equal to `text` when nothing needed changing. */
  safeText: string;
}

/** What "en güvenli 3'ü kopyala" copies: the three least risky variants, each in its safe version. */
export function safestVariants(rows: VariantRow[], count = 3): string[] {
  return [...rows]
    .sort((a, b) => a.red - b.red || a.yellow - b.yellow || a.platformScore - b.platformScore || a.n - b.n)
    .slice(0, count)
    .map((r) => (r.red || r.yellow ? r.safeText : r.text));
}
