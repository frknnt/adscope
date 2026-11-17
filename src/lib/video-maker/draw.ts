/** Browser renderer: draws one frame of a timeline onto a 1080×1920 canvas. */
import { layersAt, slideAt, VIDEO_H, VIDEO_W, type TextBox, type Timeline } from "./timeline";

export interface FrameImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface DrawStyle {
  font: string;
  accent: string;
  accentText: string;
  panel: string;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function cover(ctx: Ctx, img: FrameImage, scale: number, dx: number, alpha: number) {
  const s = Math.max(VIDEO_W / img.width, VIDEO_H / img.height) * scale;
  const w = img.width * s;
  const h = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img.source, (VIDEO_W - w) / 2 + dx, (VIDEO_H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

export function wrapLines(ctx: Ctx, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size whose wrapped lines fit the box; the last line is shortened when nothing fits. */
export function fitBox(ctx: Ctx, text: string, box: TextBox, font: string): { size: number; lines: string[] } {
  for (let size = box.maxSize; size >= box.minSize; size -= 2) {
    ctx.font = `800 ${size}px ${font}`;
    const lines = wrapLines(ctx, text, box.w - 48);
    if (lines.length <= box.maxLines && lines.length * size * 1.18 <= box.h - 32 && lines.every((l) => ctx.measureText(l).width <= box.w - 48)) return { size, lines };
  }
  ctx.font = `800 ${box.minSize}px ${font}`;
  const lines = wrapLines(ctx, text, box.w - 48).slice(0, box.maxLines);
  lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\s*\S+$/, "")}…`;
  return { size: box.minSize, lines };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function drawFrame(ctx: Ctx, tl: Timeline, t: number, images: FrameImage[], style: DrawStyle) {
  ctx.fillStyle = "#0b1b3f";
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  const at = slideAt(tl, t);
  if (at) {
    const img = images[at.current.index] ?? images[0];
    const nextImg = at.next ? (images[at.next.index] ?? images[0]) : null;
    if (tl.transition === "yakinlas") {
      cover(ctx, img, 1 + 0.08 * at.progress, 0, 1);
      if (nextImg && at.mix > 0) cover(ctx, nextImg, 1, 0, at.mix);
    } else if (tl.transition === "gecis") {
      cover(ctx, img, 1, 0, 1);
      if (nextImg && at.mix > 0) cover(ctx, nextImg, 1, 0, at.mix);
    } else {
      cover(ctx, img, 1.02, -VIDEO_W * at.mix, 1);
      if (nextImg && at.mix > 0) cover(ctx, nextImg, 1.02, VIDEO_W * (1 - at.mix), 1);
    }
  } else {
    // Closing card: plain brand colour.
    ctx.fillStyle = style.panel;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const { layer, alpha } of layersAt(tl, t)) {
    const { size, lines } = fitBox(ctx, layer.text, layer.box, style.font);
    ctx.font = `800 ${size}px ${style.font}`;
    const lh = size * 1.18;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const panelW = Math.min(layer.box.w, textW + 64);
    const panelH = lines.length * lh + 36;
    const cx = layer.box.x + layer.box.w / 2;
    // Captions grow upwards from the bottom of their box; other layers are centred in theirs.
    const top = layer.role === "caption" ? layer.box.y + layer.box.h - panelH : layer.box.y + (layer.box.h - panelH) / 2;
    ctx.globalAlpha = alpha;
    if (layer.role === "cta") {
      ctx.fillStyle = style.accent;
      roundRect(ctx, cx - panelW / 2, top, panelW, panelH, panelH / 2);
      ctx.fillStyle = style.accentText;
    } else if (layer.role !== "endBrand") {
      ctx.fillStyle = "rgba(11, 27, 63, 0.78)";
      roundRect(ctx, cx - panelW / 2, top, panelW, panelH, 28);
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = "#ffffff";
    }
    lines.forEach((l, i) => ctx.fillText(l, cx, top + 18 + i * lh + (lh - size) / 2));
    ctx.globalAlpha = 1;
  }
}
