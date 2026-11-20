/** Browser-safe helpers for 16-bit PCM WAV files: read the header, wrap raw PCM, trim. */

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
  durationSec: number;
}

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Parses a PCM WAV (16-bit, mono or stereo, 8–48 kHz); null for anything else. */
export function readWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return null;
  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number } | null = null;
  while (off + 8 <= bytes.length) {
    const id = ascii(bytes, off, 4);
    const size = u32(bytes, off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > bytes.length) return null;
      const format = u16(bytes, body);
      const channels = u16(bytes, body + 2);
      const sampleRate = u32(bytes, body + 4);
      const bits = u16(bytes, body + 14);
      if (format !== 1 || bits !== 16 || channels < 1 || channels > 2 || sampleRate < 8000 || sampleRate > 48000) return null;
      fmt = { channels, sampleRate, bits };
    } else if (id === "data") {
      if (!fmt) return null;
      // Streams sometimes leave the data size at 0 or 0xFFFFFFFF; take what is in the file.
      const length = Math.min(size === 0 || size === 0xffffffff ? bytes.length - body : size, bytes.length - body);
      const frame = fmt.channels * 2;
      const dataLength = length - (length % frame);
      if (dataLength <= 0) return null;
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: 16, dataOffset: body, dataLength, durationSec: dataLength / (fmt.sampleRate * frame) };
    }
    off = body + size + (size % 2);
  }
  return null;
}

/** Wraps raw 16-bit little-endian PCM in a WAV header. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array {
  const len = pcm.length - (pcm.length % (channels * 2));
  const out = new Uint8Array(44 + len);
  const v = new DataView(out.buffer);
  const put = (o: number, s: string) => [...s].forEach((c, i) => (out[o + i] = c.charCodeAt(0)));
  put(0, "RIFF");
  v.setUint32(4, 36 + len, true);
  put(8, "WAVE");
  put(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  put(36, "data");
  v.setUint32(40, len, true);
  out.set(pcm.subarray(0, len), 44);
  return out;
}

/** Keeps the first `seconds` of a WAV, with a short fade-out so the cut does not click. */
export function trimWav(bytes: Uint8Array, seconds: number): Uint8Array | null {
  const info = readWav(bytes);
  if (!info) return null;
  const frame = info.channels * 2;
  const keep = Math.min(info.dataLength, Math.floor(seconds * info.sampleRate) * frame);
  const pcm = bytes.slice(info.dataOffset, info.dataOffset + keep);
  if (keep < info.dataLength) {
    const v = new DataView(pcm.buffer);
    const fadeFrames = Math.min(Math.floor(info.sampleRate * 0.15), keep / frame);
    const first = keep / frame - fadeFrames;
    for (let f = 0; f < fadeFrames; f++) {
      const gain = 1 - (f + 1) / fadeFrames;
      for (let c = 0; c < info.channels; c++) {
        const o = (first + f) * frame + c * 2;
        v.setInt16(o, Math.round(v.getInt16(o, true) * gain), true);
      }
    }
  }
  return pcmToWav(pcm, info.sampleRate, info.channels);
}
