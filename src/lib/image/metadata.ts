/**
 * Removes metadata (EXIF with GPS position and camera serials, XMP, text comments) from an image
 * before it leaves our servers. Pixel data is untouched. Unknown structures are returned as-is.
 */
export function stripImageMetadata(bytes: Uint8Array, mime: string): Uint8Array {
  try {
    if (mime === "image/jpeg") return stripJpeg(bytes);
    if (mime === "image/png") return stripPng(bytes);
    if (mime === "image/webp") return stripWebp(bytes);
  } catch {
    /* fall through */
  }
  return bytes;
}

function stripJpeg(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return b;
    const marker = b[o + 1];
    // Start of scan: the rest is image data.
    if (marker === 0xda) {
      out.push(b.subarray(o));
      return concat(out);
    }
    const len = (b[o + 2] << 8) | b[o + 3];
    const seg = b.subarray(o, o + 2 + len);
    // APP1 (EXIF/XMP), APP13 (IPTC) and COM (comments) are dropped; APP0, APP2 (ICC colour) and the rest stay.
    if (!(marker === 0xe1 || marker === 0xed || marker === 0xfe)) out.push(seg);
    o += 2 + len;
  }
  return b;
}

const PNG_DROP = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

function stripPng(b: Uint8Array): Uint8Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let o = 8;
  while (o + 12 <= b.length) {
    const len = v.getUint32(o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    const end = o + 12 + len;
    if (end > b.length) return b;
    if (!PNG_DROP.has(type)) out.push(b.subarray(o, end));
    o = end;
    if (type === "IEND") break;
  }
  return concat(out);
}

function stripWebp(b: Uint8Array): Uint8Array {
  if (String.fromCharCode(...b.subarray(0, 4)) !== "RIFF" || String.fromCharCode(...b.subarray(8, 12)) !== "WEBP") return b;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks: Uint8Array[] = [];
  let o = 12;
  while (o + 8 <= b.length) {
    const type = String.fromCharCode(...b.subarray(o, o + 4));
    const len = v.getUint32(o + 4, true);
    const end = o + 8 + len + (len % 2);
    if (end > b.length) return b;
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = b.slice(o, end);
      // VP8X flags: clear the EXIF (0x08) and XMP (0x04) bits.
      if (type === "VP8X") chunk[8] &= ~0x0c;
      chunks.push(chunk);
    }
    o = end;
  }
  const body = concat(chunks);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  new DataView(head.buffer).setUint32(4, body.length + 4, true);
  return concat([head, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
