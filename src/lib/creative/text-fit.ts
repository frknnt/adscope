import type { FontMetrics } from "./ttf";

/** Width measurement for one font weight, in pixels at a given font size. */
export interface Measurer {
  width(text: string, size: number): number;
  has(codePoint: number): boolean;
}

export function measurer(m: FontMetrics): Measurer {
  return {
    width(text, size) {
      let units = 0;
      for (const ch of text) units += m.advance(ch.codePointAt(0)!);
      return (units / m.unitsPerEm) * size;
    },
    has: (cp) => m.hasChar(cp),
  };
}

/**
 * Keeps only characters the font can draw, so rendering never falls back to a different font or a
 * network lookup. "₺" becomes "TL" when the font has no lira sign. Reports whether anything was dropped.
 */
export function cleanForFont(text: string, ms: Measurer[]): { text: string; dropped: boolean } {
  let dropped = false;
  let out = "";
  for (const ch of text.normalize("NFC").replace(/\s+/g, " ")) {
    const cp = ch.codePointAt(0)!;
    if (ch === " " || ms.every((m) => m.has(cp))) out += ch;
    else if (ch === "₺") out += "TL";
    else dropped = true;
  }
  return { text: out.replace(/ {2,}/g, " ").trim(), dropped };
}

/** Greedy word wrap, the same way the renderer breaks lines; words wider than a line are split. */
export function wrap(m: Measurer, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (m.width(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (m.width(line, size) > maxWidth && [...line].length > 1) {
      const chars = [...line];
      let cut = chars.length - 1;
      while (cut > 1 && m.width(chars.slice(0, cut).join(""), size) > maxWidth) cut--;
      lines.push(chars.slice(0, cut).join(""));
      line = chars.slice(cut).join("");
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FitOptions {
  maxSize: number;
  minSize: number;
  width: number;
  maxLines: number;
  maxHeight?: number;
  lineHeight: number;
}

export interface FitResult {
  size: number;
  lines: string[];
  /** True when the text did not fit even at the smallest size and was shortened with "…". */
  overflow: boolean;
  height: number;
}

/** Largest font size (from maxSize down to minSize) at which the text fits the box; shortens it otherwise. */
export function fitBlock(m: Measurer, text: string, o: FitOptions): FitResult {
  if (!text) return { size: o.maxSize, lines: [], overflow: false, height: 0 };
  const step = Math.max(1, (o.maxSize - o.minSize) / 24);
  const maxHeight = o.maxHeight ?? Infinity;
  for (let size = o.maxSize; size >= o.minSize - 0.001; size -= step) {
    const lines = wrap(m, text, size, o.width);
    const height = lines.length * size * o.lineHeight;
    if (lines.length <= o.maxLines && height <= maxHeight + 0.5) return { size, lines, overflow: false, height };
  }
  const size = o.minSize;
  const all = wrap(m, text, size, o.width);
  const room = Math.max(1, Math.min(o.maxLines, Math.floor((maxHeight + 0.5) / (size * o.lineHeight))));
  const lines = all.slice(0, room);
  let last = `${lines[lines.length - 1]}…`;
  while (m.width(last, size) > o.width && last.length > 1) {
    const words = last.slice(0, -1).split(" ");
    last = words.length > 1 ? `${words.slice(0, -1).join(" ")}…` : `${[...last].slice(0, -2).join("")}…`;
  }
  lines[lines.length - 1] = last;
  return { size, lines, overflow: true, height: lines.length * size * o.lineHeight };
}
