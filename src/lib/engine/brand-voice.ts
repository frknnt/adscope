import { findMatches, fold, replaceFolded, tidy } from "./text";
import type { AdInput, EngineFinding } from "./types";

/** Escapes a user-supplied word for use inside the folded-text regex. */
function wordPattern(word: string) {
  const w = fold(word.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  // Folded text is ASCII for Turkish letters, so an ASCII word boundary is enough.
  return `(?<![a-z0-9])${w}(?![a-z0-9])`;
}

export function normalizeBannedWords(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[,\n;]/);
  const out: string[] = [];
  for (const x of list) {
    const w = x.trim().replace(/\s+/g, " ").slice(0, 40);
    if (w.length < 2) continue;
    if (!out.some((y) => fold(y) === fold(w))) out.push(w);
    if (out.length >= 50) break;
  }
  return out;
}

const FIELDS: { field: EngineFinding["field"]; get: (i: AdInput) => string }[] = [
  { field: "headline", get: (i) => i.headline },
  { field: "primary_text", get: (i) => i.primaryText },
  { field: "description", get: (i) => i.description },
  { field: "transcript", get: (i) => i.transcript ?? "" },
];

/**
 * Brand voice check (agency mode): words the brand never uses. These are brand rules, not
 * platform or legal rules, so they are reported as creative-quality findings.
 */
export function brandVoiceFindings(input: AdInput): EngineFinding[] {
  const words = input.brandVoice?.bannedWords ?? [];
  const out: EngineFinding[] = [];
  for (const w of words) {
    const pattern = wordPattern(w);
    for (const f of FIELDS) {
      const m = findMatches(f.get(input), pattern, 1)[0];
      if (!m) continue;
      out.push({
        ruleId: null,
        ruleVersionId: null,
        ruleStatus: null,
        domain: "creative_quality",
        severity: "yellow",
        field: f.field,
        matchedText: m.text,
        title: `Marka dilinde kullanılmayan kelime: “${w}”`,
        explanation: "Bu kelime markanın yasaklı kelime listesinde. Platform veya mevzuat kuralı değildir; marka tutarlılığı için işaretlendi.",
        suggestion: "Kelimeyi çıkarın veya marka dil rehberindeki karşılığıyla değiştirin.",
        origin: "heuristic",
      });
      break;
    }
  }
  return out;
}

/** True when the text carries the phrase (case, Turkish letters and spacing ignored; trailing punctuation optional). */
export function hasPhrase(text: string, phrase: string): boolean {
  const core = phrase.trim().replace(/[.!…]+$/, "");
  if (!core) return true;
  return findMatches(text, wordPattern(core), 1).length > 0;
}

/**
 * Mandatory brand phrases (brand kit): each must appear somewhere in the ad copy. A missing one is a
 * brand rule, not a platform or legal rule, so it is a creative-quality finding.
 */
export function requiredPhraseFindings(input: AdInput): EngineFinding[] {
  const phrases = input.brandVoice?.requiredPhrases ?? [];
  const all = FIELDS.map((f) => f.get(input)).join("\n");
  return phrases
    .filter((p) => !hasPhrase(all, p))
    .map((p) => ({
      ruleId: null,
      ruleVersionId: null,
      ruleStatus: null,
      domain: "creative_quality" as const,
      severity: "yellow" as const,
      field: "primary_text" as const,
      matchedText: null,
      title: `Markanın zorunlu ibaresi eksik: “${p}”`,
      explanation: "Bu ibare marka kitinde her reklamda bulunması gereken metin olarak kayıtlı. Platform veya mevzuat kuralı değildir; marka tutarlılığı için işaretlendi.",
      suggestion: "İbareyi ana metnin sonuna ya da açıklama alanına ekleyin. Güvenli metin önerisine eklendi.",
      origin: "heuristic" as const,
    }));
}

/** Appends the mandatory phrases a text does not already carry. */
export function appendRequiredPhrases(text: string, phrases: string[]): string {
  const missing = phrases.filter((p) => !hasPhrase(text, p));
  if (!missing.length) return text;
  const end = text.trim();
  const sep = !end ? "" : /[.!?…]$/.test(end) ? " " : ". ";
  return `${end}${sep}${missing.map((p) => (/[.!?…]$/.test(p) ? p : `${p}.`)).join(" ")}`;
}

/** Removes banned words from generated text (safe text, variants, DM templates). */
export function stripBannedWords(text: string, words: string[]): string {
  let out = text;
  for (const w of words) {
    if (findMatches(out, wordPattern(w), 1).length) out = replaceFolded(out, wordPattern(w), "");
  }
  return out === text ? text : tidy(out);
}
