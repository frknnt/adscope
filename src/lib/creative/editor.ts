/**
 * Layered editor (P10.1): the editor state is plain JSON (a list of layers per size). The same JSON
 * becomes a `Plan` here, and the server draws that plan with render.tsx, so the preview and the
 * downloaded PNG come from identical geometry. Pure module: used by the browser and the server.
 */
import { z } from "zod";
import { BRAND_FONT_IDS, textOn, type BrandFontId } from "@/lib/brand/kit";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { planWarnings, ROLE_LABEL, type Plan, type PlanElement, type PlanWarning, type TextRole } from "./layouts";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, STORY_UNSAFE, type CreativeSizeId } from "./sizes";
import { fitBlock, type Measurer } from "./text-fit";

export const LAYER_TYPES = ["image", "logo", "text", "badge", "cta", "shape"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];
export const TEXT_ROLES = ["headline", "body", "cta", "brand", "tagline", "note"] as const satisfies readonly TextRole[];

export const LAYER_TYPE_LABEL: Record<LayerType, string> = {
  image: "Ürün görseli",
  logo: "Logo",
  text: "Metin",
  badge: "Rozet",
  cta: "Çağrı düğmesi",
  shape: "Şekil",
};

export const EDITOR_LIMITS = { layers: 24, text: 400, assets: 3, assetChars: 2_800_000, templatesPerBrand: 30, templateName: 60 } as const;

const ID = /^[a-z0-9-]{1,24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex = z.string().regex(/^#[0-9a-f]{6}$/);
const coord = z.number().finite().min(-5000).max(5000);
const extent = z.number().finite().min(4).max(5000);
const DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

export const LayerSchema = z.object({
  id: z.string().regex(ID),
  type: z.enum(LAYER_TYPES),
  /** Which copy slot a text layer holds; new copy fills it when the layout is reused as a template. */
  role: z.enum(TEXT_ROLES).optional(),
  x: coord,
  y: coord,
  w: extent,
  h: extent,
  hidden: z.boolean().optional(),
  text: z.string().max(EDITOR_LIMITS.text).optional(),
  font: z.enum(BRAND_FONT_IDS).optional(),
  weight: z.union([z.literal(400), z.literal(800)]).optional(),
  size: z.number().finite().min(8).max(400).optional(),
  color: hex.optional(),
  align: z.enum(["left", "center"]).optional(),
  lineHeight: z.number().finite().min(0.8).max(2).optional(),
  underline: z.boolean().optional(),
  fill: hex.optional(),
  radius: z.number().finite().min(0).max(2500).optional(),
  shape: z.enum(["rect", "circle"]).optional(),
  asset: z.string().regex(ID).optional(),
  fit: z.enum(["contain", "cover"]).optional(),
});
export type EditorLayer = z.infer<typeof LayerSchema>;

export const FrameSchema = z.object({
  background: z.object({ color: hex, asset: z.string().regex(ID).nullable().optional() }),
  layers: z.array(LayerSchema).max(EDITOR_LIMITS.layers),
});
export type EditorFrame = z.infer<typeof FrameSchema>;

export const DocSchema = z
  .object({
    v: z.literal(1),
    brandId: z.string().regex(UUID).nullable(),
    platform: z.enum(PLATFORM_IDS),
    sector: z.enum(SECTOR_IDS),
    frames: z.object({ kare: FrameSchema, dikey: FrameSchema, hikaye: FrameSchema, yatay: FrameSchema }),
    /** Uploaded images (product photo, background) as data URLs, shared by every size. */
    assets: z.record(z.string().regex(ID), z.string().max(EDITOR_LIMITS.assetChars).regex(DATA_URL)).default({}),
  })
  .refine((d) => Object.keys(d.assets).length <= EDITOR_LIMITS.assets, { message: "too many images" })
  .refine((d) => CREATIVE_SIZE_IDS.every((s) => new Set(d.frames[s].layers.map((l) => l.id)).size === d.frames[s].layers.length), { message: "duplicate layer id" });
export type EditorDoc = z.infer<typeof DocSchema>;

export function parseDoc(raw: unknown): EditorDoc | null {
  const r = DocSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function layerLabel(l: EditorLayer): string {
  if ((l.type === "text" || l.type === "badge") && l.role) return ROLE_LABEL[l.role];
  return LAYER_TYPE_LABEL[l.type];
}

export interface DocEnv {
  /** Width measurement of a family and weight (the server's real font metrics). */
  measure(font: BrandFontId, weight: 400 | 800): Measurer;
  defaultFont: BrandFontId;
  hasLogo: boolean;
}

/** Inner padding of a pill (badge, call to action); matches the pills the eight layouts draw. */
export function pillPad(l: Pick<EditorLayer, "w" | "h">) {
  return Math.min(l.w * 0.12, l.h * 0.4);
}

/** Colour directly behind a point: the topmost filled layer below `index` that covers it, else the background. */
export function colorUnder(frame: EditorFrame, index: number, x: number, y: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const l = frame.layers[i];
    if (l.hidden || !l.fill || !(l.type === "shape" || l.type === "badge" || l.type === "cta")) continue;
    if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) return l.fill;
  }
  return frame.background.color;
}

function textEl(l: EditorLayer, env: DocEnv, box: { x: number; y: number; w: number; h: number }, on: string, maxLines: number, center: boolean, overflow: Set<TextRole>): PlanElement | null {
  const text = (l.text ?? "").trim();
  if (!text) return null;
  const font = l.font ?? env.defaultFont;
  const weight = l.weight ?? (l.type === "text" && l.role !== "headline" && l.role !== "brand" ? 400 : 800);
  const size = l.size ?? 40;
  const lineHeight = l.lineHeight ?? (l.type === "text" ? 1.2 : 1.2);
  const fit = fitBlock(env.measure(font, weight), text, { maxSize: size, minSize: Math.max(8, size * 0.55), width: Math.max(4, box.w), maxLines: maxLines, maxHeight: box.h, lineHeight });
  const role = l.role ?? (l.type === "cta" ? "cta" : l.type === "badge" ? "tagline" : "body");
  if (fit.overflow) overflow.add(role);
  return {
    kind: "text",
    role,
    x: box.x,
    y: center ? box.y + (box.h - fit.height) / 2 : box.y,
    w: box.w,
    lines: fit.lines,
    size: fit.size,
    weight,
    color: l.color ?? textOn(on),
    on,
    align: center ? "center" : (l.align ?? "left"),
    lineHeight,
    underline: l.underline,
    font,
  };
}

/** One size of the document as a plan: layers in paint order (first is the bottom). */
export function frameToPlan(doc: EditorDoc, size: CreativeSizeId, env: DocEnv): Plan {
  const { w: W, h: H } = CREATIVE_SIZES[size];
  const frame = doc.frames[size];
  const elements: PlanElement[] = [];
  const overflow = new Set<TextRole>();
  const bg = frame.background.asset ? doc.assets[frame.background.asset] : null;
  if (bg) elements.push({ kind: "image", x: 0, y: 0, w: W, h: H, src: bg, fit: "cover" });
  frame.layers.forEach((l, i) => {
    if (l.hidden) return;
    switch (l.type) {
      case "shape":
        elements.push({ kind: "rect", x: l.x, y: l.y, w: l.w, h: l.h, fill: l.fill ?? "#cccccc", radius: l.shape === "circle" ? Math.min(l.w, l.h) / 2 : (l.radius ?? 0) });
        return;
      case "image": {
        const src = l.asset ? doc.assets[l.asset] : null;
        if (src) elements.push({ kind: "image", x: l.x, y: l.y, w: l.w, h: l.h, src, fit: l.fit ?? "contain", radius: l.radius });
        return;
      }
      case "logo":
        if (env.hasLogo) elements.push({ kind: "logo", x: l.x, y: l.y, size: Math.min(l.w, l.h) });
        return;
      case "text": {
        const on = colorUnder(frame, i, l.x + l.w / 2, l.y + Math.min(l.h, (l.size ?? 40)) / 2);
        const t = textEl(l, env, l, on, 40, false, overflow);
        if (t) elements.push(t);
        return;
      }
      case "badge":
      case "cta": {
        const fill = l.fill ?? "#0b1b3f";
        elements.push({ kind: "rect", x: l.x, y: l.y, w: l.w, h: l.h, fill, radius: l.radius ?? l.h / 2, part: l.type === "cta" ? "cta" : "tagline" });
        const pad = pillPad(l);
        const t = textEl(l, env, { x: l.x + pad, y: l.y + l.h * 0.08, w: l.w - 2 * pad, h: l.h * 0.84 }, fill, 2, true, overflow);
        if (t) elements.push(t);
        return;
      }
    }
  });
  return { w: W, h: H, background: frame.background.color, elements, overflow: [...overflow] };
}

/** The plan's overflow, safe-area and contrast warnings, plus layers that leave the canvas. */
export function frameWarnings(doc: EditorDoc, size: CreativeSizeId, plan: Plan): PlanWarning[] {
  const out = planWarnings(plan, size);
  const { w: W, h: H } = CREATIVE_SIZES[size];
  const outside = new Set<string>();
  for (const l of doc.frames[size].layers) {
    if (l.hidden || l.type === "shape") continue;
    if (l.x < -0.5 || l.y < -0.5 || l.x + l.w > W + 0.5 || l.y + l.h > H + 0.5) outside.add(layerLabel(l));
  }
  if (outside.size) out.push({ kind: "overflow", message: `${[...outside].join(", ")} tuvalin dışına taşıyor; taşan kısım görselde kesilir.` });
  return out;
}

/** Area where copy and logos belong: the whole canvas, or the 9:16 safe band. */
export function contentArea(size: CreativeSizeId) {
  const { w, h } = CREATIVE_SIZES[size];
  return size === "hikaye" ? { x: 0, y: STORY_UNSAFE.top, w, h: h - STORY_UNSAFE.top - STORY_UNSAFE.bottom } : { x: 0, y: 0, w, h };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Moves one edge-anchored box from one area to another: the nearest edge (or the centre) keeps its relative distance. */
function anchor(pos: number, len: number, from: { start: number; len: number }, to: { start: number; len: number }, newLen: number): number {
  const r = to.len / from.len;
  const startGap = pos - from.start;
  const endGap = from.start + from.len - (pos + len);
  const centreGap = Math.abs(pos + len / 2 - (from.start + from.len / 2));
  let out: number;
  if (centreGap <= Math.min(startGap, endGap)) out = to.start + to.len / 2 + (pos + len / 2 - (from.start + from.len / 2)) * r - newLen / 2;
  else if (startGap <= endGap) out = to.start + startGap * r;
  else out = to.start + to.len - endGap * r - newLen;
  if (newLen <= to.len) out = Math.min(Math.max(out, to.start), to.start + to.len - newLen);
  return out;
}

/** One layer moved from size `from` to size `to`, proportionally. */
export function scaleLayer(l: EditorLayer, from: CreativeSizeId, to: CreativeSizeId): EditorLayer {
  const A = CREATIVE_SIZES[from];
  const B = CREATIVE_SIZES[to];
  if (l.type === "shape") {
    const sx = B.w / A.w;
    const sy = B.h / A.h;
    if (l.shape === "circle") {
      const d = l.w * Math.min(sx, sy);
      return { ...l, x: round((l.x + l.w / 2) * sx - d / 2), y: round((l.y + l.h / 2) * sy - d / 2), w: round(d), h: round(d) };
    }
    return { ...l, x: round(l.x * sx), y: round(l.y * sy), w: round(l.w * sx), h: round(l.h * sy), radius: l.radius === undefined ? undefined : round(l.radius * Math.min(sx, sy)) };
  }
  const fa = contentArea(from);
  const ta = contentArea(to);
  const rw = ta.w / fa.w;
  const rh = ta.h / fa.h;
  const s = Math.min(rw, rh);
  const textual = l.type === "text" || l.type === "badge" || l.type === "cta";
  const w = Math.max(4, Math.min(ta.w, textual && l.type === "text" ? l.w * rw : l.w * s));
  const h = Math.max(4, Math.min(ta.h, l.h * s));
  return {
    ...l,
    x: round(anchor(l.x, l.w, { start: fa.x, len: fa.w }, { start: ta.x, len: ta.w }, w)),
    y: round(anchor(l.y, l.h, { start: fa.y, len: fa.h }, { start: ta.y, len: ta.h }, h)),
    w: round(w),
    h: round(h),
    size: l.size === undefined ? undefined : Math.max(8, round(l.size * s)),
    radius: l.radius === undefined ? undefined : round(l.radius * s),
  };
}

/** "Tüm boyutlara uygula": the layers and background of one size, carried to the other three. */
export function applyToAllSizes(doc: EditorDoc, from: CreativeSizeId): EditorDoc {
  const src = doc.frames[from];
  const frames = { ...doc.frames };
  for (const to of CREATIVE_SIZE_IDS) {
    if (to === from) continue;
    frames[to] = { background: { ...src.background }, layers: src.layers.map((l) => scaleLayer(l, from, to)) };
  }
  return { ...doc, frames };
}

/** A layout's plan as editable layers; pills (call to action, tagline) become one layer with their text. */
export function planToFrame(plan: Plan, texts: Partial<Record<TextRole, string>>, font: BrandFontId): EditorFrame {
  const layers: EditorLayer[] = [];
  const count: Record<string, number> = {};
  const id = (t: string) => `${t}-${(count[t] = (count[t] ?? 0) + 1)}`;
  const els = plan.elements;
  const used = new Set<number>();
  els.forEach((e, i) => {
    if (used.has(i)) return;
    if (e.kind === "rect" && e.part) {
      const j = els.findIndex((x, k) => k > i && !used.has(k) && x.kind === "text" && x.role === e.part);
      const t = j >= 0 ? els[j] : null;
      if (t && t.kind === "text") {
        used.add(j);
        layers.push({
          id: id(e.part === "cta" ? "cta" : "rozet"),
          type: e.part === "cta" ? "cta" : "badge",
          role: e.part,
          x: round(e.x), y: round(e.y), w: round(e.w), h: round(e.h),
          fill: e.fill, radius: e.radius === undefined ? undefined : round(e.radius),
          text: texts[e.part] ?? t.lines.join(" "),
          font, weight: t.weight, size: round(t.size), color: t.color,
        });
        return;
      }
    }
    if (e.kind === "rect") layers.push({ id: id("sekil"), type: "shape", shape: "rect", x: round(e.x), y: round(e.y), w: round(Math.max(4, e.w)), h: round(Math.max(4, e.h)), fill: e.fill, radius: e.radius === undefined ? undefined : round(e.radius) });
    else if (e.kind === "circle") layers.push({ id: id("sekil"), type: "shape", shape: "circle", x: round(e.cx - e.r), y: round(e.cy - e.r), w: round(e.r * 2), h: round(e.r * 2), fill: e.fill });
    else if (e.kind === "logo") layers.push({ id: id("logo"), type: "logo", x: round(e.x), y: round(e.y), w: round(e.size), h: round(e.size) });
    else if (e.kind === "image") layers.push({ id: id("gorsel"), type: "image", x: round(e.x), y: round(e.y), w: round(e.w), h: round(e.h), fit: e.fit });
    else if (e.kind === "text") {
      const height = e.lines.length * e.size * e.lineHeight;
      layers.push({
        id: id(e.role),
        type: "text",
        role: e.role,
        // A hair of slack so the same text re-fits at the same size.
        x: round(e.x), y: round(e.y), w: round(e.w + 1), h: round(height + 2),
        // Underlined calls to action carry an arrow that the layout adds to the copy.
        text: texts[e.role] !== undefined ? `${texts[e.role]}${e.underline && e.role === "cta" && texts[e.role] ? " →" : ""}` : e.lines.join(" "),
        font, weight: e.weight, size: round(e.size), color: e.color, align: e.align, lineHeight: e.lineHeight, underline: e.underline,
      });
    }
  });
  return { background: { color: plan.background, asset: null }, layers };
}

/** New copy placed into a saved template; empty optional slots are hidden. */
export function fillTemplate(doc: EditorDoc, texts: Partial<Record<TextRole, string>>): EditorDoc {
  const frames = { ...doc.frames };
  for (const s of CREATIVE_SIZE_IDS) {
    frames[s] = {
      ...doc.frames[s],
      layers: doc.frames[s].layers.map((l) => {
        if (!l.role || !(l.role in texts)) return l;
        const t = (texts[l.role] ?? "").trim();
        return t ? { ...l, text: l.underline && l.role === "cta" ? `${t} →` : t } : { ...l, hidden: true };
      }),
    };
  }
  return { ...doc, frames };
}

/** The layer layout without uploaded images (templates and stored downloads keep positions only). */
export function stripAssets(doc: EditorDoc): EditorDoc {
  const frames = { ...doc.frames };
  for (const s of CREATIVE_SIZE_IDS) frames[s] = { ...doc.frames[s], background: { color: doc.frames[s].background.color, asset: null } };
  return { ...doc, frames, assets: {} };
}

/** Every text on the document (all sizes, visible layers), for the rule check. */
export function docTexts(doc: EditorDoc): string[] {
  const out = new Set<string>();
  for (const s of CREATIVE_SIZE_IDS) for (const l of doc.frames[s].layers) if (!l.hidden && l.text?.trim()) out.add(l.text.trim());
  return [...out];
}
