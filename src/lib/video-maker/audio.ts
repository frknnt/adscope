/**
 * Sound of the browser video maker (P11.2): when each voice-over line starts, how loud the music is
 * under the voice, and three short background tracks. The tracks are not recordings: they are
 * written here as chord progressions and synthesised in the browser with the Web Audio API, so there
 * is no third-party audio and no licence to clear (see docs/SOURCES.md). Pure data except
 * `playMusic`, which only schedules oscillators on a given AudioContext.
 */
import { toSrt } from "@/lib/script/srt";
import { parseSrt } from "./subtitles";
import type { SubtitleCue } from "./timeline";

export interface VoiceClip {
  /** Index of the audio file (in the voice-over's file list). */
  file: number;
  /** Second of the video the line starts at (the scene's start in the script). */
  at: number;
  /** Seconds to play: the line's length, cut at the end of the video. */
  length: number;
}

/** Voice-over lines start at their scene's start time; anything past the end of the video is cut. */
export function voiceSchedule(scenes: { start: number; seconds: number }[], duration: number): VoiceClip[] {
  return scenes
    .map((s, file) => ({ file, at: Math.max(0, s.start), length: Math.max(0, Math.min(s.seconds, duration - Math.max(0, s.start))) }))
    .filter((c) => c.at < duration && c.length > 0.05);
}

/** Subtitles of a script voice-over: the same SRT the script tab downloads, read back as cues. */
export function voiceoverSubtitles(scenes: { start: number; end: number; text: string }[]): SubtitleCue[] {
  return parseSrt(toSrt(scenes.map((s) => ({ start: s.start, end: s.end, voiceover: s.text, onScreen: "" }))));
}

export const MUSIC_LEVEL = 0.32;
export const MUSIC_UNDER_VOICE = 0.1;

/**
 * Music gain over time: full level without a voice, lowered while a line is spoken (with a short
 * ramp either side), faded out over the last second.
 */
export function duckEnvelope(clips: { at: number; length: number }[], duration: number, level = MUSIC_LEVEL, under = MUSIC_UNDER_VOICE): { t: number; gain: number }[] {
  const ramp = 0.25;
  const merged: { from: number; to: number }[] = [];
  for (const c of [...clips].sort((a, b) => a.at - b.at)) {
    const from = Math.max(0, c.at - ramp);
    const to = Math.min(duration, c.at + c.length + ramp);
    const last = merged.at(-1);
    if (last && from <= last.to) last.to = Math.max(last.to, to);
    else merged.push({ from, to });
  }
  const pts: { t: number; gain: number }[] = [{ t: 0, gain: merged[0]?.from === 0 ? under : level }];
  for (const m of merged) {
    if (m.from > 0) pts.push({ t: m.from, gain: level }, { t: Math.min(m.to, m.from + ramp), gain: under });
    pts.push({ t: Math.max(m.from, m.to - ramp), gain: under }, { t: m.to, gain: level });
  }
  const fade = Math.max(0, duration - 1);
  const atFade = pts.filter((p) => p.t <= fade).at(-1)?.gain ?? level;
  return [...pts.filter((p) => p.t < fade), { t: fade, gain: atFade }, { t: duration, gain: 0 }];
}

export const MUSIC_TRACKS = [
  { id: "sakin", label: "Sakin", bpm: 72, chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]], wave: "sine" as OscillatorType, arp: 1 },
  { id: "enerjik", label: "Enerjik", bpm: 112, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]], wave: "triangle" as OscillatorType, arp: 2 },
  { id: "sicak", label: "Sıcak", bpm: 90, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], wave: "triangle" as OscillatorType, arp: 1 },
] as const;
export type MusicId = (typeof MUSIC_TRACKS)[number]["id"];

export interface MusicNote {
  t: number;
  dur: number;
  freq: number;
  gain: number;
  wave: OscillatorType;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** The notes of a track for the given length: one chord per bar (4 beats), bass and arpeggio. */
export function musicNotes(id: MusicId, duration: number): MusicNote[] {
  const track = MUSIC_TRACKS.find((m) => m.id === id);
  if (!track) return [];
  const beat = 60 / track.bpm;
  const bar = beat * 4;
  const notes: MusicNote[] = [];
  for (let b = 0; b * bar < duration; b++) {
    const chord = track.chords[b % track.chords.length];
    const t0 = b * bar;
    const barLen = Math.min(bar, duration - t0);
    // Soft pad: the upper three notes held for the bar.
    for (const m of chord.slice(1)) notes.push({ t: t0, dur: barLen, freq: hz(m + 12), gain: 0.05, wave: "sine" });
    // Bass on beats 1 and 3.
    for (const k of [0, 2]) if (t0 + k * beat < duration) notes.push({ t: t0 + k * beat, dur: Math.min(beat * 1.8, duration - t0 - k * beat), freq: hz(chord[0]), gain: 0.16, wave: "sine" });
    // Arpeggio: one or two notes per beat, walking up the chord.
    const step = beat / track.arp;
    for (let i = 0; t0 + i * step < Math.min(duration, t0 + bar) - 0.01; i++) {
      notes.push({ t: t0 + i * step, dur: Math.min(step * 0.9, duration - t0 - i * step), freq: hz(chord[i % chord.length] + 24), gain: 0.07, wave: track.wave });
    }
  }
  return notes.filter((n) => n.dur > 0.02);
}

/** Schedules the track on `ctx` from `startAt`, into `dest`. Returns the nodes so the caller can stop them. */
export function playMusic(ctx: BaseAudioContext, id: MusicId, duration: number, startAt: number, dest: AudioNode): OscillatorNode[] {
  const oscs: OscillatorNode[] = [];
  for (const n of musicNotes(id, duration)) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = n.wave;
    osc.frequency.value = n.freq;
    const t = startAt + n.t;
    const attack = Math.min(0.04, n.dur / 4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(n.gain, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, n.dur * 0.6), n.dur * 0.2 + 0.01);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + n.dur + 0.1);
    oscs.push(osc);
  }
  return oscs;
}
