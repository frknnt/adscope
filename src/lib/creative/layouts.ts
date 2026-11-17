/**
 * Eight original ad layouts, computed as plain geometry ("plans") so the same numbers drive the
 * overflow and safe-area warnings and the rendered PNG. Every text line is measured with the real
 * font metrics; nothing is left for the renderer to wrap.
 */
import { contrastRatio, textOn } from "@/lib/brand/kit";
import { CREATIVE_SIZES, STORY_UNSAFE, type CreativeSizeId } from "./sizes";
import { fitBlock, type Measurer } from "./text-fit";

export const PAPER = "#f8f6f1";
export const INK = "#0b1b3f";
export const DEFAULT_PRIMARY = "#0b1b3f";
export const DEFAULT_SECONDARY = "#ff6a4d";

export type TextRole = "headline" | "body" | "cta" | "brand" | "tagline" | "note";

export type PlanElement =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: string; radius?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string }
  | {
      kind: "text";
      role: TextRole;
      x: number;
      y: number;
      w: number;
      lines: string[];
      size: number;
      weight: 400 | 800;
      color: string;
      /** Colour directly behind the text, for the contrast check. */
      on: string;
      align: "left" | "center";
      lineHeight: number;
      underline?: boolean;
    }
  | { kind: "logo"; x: number; y: number; size: number };

export interface Plan {
  w: number;
  h: number;
  background: string;
  elements: PlanElement[];
  /** Text roles that had to be shortened. */
  overflow: TextRole[];
}

export interface PlanInput {
  headline: string;
  body: string;
  cta: string;
  brandName: string | null;
  tagline: string | null;
  /** Mandatory phrases of the brand, printed as a small note. */
  note: string;
  primary: string;
  secondary: string;
  hasLogo: boolean;
  regular: Measurer;
  bold: Measurer;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ctx extends PlanInput {
  W: number;
  H: number;
  S: number;
  tall: boolean;
  wide: boolean;
  /** Area where text and logos may go (story safe area on 9:16). */
  safe: Box;
  overflow: Set<TextRole>;
}

export const LAYOUTS = [
  { id: "manset", label: "Manşet", note: "Düz marka rengi, büyük başlık, altta çağrı." },
  { id: "serit", label: "Şerit", note: "Açık zemin, solda marka rengi şerit." },
  { id: "cerceve", label: "Çerçeve", note: "Renkli çerçeve içinde ortalanmış kart." },
  { id: "blok", label: "Renk blokları", note: "Başlık ve ayrıntı iki renk bloğunda." },
  { id: "kose", label: "Köşe dairesi", note: "Köşede büyük daire, altta metin." },
  { id: "etiket", label: "Etiket", note: "Slogan etiketi, ortalanmış başlık." },
  { id: "ikiz", label: "İkiz alan", note: "Bir yanda marka, öbür yanda mesaj." },
  { id: "bant", label: "Alt bant", note: "Açık zemin, altta marka renginde bant." },
] as const;

export type LayoutId = (typeof LAYOUTS)[number]["id"];
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id) as [LayoutId, ...LayoutId[]];

export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Accent colour for text on `bg`: the brand colour when it reads well enough, otherwise plain ink or white. */
function accentOn(bg: string, preferred: string, min = 3): string {
  return contrastRatio(preferred, bg) >= min ? preferred : textOn(bg);
}

function fitText(c: Ctx, role: TextRole, text: string, opt: { max: number; min: number; w: number; lines: number; maxH?: number; lh: number; bold: boolean }) {
  const r = fitBlock(opt.bold ? c.bold : c.regular, text, { maxSize: opt.max, minSize: opt.min, width: opt.w, maxLines: opt.lines, maxHeight: opt.maxH, lineHeight: opt.lh });
  if (r.overflow) c.overflow.add(role);
  return r;
}

/** Logo tile and brand name in one row; returns its height (0 when there is nothing to show). */
function brandRow(c: Ctx, x: number, y: number, w: number, bg: string, align: "left" | "center", out: PlanElement[]): number {
  if (!c.brandName && !c.hasLogo) return 0;
  const tile = c.S * 0.085;
  const nameSize = c.S * 0.032;
  const color = textOn(bg);
  if (!c.brandName) {
    out.push({ kind: "logo", x: align === "center" ? x + (w - tile) / 2 : x, y, size: tile });
    return tile;
  }
  const gap = c.hasLogo ? c.S * 0.022 : 0;
  const nameW = w - (c.hasLogo ? tile + gap : 0);
  const fit = fitText(c, "brand", c.brandName, { max: nameSize, min: c.S * 0.024, w: nameW, lines: 1, lh: 1.2, bold: true });
  const rowH = c.hasLogo ? tile : fit.height;
  const textW = c.bold.width(fit.lines[0] ?? "", fit.size);
  let left = x;
  if (align === "center") left = x + (w - (c.hasLogo ? tile + gap : 0) - textW) / 2;
  if (c.hasLogo) out.push({ kind: "logo", x: left, y, size: tile });
  out.push({ kind: "text", role: "brand", x: left + (c.hasLogo ? tile + gap : 0), y: y + (rowH - fit.height) / 2, w: textW + 2, lines: fit.lines, size: fit.size, weight: 800, color, on: bg, align: "left", lineHeight: 1.2 });
  return rowH;
}

interface StackOpts {
  align: "left" | "center";
  anchor: "top" | "bottom" | "center";
  bg: string;
  headlineColor: string;
  bodyColor?: string;
  cta: { fill: string; color?: string } | { underline: true; color: string } | null;
  headlineScale?: number;
  /** The headline is drawn elsewhere (split layouts). */
  noHeadline?: boolean;
}

/** Headline, body, call to action and the mandatory note, stacked inside a box. */
function stack(c: Ctx, box: Box, o: StackOpts, out: PlanElement[]): number {
  const S = c.S;
  const gap = S * 0.03;
  const bodyColor = o.bodyColor ?? textOn(o.bg);
  let ctaBlock: { lines: string[]; size: number; w: number; h: number } | null = null;
  if (c.cta && o.cta) {
    const pill = "fill" in o.cta;
    const size = S * 0.036;
    const padX = pill ? size * 1.1 : 0;
    const fit = fitText(c, "cta", pill ? c.cta : `${c.cta} →`, { max: size, min: S * 0.026, w: box.w - 2 * padX, lines: 1, lh: 1.2, bold: true });
    const padY = pill ? fit.size * 0.75 : 0;
    ctaBlock = { lines: fit.lines, size: fit.size, w: c.bold.width(fit.lines[0] ?? "", fit.size) + 2 * padX + 2, h: fit.height + 2 * padY };
  }
  const note = c.note ? fitText(c, "note", c.note, { max: S * 0.022, min: S * 0.018, w: box.w, lines: 3, lh: 1.3, bold: false }) : null;
  const fixed = (ctaBlock ? ctaBlock.h + gap * 1.2 : 0) + (note && note.lines.length ? note.height + gap * 0.8 : 0);
  const bodyOpt = (lines: number) => ({ max: S * 0.042, min: S * 0.03, w: box.w, lines, lh: 1.32, bold: false });
  let body = c.body ? fitBlock(c.regular, c.body, { maxSize: S * 0.042, minSize: S * 0.03, width: box.w, maxLines: c.tall ? 6 : 4, lineHeight: 1.32 }) : null;
  const headOpt = (room: number) => ({ max: S * (o.headlineScale ?? (c.tall ? 0.125 : 0.11)), min: S * 0.05, w: box.w, lines: c.wide ? 3 : 5, maxH: room, lh: 1.08, bold: true });
  const headline = o.noHeadline ? "" : c.headline;
  let room = box.h - fixed - (body ? body.height + gap : 0);
  let head = fitBlock(c.bold, headline, { maxSize: headOpt(room).max, minSize: headOpt(room).min, width: box.w, maxLines: headOpt(room).lines, maxHeight: room, lineHeight: 1.08 });
  if (head.overflow && body) {
    // Give the headline room first; the body shrinks to two lines.
    body = fitText(c, "body", c.body, { ...bodyOpt(2), maxH: undefined });
    room = box.h - fixed - body.height - gap;
    head = fitText(c, "headline", headline, headOpt(room));
  } else {
    if (head.overflow) c.overflow.add("headline");
    if (body?.overflow) c.overflow.add("body");
  }
  const hasBody = Boolean(body && body.lines.length);
  const hasNote = Boolean(note && note.lines.length);
  const total =
    head.height +
    (hasBody ? (head.height ? gap : 0) + body!.height : 0) +
    (ctaBlock ? (head.height || hasBody ? gap * 1.2 : 0) + ctaBlock.h : 0) +
    (hasNote ? (head.height || hasBody || ctaBlock ? gap * 0.8 : 0) + note!.height : 0);
  let y = o.anchor === "top" ? box.y : o.anchor === "bottom" ? box.y + box.h - total : box.y + (box.h - total) / 2;
  if (head.lines.length) out.push({ kind: "text", role: "headline", x: box.x, y, w: box.w, lines: head.lines, size: head.size, weight: 800, color: o.headlineColor, on: o.bg, align: o.align, lineHeight: 1.08 });
  y += head.height;
  if (hasBody) {
    if (head.height) y += gap;
    out.push({ kind: "text", role: "body", x: box.x, y, w: box.w, lines: body!.lines, size: body!.size, weight: 400, color: bodyColor, on: o.bg, align: o.align, lineHeight: 1.32 });
    y += body!.height;
  }
  if (ctaBlock && o.cta) {
    if (head.height || hasBody) y += gap * 1.2;
    const x = o.align === "center" ? box.x + (box.w - ctaBlock.w) / 2 : box.x;
    if ("fill" in o.cta) {
      out.push({ kind: "rect", x, y, w: ctaBlock.w, h: ctaBlock.h, fill: o.cta.fill, radius: ctaBlock.h / 2 });
      const color = o.cta.color ?? textOn(o.cta.fill);
      out.push({ kind: "text", role: "cta", x, y: y + (ctaBlock.h - ctaBlock.size * 1.2) / 2, w: ctaBlock.w, lines: ctaBlock.lines, size: ctaBlock.size, weight: 800, color, on: o.cta.fill, align: "center", lineHeight: 1.2 });
    } else {
      out.push({ kind: "text", role: "cta", x, y, w: ctaBlock.w, lines: ctaBlock.lines, size: ctaBlock.size, weight: 800, color: o.cta.color, on: o.bg, align: "left", lineHeight: 1.2, underline: true });
    }
    y += ctaBlock.h;
  }
  if (hasNote) {
    if (head.height || hasBody || ctaBlock) y += gap * 0.8;
    out.push({ kind: "text", role: "note", x: box.x, y, w: box.w, lines: note!.lines, size: note!.size, weight: 400, color: textOn(o.bg), on: o.bg, align: o.align, lineHeight: 1.3 });
    y += note!.height;
  }
  return total;
}

function inset(b: Box, dx: number, dy = dx): Box {
  return { x: b.x + dx, y: b.y + dy, w: b.w - 2 * dx, h: b.h - 2 * dy };
}

/** Intersection of a box with the safe area (story bands removed). */
function within(c: Ctx, b: Box): Box {
  const y = Math.max(b.y, c.safe.y);
  const bottom = Math.min(b.y + b.h, c.safe.y + c.safe.h);
  return { x: b.x, y, w: b.w, h: Math.max(0, bottom - y) };
}

type Builder = (c: Ctx, out: PlanElement[]) => string;

const BUILDERS: Record<LayoutId, Builder> = {
  manset(c, out) {
    const bg = c.primary;
    const area = c.safe;
    const top = brandRow(c, area.x, area.y, area.w, bg, "left", out);
    const accent = accentOn(bg, c.secondary);
    const bodyTop = area.y + (top ? top + c.S * 0.06 : 0);
    const box = { x: area.x, y: bodyTop, w: area.w * (c.wide ? 0.78 : 1), h: area.y + area.h - bodyTop };
    const used = stack(c, { ...box, y: box.y + c.S * 0.04, h: box.h - c.S * 0.04 }, { align: "left", anchor: "bottom", bg, headlineColor: textOn(bg), cta: { fill: c.secondary } }, out);
    out.unshift({ kind: "rect", x: area.x, y: box.y + box.h - used - c.S * 0.045, w: c.S * 0.12, h: c.S * 0.012, fill: accent, radius: c.S * 0.006 });
    return bg;
  },
  serit(c, out) {
    const bg = PAPER;
    const band = c.W * (c.wide ? 0.035 : 0.05);
    out.push({ kind: "rect", x: 0, y: 0, w: band, h: c.H, fill: c.primary }, { kind: "rect", x: band, y: 0, w: band * 0.35, h: c.H, fill: c.secondary });
    const area = { ...c.safe, x: c.safe.x + band, w: c.safe.w - band };
    const top = brandRow(c, area.x, area.y, area.w, bg, "left", out);
    const y = area.y + (top ? top + c.S * 0.07 : 0);
    stack(c, { x: area.x, y, w: area.w * (c.wide ? 0.8 : 1), h: area.y + area.h - y }, { align: "left", anchor: c.wide || c.tall ? "center" : "top", bg, headlineColor: accentOn(bg, c.primary, 4.5), cta: { fill: c.primary } }, out);
    return bg;
  },
  cerceve(c, out) {
    const bg = c.secondary;
    const m = c.S * 0.055;
    const card = c.H > c.W ? within(c, inset({ x: 0, y: 0, w: c.W, h: c.H }, m)) : inset({ x: 0, y: 0, w: c.W, h: c.H }, m);
    out.push({ kind: "rect", ...card, fill: PAPER, radius: c.S * 0.035 });
    const inner = inset(card, c.S * 0.06, c.S * 0.06);
    const top = brandRow(c, inner.x, inner.y, inner.w, PAPER, "center", out);
    const y = inner.y + (top ? top + c.S * 0.04 : 0);
    stack(c, { x: inner.x, y, w: inner.w, h: inner.y + inner.h - y }, { align: "center", anchor: "center", bg: PAPER, headlineColor: accentOn(PAPER, c.primary, 4.5), cta: { fill: c.primary } }, out);
    return bg;
  },
  blok(c, out) {
    const bg = c.primary;
    const lower = mix(c.secondary, "#ffffff", 0.82);
    if (c.wide) {
      const split = c.W * 0.56;
      out.push({ kind: "rect", x: split, y: 0, w: c.W - split, h: c.H, fill: lower });
      const left = { x: c.safe.x, y: c.safe.y, w: split - c.safe.x * 2, h: c.safe.h };
      const top = brandRow(c, left.x, left.y, left.w, bg, "left", out);
      const hy = left.y + (top ? top + c.S * 0.05 : 0);
      const head = fitText(c, "headline", c.headline, { max: c.S * 0.1, min: c.S * 0.05, w: left.w, lines: 4, maxH: left.y + left.h - hy, lh: 1.08, bold: true });
      out.push({ kind: "text", role: "headline", x: left.x, y: hy, w: left.w, lines: head.lines, size: head.size, weight: 800, color: textOn(bg), on: bg, align: "left", lineHeight: 1.08 });
      const right = { x: split + c.safe.x, y: c.safe.y, w: c.W - split - c.safe.x * 2, h: c.safe.h };
      stack(c, right, { align: "left", anchor: "center", bg: lower, headlineColor: lower, cta: { fill: c.primary }, noHeadline: true }, out);
      return bg;
    }
    const split = c.safe.y + c.safe.h * 0.55;
    out.push({ kind: "rect", x: 0, y: split, w: c.W, h: c.H - split, fill: lower });
    const upper = { x: c.safe.x, y: c.safe.y, w: c.safe.w, h: split - c.safe.y - c.S * 0.06 };
    const top = brandRow(c, upper.x, upper.y, upper.w, bg, "left", out);
    const hy = upper.y + (top ? top + c.S * 0.05 : 0);
    const head = fitText(c, "headline", c.headline, { max: c.S * 0.11, min: c.S * 0.05, w: upper.w, lines: 5, maxH: upper.y + upper.h - hy, lh: 1.08, bold: true });
    out.push({ kind: "text", role: "headline", x: upper.x, y: upper.y + upper.h - head.height, w: upper.w, lines: head.lines, size: head.size, weight: 800, color: textOn(bg), on: bg, align: "left", lineHeight: 1.08 });
    const lowerBox = { x: c.safe.x, y: split + c.S * 0.06, w: c.safe.w, h: c.safe.y + c.safe.h - split - c.S * 0.06 };
    stack(c, lowerBox, { align: "left", anchor: c.tall ? "center" : "top", bg: lower, headlineColor: lower, cta: { fill: c.primary }, noHeadline: true }, out);
    return bg;
  },
  kose(c, out) {
    const bg = c.primary;
    const r = c.S * (c.wide ? 0.55 : 0.36);
    const cx = c.W - r * (c.wide ? 0.35 : 0.2);
    const cy = c.wide ? c.H * 0.2 : r * 0.2;
    out.push({ kind: "circle", cx, cy, r, fill: c.secondary }, { kind: "circle", cx, cy, r: r * 0.55, fill: mix(c.secondary, "#ffffff", 0.25) });
    const area = c.safe;
    const textW = c.wide ? cx - r - area.x - c.S * 0.04 : area.w;
    const top = brandRow(c, area.x, area.y, Math.min(textW, cx - r - area.x - c.S * 0.03), bg, "left", out);
    const afterBrand = area.y + (top ? top + c.S * 0.05 : 0);
    const minY = c.wide ? afterBrand : Math.max(afterBrand, cy + r + c.S * 0.04);
    stack(c, { x: area.x, y: minY, w: textW, h: area.y + area.h - minY }, { align: "left", anchor: "bottom", bg, headlineColor: textOn(bg), cta: { underline: true, color: accentOn(bg, c.secondary, 4.5) } }, out);
    return bg;
  },
  etiket(c, out) {
    const bg = PAPER;
    const area = inset(c.safe, c.wide ? c.W * 0.08 : 0, 0);
    let y = area.y;
    if (c.tagline) {
      const size = c.S * 0.028;
      const fit = fitText(c, "tagline", c.tagline, { max: size, min: c.S * 0.022, w: area.w * 0.8, lines: 1, lh: 1.2, bold: true });
      const w = c.bold.width(fit.lines[0] ?? "", fit.size) + fit.size * 2.2;
      const h = fit.height + fit.size * 1.1;
      const x = area.x + (area.w - w) / 2;
      out.push({ kind: "rect", x, y, w, h, fill: c.secondary, radius: h / 2 });
      out.push({ kind: "text", role: "tagline", x, y: y + (h - fit.height) / 2, w, lines: fit.lines, size: fit.size, weight: 800, color: textOn(c.secondary), on: c.secondary, align: "center", lineHeight: 1.2 });
      y += h + c.S * 0.05;
    }
    const brandH = c.brandName || c.hasLogo ? (c.hasLogo ? c.S * 0.085 : c.S * 0.04) : 0;
    const bottom = area.y + area.h - (brandH ? brandH + c.S * 0.05 : 0);
    stack(c, { x: area.x, y, w: area.w, h: bottom - y }, { align: "center", anchor: "center", bg, headlineColor: accentOn(bg, c.primary, 4.5), cta: { underline: true, color: accentOn(bg, c.primary, 4.5) }, headlineScale: 0.12 }, out);
    if (brandH) brandRow(c, area.x, area.y + area.h - brandH, area.w, bg, "center", out);
    return bg;
  },
  ikiz(c, out) {
    const bg = PAPER;
    if (c.wide) {
      const split = c.W * 0.36;
      out.push({ kind: "rect", x: 0, y: 0, w: split, h: c.H, fill: c.primary });
      const panel = { x: c.safe.x, y: c.safe.y, w: split - c.safe.x * 2, h: c.safe.h };
      ikizBrand(c, panel, out);
      stack(c, { x: split + c.safe.x, y: c.safe.y, w: c.W - split - c.safe.x * 2, h: c.safe.h }, { align: "left", anchor: "center", bg, headlineColor: accentOn(bg, c.primary, 4.5), cta: { fill: c.secondary } }, out);
      return bg;
    }
    const split = c.safe.y + c.safe.h * 0.34;
    out.push({ kind: "rect", x: 0, y: 0, w: c.W, h: split, fill: c.primary });
    ikizBrand(c, { x: c.safe.x, y: c.safe.y, w: c.safe.w, h: split - c.safe.y - c.S * 0.04 }, out);
    const y = split + c.S * 0.07;
    stack(c, { x: c.safe.x, y, w: c.safe.w, h: c.safe.y + c.safe.h - y }, { align: "left", anchor: "top", bg, headlineColor: accentOn(bg, c.primary, 4.5), cta: { fill: c.secondary } }, out);
    return bg;
  },
  bant(c, out) {
    const bg = mix(c.primary, "#ffffff", 0.9);
    const area = c.safe;
    const ctaSize = c.S * 0.036;
    const bandInner = Math.max(c.S * 0.085, ctaSize * 2.7);
    const bandTop = area.y + area.h - bandInner - c.S * 0.03;
    out.push({ kind: "rect", x: 0, y: bandTop - c.S * 0.05, w: c.W, h: c.H - bandTop + c.S * 0.05, fill: c.primary });
    // Brand on the left of the band, call to action on the right.
    const half = area.w / 2;
    brandRow(c, area.x, bandTop + (bandInner - (c.hasLogo ? c.S * 0.085 : c.S * 0.04)) / 2, half, c.primary, "left", out);
    if (c.cta) {
      const fit = fitText(c, "cta", c.cta, { max: ctaSize, min: c.S * 0.026, w: half - ctaSize * 2.2, lines: 1, lh: 1.2, bold: true });
      const w = c.bold.width(fit.lines[0] ?? "", fit.size) + fit.size * 2.2 + 2;
      const h = fit.height + fit.size * 1.5;
      const x = area.x + area.w - w;
      const y = bandTop + (bandInner - h) / 2;
      out.push({ kind: "rect", x, y, w, h, fill: c.secondary, radius: h / 2 });
      out.push({ kind: "text", role: "cta", x, y: y + (h - fit.height) / 2, w, lines: fit.lines, size: fit.size, weight: 800, color: textOn(c.secondary), on: c.secondary, align: "center", lineHeight: 1.2 });
    }
    const box = { x: area.x, y: area.y, w: area.w * (c.wide ? 0.85 : 1), h: bandTop - c.S * 0.1 - area.y };
    stack(c, box, { align: "left", anchor: c.tall ? "center" : "top", bg, headlineColor: accentOn(bg, c.primary, 4.5), cta: null }, out);
    return bg;
  },
};

function ikizBrand(c: Ctx, panel: Box, out: PlanElement[]) {
  const bg = c.primary;
  if (c.hasLogo) {
    const size = Math.min(panel.w, panel.h) * 0.42;
    out.push({ kind: "logo", x: panel.x + (panel.w - size) / 2, y: panel.y + (panel.h - size) / 2 - (c.brandName ? c.S * 0.03 : 0), size });
    if (c.brandName) {
      const fit = fitText(c, "brand", c.brandName, { max: c.S * 0.034, min: c.S * 0.024, w: panel.w, lines: 1, lh: 1.2, bold: true });
      out.push({ kind: "text", role: "brand", x: panel.x, y: panel.y + (panel.h + size) / 2, w: panel.w, lines: fit.lines, size: fit.size, weight: 800, color: textOn(bg), on: bg, align: "center", lineHeight: 1.2 });
    }
    return;
  }
  const name = c.brandName ?? c.tagline;
  if (!name) return;
  const fit = fitText(c, "brand", name, { max: c.S * 0.075, min: c.S * 0.035, w: panel.w, lines: 3, maxH: panel.h, lh: 1.1, bold: true });
  out.push({ kind: "text", role: "brand", x: panel.x, y: panel.y + (panel.h - fit.height) / 2, w: panel.w, lines: fit.lines, size: fit.size, weight: 800, color: textOn(bg), on: bg, align: "center", lineHeight: 1.1 });
}

export function buildPlan(layout: LayoutId, size: CreativeSizeId, input: PlanInput): Plan {
  const { w: W, h: H } = CREATIVE_SIZES[size];
  const S = Math.min(W, H);
  const side = W * (W > H ? 0.06 : 0.075);
  const pad = S * 0.075;
  const story = size === "hikaye";
  const safe = story ? { x: side, y: STORY_UNSAFE.top + S * 0.02, w: W - 2 * side, h: H - STORY_UNSAFE.top - STORY_UNSAFE.bottom - S * 0.04 } : { x: side, y: pad, w: W - 2 * side, h: H - 2 * pad };
  const c: Ctx = { ...input, W, H, S, tall: H / W > 1.5, wide: W / H > 1.5, safe, overflow: new Set() };
  const elements: PlanElement[] = [];
  const background = BUILDERS[layout](c, elements);
  return { w: W, h: H, background, elements, overflow: [...c.overflow] };
}

const ROLE_LABEL: Record<TextRole, string> = { headline: "Başlık", body: "Metin", cta: "Çağrı", brand: "Marka adı", tagline: "Slogan", note: "Zorunlu ibare" };

export interface PlanWarning {
  kind: "overflow" | "safe_area" | "contrast";
  message: string;
}

/** Overflow, 9:16 safe-area and contrast problems of a plan, in plain Turkish. */
export function planWarnings(plan: Plan, size: CreativeSizeId): PlanWarning[] {
  const out: PlanWarning[] = [];
  for (const role of plan.overflow) out.push({ kind: "overflow", message: `${ROLE_LABEL[role]} bu yerleşime sığmadı ve kısaltıldı; metni kısaltmayı düşün.` });
  if (size === "hikaye") {
    const top = STORY_UNSAFE.top;
    const bottom = plan.h - STORY_UNSAFE.bottom;
    const bad = new Set<string>();
    for (const e of plan.elements) {
      if (e.kind === "text") {
        const h = e.lines.length * e.size * e.lineHeight;
        if (e.y < top - 0.5 || e.y + h > bottom + 0.5) bad.add(ROLE_LABEL[e.role]);
      } else if (e.kind === "logo" && (e.y < top - 0.5 || e.y + e.size > bottom + 0.5)) bad.add("Logo");
    }
    if (bad.size) out.push({ kind: "safe_area", message: `${[...bad].join(", ")} 9:16 güvenli alanın dışında; üstteki ${top} ve alttaki ${STORY_UNSAFE.bottom} piksel uygulama arayüzünün altında kalabilir.` });
  }
  const low = new Set<string>();
  for (const e of plan.elements) {
    if (e.kind !== "text") continue;
    const large = e.size >= plan.w * 0.045 || (e.weight === 800 && e.size >= plan.w * 0.035);
    const ratio = contrastRatio(e.color, e.on);
    if (ratio < (large ? 3 : 4.5)) low.add(`${ROLE_LABEL[e.role]} (${ratio.toFixed(1)}:1)`);
  }
  if (low.size) out.push({ kind: "contrast", message: `Düşük kontrast: ${[...low].join(", ")}. Marka renklerini değiştirmeyi ya da başka bir yerleşimi dene.` });
  return out;
}
