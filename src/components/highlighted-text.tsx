type Mark = { text: string | null; severity: "red" | "yellow" | "info" };

const CLS = { red: "mark-risk", yellow: "mark-warn", info: "mark-info" } as const;

/** Wraps flagged phrases (case-insensitive, Turkish-aware) in highlighter marks. */
export function HighlightedText({ text, marks, animate = false }: { text: string; marks: Mark[]; animate?: boolean }) {
  const lower = text.toLocaleLowerCase("tr-TR");
  const ranges: { start: number; end: number; severity: Mark["severity"] }[] = [];
  for (const m of marks) {
    if (!m.text) continue;
    const needle = m.text.toLocaleLowerCase("tr-TR");
    const idx = lower.indexOf(needle);
    if (idx < 0) continue;
    const end = idx + needle.length;
    if (ranges.some((r) => idx < r.end && end > r.start)) continue;
    ranges.push({ start: idx, end, severity: m.severity });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(text.slice(cursor, r.start));
    out.push(
      <mark
        key={i}
        className={`${CLS[r.severity]} ${animate ? "draw-mark" : ""} text-inherit`}
        style={animate ? { animationDelay: `${300 + i * 220}ms` } : undefined}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
