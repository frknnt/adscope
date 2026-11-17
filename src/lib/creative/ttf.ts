/**
 * Minimal TrueType reader: just enough of `cmap`, `hmtx`, `hhea` and `head` to tell whether a
 * font has a glyph for a character and how wide it is. Used to wrap creative text exactly the
 * same way it is rendered, to warn about overflow and to drop characters the font cannot draw.
 */
export interface FontMetrics {
  unitsPerEm: number;
  hasChar(codePoint: number): boolean;
  /** Advance width in font units; 0 for missing glyphs. */
  advance(codePoint: number): number;
}

interface Table {
  offset: number;
  length: number;
}

export function parseTtf(bytes: Uint8Array): FontMetrics {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = v.getUint16(4);
  const tables: Record<string, Table> = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(v.getUint8(rec), v.getUint8(rec + 1), v.getUint8(rec + 2), v.getUint8(rec + 3));
    tables[tag] = { offset: v.getUint32(rec + 8), length: v.getUint32(rec + 12) };
  }
  for (const t of ["cmap", "hmtx", "hhea", "head"]) if (!tables[t]) throw new Error(`font table missing: ${t}`);

  const unitsPerEm = v.getUint16(tables.head.offset + 18);
  const numberOfHMetrics = v.getUint16(tables.hhea.offset + 34);
  const hmtx = tables.hmtx.offset;
  const widthOf = (glyph: number) => v.getUint16(hmtx + 4 * Math.min(glyph, numberOfHMetrics - 1));

  const glyphOf = readCmap(v, tables.cmap.offset);
  const cache = new Map<number, number>();
  const glyph = (cp: number) => {
    let g = cache.get(cp);
    if (g === undefined) {
      g = glyphOf(cp);
      cache.set(cp, g);
    }
    return g;
  };
  return {
    unitsPerEm,
    hasChar: (cp) => glyph(cp) !== 0,
    advance: (cp) => {
      const g = glyph(cp);
      return g === 0 ? 0 : widthOf(g);
    },
  };
}

function readCmap(v: DataView, base: number): (cp: number) => number {
  const count = v.getUint16(base + 2);
  let best: { offset: number; format: number; rank: number } | null = null;
  for (let i = 0; i < count; i++) {
    const rec = base + 4 + i * 8;
    const platform = v.getUint16(rec);
    const encoding = v.getUint16(rec + 2);
    const offset = base + v.getUint32(rec + 4);
    const format = v.getUint16(offset);
    // Prefer full Unicode (format 12), then the BMP table (format 4).
    const rank = format === 12 && (platform === 3 || platform === 0) ? 2 : format === 4 && (platform === 3 || platform === 0) && encoding !== 0 ? 1 : format === 4 ? 0.5 : -1;
    if (rank > 0 && (!best || rank > best.rank)) best = { offset, format, rank };
  }
  if (!best) throw new Error("no unicode cmap");
  const o = best.offset;
  if (best.format === 12) {
    const groups = v.getUint32(o + 12);
    return (cp) => {
      let lo = 0;
      let hi = groups - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const g = o + 16 + mid * 12;
        const start = v.getUint32(g);
        const end = v.getUint32(g + 4);
        if (cp < start) hi = mid - 1;
        else if (cp > end) lo = mid + 1;
        else return v.getUint32(g + 8) + (cp - start);
      }
      return 0;
    };
  }
  const segX2 = v.getUint16(o + 6);
  const ends = o + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  return (cp) => {
    if (cp > 0xffff) return 0;
    for (let i = 0; i < segX2; i += 2) {
      if (cp > v.getUint16(ends + i)) continue;
      const start = v.getUint16(starts + i);
      if (cp < start) return 0;
      const delta = v.getInt16(deltas + i);
      const rangeOffset = v.getUint16(ranges + i);
      if (rangeOffset === 0) return (cp + delta) & 0xffff;
      const addr = ranges + i + rangeOffset + 2 * (cp - start);
      const g = v.getUint16(addr);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
}
