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

/** Spread frame times across the video, starting near the opening (the first seconds matter most on Reels). */
export function frameTimes(durationSec: number, count: number): number[] {
  const n = Math.max(1, Math.min(count, Math.floor(durationSec * 2) || 1));
  if (n === 1) return [Math.min(0.1, durationSec / 2)];
  const first = Math.min(0.3, durationSec * 0.05);
  const last = Math.max(first, durationSec - Math.min(0.3, durationSec * 0.05));
  return Array.from({ length: n }, (_, i) => first + ((last - first) * i) / (n - 1));
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
