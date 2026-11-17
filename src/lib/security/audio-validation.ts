/** The browser sends the video's audio as 16 kHz, 16-bit mono PCM WAV (at most 120 s). Anything else is rejected. */
export const MAX_AUDIO_SECONDS = 120;
export const AUDIO_SAMPLE_RATE = 16_000;
export const MAX_AUDIO_BYTES = 44 + MAX_AUDIO_SECONDS * AUDIO_SAMPLE_RATE * 2;

export type AudioCheck = { ok: true; durationSec: number } | { ok: false; code: "bad_audio" | "too_large" };

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function validateWav(bytes: Uint8Array): AudioCheck {
  if (bytes.length > MAX_AUDIO_BYTES) return { ok: false, code: "too_large" };
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return { ok: false, code: "bad_audio" };
  // Walk chunks: fmt must be PCM, mono, 16 kHz, 16-bit; data must fit in the file.
  let off = 12;
  let fmtOk = false;
  while (off + 8 <= bytes.length) {
    const id = ascii(bytes, off, 4);
    const size = u32(bytes, off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > bytes.length) return { ok: false, code: "bad_audio" };
      const format = u16(bytes, body);
      const channels = u16(bytes, body + 2);
      const rate = u32(bytes, body + 4);
      const bits = u16(bytes, body + 14);
      fmtOk = format === 1 && channels === 1 && rate === AUDIO_SAMPLE_RATE && bits === 16;
      if (!fmtOk) return { ok: false, code: "bad_audio" };
    } else if (id === "data") {
      if (!fmtOk || body + size > bytes.length || size === 0) return { ok: false, code: "bad_audio" };
      const durationSec = size / (AUDIO_SAMPLE_RATE * 2);
      if (durationSec > MAX_AUDIO_SECONDS + 0.5) return { ok: false, code: "too_large" };
      return { ok: true, durationSec };
    }
    off = body + size + (size % 2);
  }
  return { ok: false, code: "bad_audio" };
}
