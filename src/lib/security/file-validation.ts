import type { ImageMeta } from "@/lib/engine/types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type FileCheck =
  | { ok: true; meta: ImageMeta; ext: "jpg" | "png" | "webp" }
  | { ok: false; code: "too_large" | "empty" | "bad_type" | "mime_mismatch" | "corrupt" | "too_small"; message: string };

function sniff(bytes: Uint8Array): ImageMeta["mime"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

function u16be(b: Uint8Array, o: number) {
  return (b[o] << 8) | b[o + 1];
}
function u32be(b: Uint8Array, o: number) {
  return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
}
function u16le(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u24le(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

export function readDimensions(bytes: Uint8Array, mime: ImageMeta["mime"]): { width: number; height: number } | null {
  try {
    if (mime === "image/png") {
      if (bytes.length < 24) return null;
      return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }
    if (mime === "image/jpeg") {
      let o = 2;
      while (o + 9 < bytes.length) {
        if (bytes[o] !== 0xff) {
          o++;
          continue;
        }
        const marker = bytes[o + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          o += 2;
          continue;
        }
        const len = u16be(bytes, o + 2);
        if (
          (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
        ) {
          return { height: u16be(bytes, o + 5), width: u16be(bytes, o + 7) };
        }
        o += 2 + len;
      }
      return null;
    }
    if (mime === "image/webp") {
      const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (chunk === "VP8X") return { width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
      if (chunk === "VP8L") {
        const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
        return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      if (chunk === "VP8 ") return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Validates size, declared MIME, real magic bytes and dimensions. Declared type is never trusted alone. */
export function validateImage(bytes: Uint8Array, declaredMime: string): FileCheck {
  if (bytes.length === 0) return { ok: false, code: "empty", message: "Dosya boş görünüyor." };
  if (bytes.length > MAX_UPLOAD_BYTES)
    return { ok: false, code: "too_large", message: "Dosya 5 MB sınırını aşıyor. Daha küçük bir görsel yükleyin." };
  if (!(ALLOWED_MIME as readonly string[]).includes(declaredMime))
    return { ok: false, code: "bad_type", message: "Yalnızca JPG, PNG veya WebP görseller yüklenebilir." };
  const real = sniff(bytes);
  if (!real) return { ok: false, code: "bad_type", message: "Dosya içeriği JPG, PNG veya WebP değil." };
  if (real !== declaredMime)
    return { ok: false, code: "mime_mismatch", message: "Dosya uzantısı ile içeriği uyuşmuyor. Görseli yeniden dışa aktarıp deneyin." };
  const dims = readDimensions(bytes, real);
  if (!dims || dims.width < 1 || dims.height < 1 || dims.width > 12000 || dims.height > 12000)
    return { ok: false, code: "corrupt", message: "Görsel okunamadı. Dosya bozuk olabilir." };
  if (Math.min(dims.width, dims.height) < 200)
    return { ok: false, code: "too_small", message: "Görsel çok küçük (en az 200 piksel olmalı)." };
  const ext = real === "image/jpeg" ? "jpg" : real === "image/png" ? "png" : "webp";
  return { ok: true, ext, meta: { mime: real, width: dims.width, height: dims.height, sizeBytes: bytes.length } };
}
