/**
 * Browser-only: reads a local video file and extracts a few JPEG still frames.
 * The video itself never leaves the device; only these frames are uploaded.
 */

export const VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoMime = (typeof VIDEO_MIME)[number];

export interface ExtractedFrame {
  blob: Blob;
  url: string;
  timeMs: number;
  width: number;
  height: number;
}

export interface ExtractedVideo {
  mime: VideoMime;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  frames: ExtractedFrame[];
}

export class VideoReadError extends Error {
  constructor(public code: "unsupported" | "decode" | "timeout" | "too_long" | "too_small") {
    super(code);
  }
}

const MAX_SIDE = 1080;

function once(el: HTMLMediaElement, event: string, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new VideoReadError("timeout")); }, ms);
    const onOk = () => { cleanup(); resolve(); };
    const onErr = () => { cleanup(); reject(new VideoReadError("decode")); };
    function cleanup() {
      clearTimeout(t);
      el.removeEventListener(event, onOk);
      el.removeEventListener("error", onErr);
    }
    el.addEventListener(event, onOk, { once: true });
    el.addEventListener("error", onErr, { once: true });
  });
}

/**
 * Frame times: the first 3 seconds decide whether people keep watching, so up to three frames come from the
 * opening (hook), the rest are spread across the remainder of the video.
 */
export function frameTimes(durationSec: number, count: number): number[] {
  const n = Math.max(1, Math.min(count, Math.floor(durationSec * 2) || 1));
  if (n === 1) return [Math.min(0.1, durationSec / 2)];
  const edge = Math.min(0.3, durationSec * 0.05);
  if (durationSec < 6 || n < 4) {
    const last = Math.max(edge, durationSec - edge);
    return Array.from({ length: n }, (_, i) => edge + ((last - edge) * i) / (n - 1));
  }
  const hook = [edge, 1.5, 2.8];
  const rest = n - hook.length;
  const from = 3.5;
  const to = durationSec - edge;
  const tail = rest === 1 ? [to] : Array.from({ length: rest }, (_, i) => from + ((to - from) * i) / (rest - 1));
  return [...hook, ...tail];
}

async function resolveDuration(video: HTMLVideoElement) {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  // Some recorders write WebM without a duration: seek far to make the browser compute it.
  video.currentTime = 1e7;
  await once(video, "seeked", 8000).catch(() => undefined);
  const d = video.duration;
  return Number.isFinite(d) && d > 0 ? d : video.currentTime;
}

export async function extractVideoFrames(file: File, opts: { count: number; maxSeconds: number }): Promise<ExtractedVideo> {
  const mime = (VIDEO_MIME as readonly string[]).includes(file.type) ? (file.type as VideoMime) : null;
  if (!mime) throw new VideoReadError("unsupported");
  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  try {
    video.src = src;
    await once(video, "loadeddata", 15000);
    const durationSec = await resolveDuration(video);
    if (!durationSec || !Number.isFinite(durationSec)) throw new VideoReadError("decode");
    if (durationSec > opts.maxSeconds) throw new VideoReadError("too_long");
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new VideoReadError("decode");
    if (Math.min(width, height) < 200) throw new VideoReadError("too_small");

    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new VideoReadError("decode");

    const frames: ExtractedFrame[] = [];
    for (const t of frameTimes(durationSec, opts.count)) {
      video.currentTime = t;
      await once(video, "seeked", 8000);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (!blob) throw new VideoReadError("decode");
      frames.push({ blob, url: URL.createObjectURL(blob), timeMs: Math.round(t * 1000), width: canvas.width, height: canvas.height });
    }
    return { mime, durationSec, width, height, sizeBytes: file.size, frames };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(src);
  }
}

export function videoErrorMessage(e: unknown): string {
  const code = e instanceof VideoReadError ? e.code : "decode";
  switch (code) {
    case "unsupported":
      return "Yalnızca MP4, MOV veya WebM videolar seçilebilir.";
    case "too_long":
      return "Video en fazla 10 dakika olabilir. Reklamda kullanacağın kesiti seç.";
    case "too_small":
      return "Video çözünürlüğü çok düşük. En kısa kenar en az 200 piksel olmalı.";
    case "timeout":
    case "decode":
    default:
      return "Bu video tarayıcında açılamadı. MP4 (H.264) olarak dışa aktarıp yeniden dene.";
  }
}

// --- Audio ----------------------------------------------------------------------------------------

export interface AudioInfo {
  analyzed: boolean;
  present: boolean;
  firstSoundSec: number | null;
  silentRatio: number | null;
  meanDbFirst3s: number | null;
}

const RATE = 16_000;
const WINDOW = RATE / 10; // 100 ms
const AUDIBLE = 0.01; // about -40 dBFS RMS
const MAX_DECODE_BYTES = 400 * 1024 * 1024;

const notAnalyzed: AudioInfo = { analyzed: false, present: false, firstSoundSec: null, silentRatio: null, meanDbFirst3s: null };

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, rate = RATE): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Measures the audio track and, if asked, returns its first seconds as a WAV for speech-to-text. */
export async function analyzeAudio(file: File, opts: { wavSeconds: number }): Promise<{ info: AudioInfo; wav: Blob | null }> {
  if (file.size > MAX_DECODE_BYTES || typeof OfflineAudioContext === "undefined") return { info: notAnalyzed, wav: null };
  let decoded: AudioBuffer;
  try {
    // decodeAudioData resamples to the context's rate (16 kHz).
    decoded = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await file.arrayBuffer());
  } catch {
    return { info: notAnalyzed, wav: null };
  }
  const len = decoded.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / decoded.numberOfChannels;
  }
  let windows = 0;
  let silent = 0;
  let firstSound: number | null = null;
  let sum3 = 0;
  let n3 = 0;
  for (let start = 0; start + WINDOW <= len; start += WINDOW) {
    let acc = 0;
    for (let i = start; i < start + WINDOW; i++) acc += mono[i] * mono[i];
    const rms = Math.sqrt(acc / WINDOW);
    windows++;
    if (rms < AUDIBLE) silent++;
    else if (firstSound === null) firstSound = start / RATE;
    if (start < 3 * RATE) {
      sum3 += rms;
      n3++;
    }
  }
  const present = firstSound !== null;
  const mean3 = n3 ? sum3 / n3 : 0;
  const info: AudioInfo = {
    analyzed: true,
    present,
    firstSoundSec: firstSound,
    silentRatio: windows ? Math.round((silent / windows) * 100) / 100 : null,
    meanDbFirst3s: mean3 > 0 ? Math.round(20 * Math.log10(mean3)) : null,
  };
  const wav = present && opts.wavSeconds > 0 ? encodeWav(mono.subarray(0, Math.min(len, opts.wavSeconds * RATE))) : null;
  return { info, wav };
}
