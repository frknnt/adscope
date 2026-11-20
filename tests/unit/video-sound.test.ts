import { describe, expect, it, vi } from "vitest";
import { duckEnvelope, MUSIC_LEVEL, MUSIC_TRACKS, MUSIC_UNDER_VOICE, musicNotes, voiceoverSubtitles, voiceSchedule } from "@/lib/video-maker/audio";
import { MAX_CUES, parseSrt } from "@/lib/video-maker/subtitles";
import { AI_NOTICE_TEXT, buildTimeline, layersAt, SAFE_BOTTOM, SAFE_TOP, type VideoSpec } from "@/lib/video-maker/timeline";

vi.mock("server-only", () => ({}));

const base: VideoSpec = { imageCount: 2, durationSec: 6, brand: "Vita Plus", offer: "Yeni sezon setleri sitede", captions: ["Görsel altyazısı", ""], cta: "Hemen incele", transition: "gecis" };

describe("SRT subtitles", () => {
  it("reads SubRip with BOM, CRLF, tags and dotted times; skips broken cues", () => {
    const srt = "﻿1\r\n00:00:00,000 --> 00:00:02,500\r\n<i>Merhaba</i>\r\nyeni sezon\r\n\r\n2\r\n00:00:03.2 --> 00:00:02,000\r\nGeri giden\r\n\r\n3\r\n00:00:04,000 --> 00:00:05,900\r\n{\\an8}Ayrıntılar sayfada\r\n\r\nbozuk blok\r\n";
    expect(parseSrt(srt)).toEqual([
      { start: 0, end: 2.5, text: "Merhaba yeni sezon" },
      { start: 4, end: 5.9, text: "Ayrıntılar sayfada" },
    ]);
    expect(parseSrt("")).toEqual([]);
    const many = Array.from({ length: 250 }, (_, i) => `${i + 1}\n00:00:${String(i % 60).padStart(2, "0")},000 --> 00:00:${String(i % 60).padStart(2, "0")},500\nsatır ${i}`).join("\n\n");
    expect(parseSrt(many)).toHaveLength(MAX_CUES);
  });

  it("builds the script voice-over subtitles from the same SRT the script tab downloads", () => {
    const cues = voiceoverSubtitles([
      { start: 0, end: 3, text: "Bitki çayı ile tanış." },
      { start: 7, end: 12, text: "Ayrıntılar sayfada." },
    ]);
    expect(cues).toEqual([
      { start: 0, end: 3, text: "Bitki çayı ile tanış." },
      { start: 7, end: 12, text: "Ayrıntılar sayfada." },
    ]);
  });
});

describe("timeline with sound", () => {
  it("burns subtitles inside the 9:16 safe area instead of the image captions", () => {
    const tl = buildTimeline({ ...base, voice: "upload", subtitles: [{ start: 0.5, end: 2.5, text: "Merhaba" }, { start: 5, end: 9, text: "Sona taşan satır" }] });
    expect(tl.layers.some((l) => l.role === "caption")).toBe(false);
    const subs = tl.layers.filter((l) => l.role === "subtitle");
    expect(subs.map((s) => [s.start, s.end])).toEqual([[0.5, 2.5], [5, 6]]);
    for (const l of tl.layers) {
      expect(l.box.y).toBeGreaterThanOrEqual(SAFE_TOP);
      expect(l.box.y + l.box.h).toBeLessThanOrEqual(SAFE_BOTTOM);
    }
    expect(layersAt(tl, 1).some((x) => x.layer.text === "Merhaba")).toBe(true);
  });

  it("adds the AI notice to the last seconds, apart from the brand and the subtitles", () => {
    const tl = buildTimeline({ ...base, aiNotice: true, voice: "upload", subtitles: [{ start: 4, end: 6, text: "Son satır" }] });
    const notice = tl.layers.find((l) => l.role === "aiNotice")!;
    expect(notice.text).toBe(AI_NOTICE_TEXT);
    expect(notice.end).toBe(6);
    expect(notice.start).toBe(3);
    expect(layersAt(tl, 5.99).some((x) => x.layer.role === "aiNotice")).toBe(true);
    const overlaps = (a: { y: number; h: number }, b: { y: number; h: number }) => a.y < b.y + b.h && b.y < a.y + a.h;
    for (const other of tl.layers.filter((l) => l.role !== "aiNotice" && l.end > notice.start)) expect(overlaps(notice.box, other.box), other.role).toBe(false);
    expect(buildTimeline(base).layers.some((l) => l.role === "aiNotice")).toBe(false);
  });

  it("a script voice-over sets the length up to 45 s and always carries the AI notice", () => {
    const tl = buildTimeline({ ...base, durationSec: 30, voice: "script", aiNotice: false });
    expect(tl.duration).toBe(30);
    expect(tl.layers.some((l) => l.role === "aiNotice")).toBe(true);
    expect(buildTimeline({ ...base, durationSec: 30 }).duration).toBe(15);
    expect(buildTimeline({ ...base, durationSec: 90, voice: "script" }).duration).toBe(45);
  });
});

describe("voice-over timing and music", () => {
  it("starts each line at its scene and cuts it at the end of the video", () => {
    expect(voiceSchedule([{ start: 0, seconds: 2.5 }, { start: 3, seconds: 4 }, { start: 14, seconds: 3 }, { start: 15, seconds: 1 }], 15)).toEqual([
      { file: 0, at: 0, length: 2.5 },
      { file: 1, at: 3, length: 4 },
      { file: 2, at: 14, length: 1 },
    ]);
  });

  it("lowers the music under the voice and fades it out at the end", () => {
    const env = duckEnvelope([{ at: 2, length: 2 }, { at: 4.2, length: 1 }], 10);
    const at = (t: number) => {
      const i = env.findIndex((p) => p.t >= t);
      const a = env[Math.max(0, i - 1)];
      const b = env[i] ?? env.at(-1)!;
      return b.t === a.t ? b.gain : a.gain + ((b.gain - a.gain) * (t - a.t)) / (b.t - a.t);
    };
    expect(at(1)).toBeCloseTo(MUSIC_LEVEL);
    expect(at(3)).toBeCloseTo(MUSIC_UNDER_VOICE);
    expect(at(4.1)).toBeCloseTo(MUSIC_UNDER_VOICE);
    expect(at(7)).toBeCloseTo(MUSIC_LEVEL);
    expect(env.at(-1)).toEqual({ t: 10, gain: 0 });
    for (let i = 1; i < env.length; i++) expect(env[i].t).toBeGreaterThanOrEqual(env[i - 1].t);
    expect(duckEnvelope([{ at: 0, length: 1 }], 6)[0]).toEqual({ t: 0, gain: MUSIC_UNDER_VOICE });
  });

  it("writes every music track within the video length", () => {
    for (const m of MUSIC_TRACKS) {
      const notes = musicNotes(m.id, 6);
      expect(notes.length).toBeGreaterThan(10);
      for (const n of notes) {
        expect(n.t).toBeGreaterThanOrEqual(0);
        expect(n.t + n.dur).toBeLessThanOrEqual(6.0001);
        expect(n.freq).toBeGreaterThan(50);
        expect(n.freq).toBeLessThan(2500);
      }
    }
  });
});

describe("generated video review with sound", () => {
  it("checks subtitles against the rule cards, not the fixed AI notice, and notes the subtitles", async () => {
    const { reviewGeneratedVideo } = await import("@/lib/video-maker/review");
    const { RULE_CATALOG } = await import("@/lib/rules/catalog");
    const rules = RULE_CATALOG.filter((r) => r.status === "active" || r.status === "requires_review").map((r) => ({ ...r, versionId: `t-${r.id}` }));
    const repo = { getRules: async () => rules } as never;
    const spec = { ...base, voice: "upload" as const, aiNotice: true, subtitles: [{ start: 0, end: 3, text: "Garantili sonuç, kesin zayıflatır" }] };
    const r = await reviewGeneratedVideo(repo, { spec, mime: "video/webm", sizeBytes: 1000, sector: "takviye_gida", platform: "meta", sound: { firstSoundSec: 0, silentRatio: 0.3 } });
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.hookNote).toContain("altyazı videoya yakılı");
    const silent = await reviewGeneratedVideo(repo, { spec: base, mime: "video/webm", sizeBytes: 1000, sector: "genel", platform: "meta" });
    expect(silent.hookNote).toContain("Ses yok");
  });
});
