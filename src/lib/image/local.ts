/** Geometry for the free, in-browser tools (resize/crop and watermark). Nothing here leaves the device. */
export const ASPECTS = [
  { id: "orijinal", label: "Orijinal oran", ratio: null },
  { id: "kare", label: "Kare 1:1", ratio: 1 },
  { id: "dikey", label: "Dikey 4:5", ratio: 4 / 5 },
  { id: "hikaye", label: "Hikâye 9:16", ratio: 9 / 16 },
  { id: "yatay", label: "Yatay 1.91:1", ratio: 1.91 },
] as const;
export type AspectId = (typeof ASPECTS)[number]["id"];

export const MIN_OUTPUT = 100;
export const MAX_OUTPUT = 4096;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Centred crop of the source that has the wanted aspect ratio ("cover"). */
export function cropRect(srcW: number, srcH: number, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, w: srcW, h: srcH };
  if (srcW / srcH > ratio) {
    const w = Math.round(srcH * ratio);
    return { x: Math.round((srcW - w) / 2), y: 0, w, h: srcH };
  }
  const h = Math.round(srcW / ratio);
  return { x: 0, y: Math.round((srcH - h) / 2), w: srcW, h };
}

/** Centred placement of the whole source inside the output ("contain", with bars). */
export function fitRect(srcW: number, srcH: number, outW: number, outH: number): Rect {
  const s = Math.min(outW / srcW, outH / srcH);
  const w = Math.round(srcW * s);
  const h = Math.round(srcH * s);
  return { x: Math.round((outW - w) / 2), y: Math.round((outH - h) / 2), w, h };
}

/** Output size for a target width, keeping the aspect ratio; both sides stay within limits. */
export function outputSize(srcW: number, srcH: number, ratio: number | null, width: number): { w: number; h: number } {
  const r = ratio ?? srcW / srcH;
  let w = Math.round(Math.min(MAX_OUTPUT, Math.max(MIN_OUTPUT, width)));
  let h = Math.round(w / r);
  if (h > MAX_OUTPUT) {
    h = MAX_OUTPUT;
    w = Math.round(h * r);
  }
  if (h < MIN_OUTPUT) {
    h = MIN_OUTPUT;
    w = Math.round(h * r);
  }
  return { w, h };
}

export const MARK_POSITIONS = [
  { id: "sag-alt", label: "Sağ alt" },
  { id: "sol-alt", label: "Sol alt" },
  { id: "sag-ust", label: "Sağ üst" },
  { id: "sol-ust", label: "Sol üst" },
  { id: "orta", label: "Orta" },
] as const;
export type MarkPosition = (typeof MARK_POSITIONS)[number]["id"];

/**
 * Box of a watermark (logo or text) whose width is `scale` of the image width, kept inside a
 * margin of 3% of the shorter side.
 */
export function markRect(imgW: number, imgH: number, markW: number, markH: number, pos: MarkPosition, scale: number): Rect {
  const margin = Math.round(Math.min(imgW, imgH) * 0.03);
  let w = Math.max(1, Math.round(imgW * Math.min(0.9, Math.max(0.05, scale))));
  let h = Math.max(1, Math.round((w * markH) / markW));
  const maxH = imgH - 2 * margin;
  if (h > maxH) {
    h = maxH;
    w = Math.round((h * markW) / markH);
  }
  const left = margin;
  const right = imgW - margin - w;
  const top = margin;
  const bottom = imgH - margin - h;
  switch (pos) {
    case "sag-alt":
      return { x: right, y: bottom, w, h };
    case "sol-alt":
      return { x: left, y: bottom, w, h };
    case "sag-ust":
      return { x: right, y: top, w, h };
    case "sol-ust":
      return { x: left, y: top, w, h };
    default:
      return { x: Math.round((imgW - w) / 2), y: Math.round((imgH - h) / 2), w, h };
  }
}
