import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrandFontId } from "@/lib/brand/kit";
import { measurer, type Measurer } from "./text-fit";
import { parseTtf } from "./ttf";

export interface LoadedFont {
  id: BrandFontId;
  regular: { data: ArrayBuffer; m: Measurer };
  bold: { data: ArrayBuffer; m: Measurer };
}

const cache = new Map<BrandFontId, Promise<LoadedFont>>();

async function weight(id: BrandFontId, w: 400 | 800) {
  const buf = await readFile(path.join(process.cwd(), "assets", "fonts", "creative", `${id}-${w}.ttf`));
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const data = bytes.slice().buffer;
  return { data, m: measurer(parseTtf(bytes)) };
}

/** Static OFL font files shipped in assets/fonts/creative (full Turkish character set). */
export function loadCreativeFont(id: BrandFontId): Promise<LoadedFont> {
  let p = cache.get(id);
  if (!p) {
    p = Promise.all([weight(id, 400), weight(id, 800)]).then(([regular, bold]) => ({ id, regular, bold }));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
