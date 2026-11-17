/**
 * Timeline of a short vertical video made from still images: when each slide and each text layer
 * is on screen and where the text boxes sit. Pure data, shared by the browser renderer and tests.
 * Rules: brand and offer are visible within the first 3 seconds; every text box stays inside the
 * 9:16 safe area (top 250 px and bottom 340 px are covered by the app interface).
 */
import { STORY_UNSAFE } from "@/lib/creative/sizes";

export const VIDEO_W = 1080;
export const VIDEO_H = 1920;
export const VIDEO_FPS = 30;
export const MIN_SECONDS = 6;
export const MAX_SECONDS = 15;
export const MAX_IMAGES = 5;
export const SAFE_TOP = STORY_UNSAFE.top;
export const SAFE_BOTTOM = VIDEO_H - STORY_UNSAFE.bottom;

export const TRANSITIONS = [
  { id: "yakinlas", label: "Yavaş yakınlaşma" },
  { id: "gecis", label: "Yumuşak geçiş" },
  { id: "kaydir", label: "Kaydırma" },
] as const;
export type Transition = (typeof TRANSITIONS)[number]["id"];

export interface VideoSpec {
  imageCount: number;
  durationSec: number;
  brand: string;
  offer: string;
  captions: string[];
  cta: string;
  transition: Transition;
}

export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Font size range in pixels; the renderer picks the largest that fits `maxLines`. */
  maxSize: number;
  minSize: number;
  maxLines: number;
  align: "center" | "left";
}

export type LayerRole = "brand" | "offer" | "caption" | "cta" | "endBrand";

export interface TextLayer {
  role: LayerRole;
  text: string;
  start: number;
  end: number;
  box: TextBox;
}

export interface Slide {
  index: number;
  start: number;
  end: number;
}

export interface Timeline {
  duration: number;
  slides: Slide[];
  layers: TextLayer[];
  /** Seconds of the closing card (call to action), 0 when there is none. */
  endCard: number;
  transition: Transition;
}

const SIDE = 80;
const BOX = {
  brand: { x: SIDE, y: SAFE_TOP + 20, w: VIDEO_W - 2 * SIDE, h: 90, maxSize: 46, minSize: 32, maxLines: 1, align: "center" },
  offer: { x: SIDE, y: 560, w: VIDEO_W - 2 * SIDE, h: 420, maxSize: 104, minSize: 60, maxLines: 4, align: "center" },
  caption: { x: SIDE, y: SAFE_BOTTOM - 40 - 300, w: VIDEO_W - 2 * SIDE, h: 300, maxSize: 64, minSize: 42, maxLines: 4, align: "center" },
  cta: { x: SIDE, y: 820, w: VIDEO_W - 2 * SIDE, h: 280, maxSize: 96, minSize: 56, maxLines: 3, align: "center" },
  endBrand: { x: SIDE, y: 1160, w: VIDEO_W - 2 * SIDE, h: 120, maxSize: 56, minSize: 36, maxLines: 2, align: "center" },
} satisfies Record<LayerRole, TextBox>;

export const clean = (s: string, max: number) => [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("");

export function buildTimeline(spec: VideoSpec): Timeline {
  const duration = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(spec.durationSec)));
  const images = Math.min(MAX_IMAGES, Math.max(1, spec.imageCount));
  const brand = clean(spec.brand, 40);
  const offer = clean(spec.offer, 90);
  const cta = clean(spec.cta, 30);
  const endCard = cta ? 2.5 : 0;
  const body = duration - endCard;
  const per = body / images;
  const slides: Slide[] = Array.from({ length: images }, (_, i) => ({ index: i, start: round(i * per), end: round(i === images - 1 ? body : (i + 1) * per) }));
  const layers: TextLayer[] = [];
  // Brand stays on screen during the slides; the offer opens the video and stays at least 3 seconds.
  if (brand) layers.push({ role: "brand", text: brand, start: 0, end: body, box: BOX.brand });
  if (offer) layers.push({ role: "offer", text: offer, start: 0, end: round(Math.min(body, Math.max(3.2, slides[0].end))), box: BOX.offer });
  slides.forEach((s, i) => {
    const text = clean(spec.captions[i] ?? "", 90);
    if (text) layers.push({ role: "caption", text, start: s.start, end: s.end, box: BOX.caption });
  });
  if (cta) {
    layers.push({ role: "cta", text: cta, start: body, end: duration, box: BOX.cta });
    if (brand) layers.push({ role: "endBrand", text: brand, start: body, end: duration, box: BOX.endBrand });
  }
  return { duration, slides, layers, endCard, transition: spec.transition };
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Layers on screen at time t, with a 0–1 opacity for short fades. */
export function layersAt(tl: Timeline, t: number): { layer: TextLayer; alpha: number }[] {
  const fade = 0.25;
  return tl.layers
    .filter((l) => t >= l.start && t < l.end)
    .map((l) => {
      const fadeIn = l.start === 0 ? 1 : (t - l.start) / fade;
      const fadeOut = l.end >= tl.duration ? 1 : (l.end - t) / fade;
      return { layer: l, alpha: Math.max(0, Math.min(1, fadeIn, fadeOut)) };
    });
}

/** Slide on screen at time t (and the next one during a transition), with transition progress. */
export function slideAt(tl: Timeline, t: number): { current: Slide; next: Slide | null; progress: number; mix: number } | null {
  const s = tl.slides.find((x) => t >= x.start && t < x.end);
  if (!s) return null;
  const next = tl.slides[s.index + 1] ?? null;
  const span = s.end - s.start;
  const tr = Math.min(0.5, span / 4);
  const mix = next && t > s.end - tr ? (t - (s.end - tr)) / tr : 0;
  return { current: s, next, progress: (t - s.start) / span, mix };
}

/** What a viewer sees in the first 3 seconds (used for the hook note). */
export function openingTexts(tl: Timeline): { brand: boolean; offer: boolean; texts: string[] } {
  const early = tl.layers.filter((l) => l.start < 3);
  return { brand: early.some((l) => l.role === "brand"), offer: early.some((l) => l.role === "offer"), texts: early.map((l) => l.text) };
}
