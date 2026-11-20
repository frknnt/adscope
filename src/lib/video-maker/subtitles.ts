/** Browser-safe SRT reading for burnt-in subtitles. The file is the user's own input: text only, no markup. */
import type { SubtitleCue } from "./timeline";

export const MAX_CUES = 200;
export const MAX_SRT_BYTES = 100 * 1024;

const TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function seconds(m: RegExpExecArray): number {
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

/**
 * Parses SubRip text into cues. Tags such as <i> or {\an8} are dropped, lines are joined with a
 * space, empty or reversed cues are skipped. Returns at most MAX_CUES cues, sorted by start.
 */
export function parseSrt(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const block of text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at].split("-->");
    const s = TIME.exec(a);
    const e = TIME.exec(b ?? "");
    if (!s || !e) continue;
    const start = seconds(s);
    const end = seconds(e);
    const body = lines
      .slice(at + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body || end <= start) continue;
    cues.push({ start, end, text: [...body].slice(0, 120).join("") });
    if (cues.length >= MAX_CUES) break;
  }
  return cues.sort((x, y) => x.start - y.start);
}
