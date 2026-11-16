/** Turkish-aware text helpers. `fold` keeps a 1:1 character mapping so match offsets map back to the original. */

const FOLD_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
  "’": "'",
  "‘": "'",
  "`": "'",
};

export function fold(input: string): string {
  let out = "";
  // Iterate UTF-16 code units so the folded string has exactly the same length/offsets.
  for (let i = 0; i < input.length; i++) {
    const unit = input[i];
    let lower = unit.toLocaleLowerCase("tr-TR");
    if (lower.length !== 1) lower = lower.charAt(0);
    out += FOLD_MAP[lower] ?? lower;
  }
  return out;
}

export interface TextMatch {
  index: number;
  length: number;
  text: string;
}

/** Runs a folded-form regex against original text and returns matches with original-text slices. */
export function findMatches(original: string, pattern: string, limit = 5): TextMatch[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern, "gi");
  } catch {
    return [];
  }
  const folded = fold(original);
  const out: TextMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(folded)) !== null && out.length < limit) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    out.push({ index: m.index, length: m[0].length, text: original.slice(m.index, m.index + m[0].length) });
  }
  return out;
}

/** Replace folded-pattern matches inside the original text (right to left so offsets stay valid). */
export function replaceFolded(original: string, pattern: string, replacement: string): string {
  const matches = findMatches(original, pattern, 50);
  let result = original;
  for (const m of [...matches].reverse()) {
    result = result.slice(0, m.index) + replacement + result.slice(m.index + m.length);
  }
  return result;
}

export function tidy(text: string): string {
  return text
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([!?.]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:!-]+/, "")
    .replace(/\s+$/, "")
    .replace(/(^|[.!?]\s+)([a-zçğıöşü])/g, (_, p, c: string) => p + c.toLocaleUpperCase("tr-TR"));
}

export function sentenceCase(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1);
}

export function truncateWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, "") + "…";
}
