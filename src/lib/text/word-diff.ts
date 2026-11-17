/** A run of text and whether it differs from the other side. */
export type DiffPart = { text: string; changed: boolean };

function tokens(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

function norm(t: string) {
  return t.toLocaleLowerCase("tr-TR").replace(/[.,!?;:…"“”'’()]/g, "");
}

function merge(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    // Whitespace between two changed words stays inside the highlight.
    if (last && (last.changed === p.changed || (!p.text.trim() && last.changed))) last.text += p.text;
    else out.push({ ...p });
  }
  // A trailing space captured into a highlight goes back to plain text.
  return out.flatMap((p) => {
    const m = p.changed ? p.text.match(/^([\s\S]*?)(\s+)$/) : null;
    return m ? [{ text: m[1], changed: true }, { text: m[2], changed: false }] : [p];
  });
}

/**
 * Word-level diff (longest common subsequence) for showing what the safe text changed.
 * Comparison ignores case and punctuation; long inputs fall back to "everything changed".
 */
export function wordDiff(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length * b.length > 400_000) return { before: [{ text: before, changed: true }], after: [{ text: after, changed: true }] };
  const na = a.map(norm);
  const nb = b.map(norm);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pa: DiffPart[] = [];
  const pb: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) {
      pa.push({ text: a[i++], changed: false });
      pb.push({ text: b[j++], changed: false });
    } else if (dp[i + 1][j] >= dp[i][j + 1]) pa.push({ text: a[i], changed: !!a[i++].trim() });
    else pb.push({ text: b[j], changed: !!b[j++].trim() });
  }
  while (i < a.length) pa.push({ text: a[i], changed: !!a[i++].trim() });
  while (j < b.length) pb.push({ text: b[j], changed: !!b[j++].trim() });
  return { before: merge(pa), after: merge(pb) };
}
