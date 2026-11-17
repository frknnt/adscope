/** Browser-safe SRT export; no rule engine imports. */
export type SrtScene = { start: number; end: number; voiceover: string; onScreen: string };

function srtTime(sec: number) {
  const ms = Math.round(sec * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/** SRT subtitles from the voice-over (or the on-screen text); empty scenes are skipped. */
export function toSrt(scenes: SrtScene[], source: "voiceover" | "onScreen" = "voiceover"): string {
  return scenes
    .map((s) => ({ s, text: (source === "voiceover" ? s.voiceover : s.onScreen).trim() }))
    .filter((x) => x.text)
    .map((x, i) => `${i + 1}\n${srtTime(x.s.start)} --> ${srtTime(x.s.end)}\n${x.text}\n`)
    .join("\n");
}
