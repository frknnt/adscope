import "server-only";
import { appMode } from "@/lib/env";

/**
 * Google Gemini API, Interactions endpoint (POST {base}/v1beta/interactions, header x-goog-api-key).
 * Images: Nano Banana (default gemini-nano-banana-2.1), one image per call, base64 in the response.
 * Video: Gemini Omni Flash (default gemini-omni-1.1-flash), 3–10 s with audio, 720p, 9:16 or 16:9,
 * synchronous; a long video may come back as a file URI on the same API host instead of base64.
 * Every generated image carries Google's SynthID watermark. The prompt is the user's own product
 * input; nothing else about the user (name, e-mail, account) is sent.
 */
export type GenAspect = "1:1" | "4:5" | "9:16" | "16:9";
export type GenRef = { bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp" };
export type GenOutcome =
  | { ok: true; bytes: Uint8Array; mime: "image/png" | "image/jpeg" | "image/webp" | "video/mp4" }
  | { ok: false; reason: "rate_limited" | "rejected" | "unavailable" };

const IMAGE_TIMEOUT_MS = 90_000;
const VIDEO_TIMEOUT_MS = 280_000;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

type Block = { type?: string; mime_type?: string; data?: string; uri?: string };

/** Finds the first generated media block in an Interactions response (raw REST or SDK-like shapes). */
export function findMedia(json: unknown, kind: "image" | "video"): Block | null {
  const j = json as { steps?: { type?: string; content?: Block[] }[]; outputs?: Block[]; output_image?: Block; output_video?: Block };
  const direct = kind === "image" ? j?.output_image : j?.output_video;
  if (direct?.data || direct?.uri) return direct;
  for (const step of j?.steps ?? []) {
    if (step?.type && step.type !== "model_output") continue;
    for (const c of step?.content ?? []) if (c?.type === kind && (c.data || c.uri)) return c;
  }
  for (const c of j?.outputs ?? []) if (c?.type === kind && (c.data || c.uri)) return c;
  return null;
}

export class GeminiProvider {
  readonly name = "Google Gemini";
  constructor(
    private readonly key: string,
    private readonly base: string,
    readonly imageModel: string,
    readonly videoModel: string,
  ) {}

  private async interact(body: Record<string, unknown>, timeoutMs: number): Promise<{ ok: true; json: unknown } | { ok: false; reason: "rate_limited" | "rejected" | "unavailable" }> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/v1beta/interactions`, {
        method: "POST",
        headers: { "x-goog-api-key": this.key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
    } catch {
      console.error("[genai] request_failed");
      return { ok: false, reason: "unavailable" };
    }
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (res.status === 400 || res.status === 403 || res.status === 422) {
      console.error("[genai] rejected", { status: res.status });
      return { ok: false, reason: "rejected" };
    }
    if (!res.ok) {
      console.error("[genai] provider_error", { status: res.status });
      return { ok: false, reason: "unavailable" };
    }
    try {
      return { ok: true, json: await res.json() };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  /** Downloads a file URI the API returned. The key is only ever sent to the API's own host. */
  private async download(uri: string): Promise<Uint8Array | null> {
    let u: URL;
    try {
      u = new URL(uri, this.base);
    } catch {
      return null;
    }
    if (u.origin !== new URL(this.base).origin) return null;
    if (!u.searchParams.has("alt")) u.searchParams.set("alt", "media");
    try {
      const res = await fetch(u, { headers: { "x-goog-api-key": this.key }, signal: AbortSignal.timeout(60_000), redirect: "error" });
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      return buf.byteLength <= MAX_VIDEO_BYTES ? buf : null;
    } catch {
      return null;
    }
  }

  private async media(json: unknown, kind: "image" | "video"): Promise<GenOutcome> {
    const block = findMedia(json, kind);
    // No media back usually means the request was blocked by the provider's safety filters.
    if (!block) return { ok: false, reason: "rejected" };
    const bytes = block.data ? new Uint8Array(Buffer.from(block.data, "base64")) : block.uri ? await this.download(block.uri) : null;
    if (!bytes || !bytes.byteLength) return { ok: false, reason: "unavailable" };
    const mime = sniff(bytes);
    if (!mime || (kind === "video") !== (mime === "video/mp4")) return { ok: false, reason: "unavailable" };
    return { ok: true, bytes, mime };
  }

  async image(p: { prompt: string; refs: GenRef[]; aspect: GenAspect }): Promise<GenOutcome> {
    const input = [
      ...p.refs.map((r) => ({ type: "image", mime_type: r.mime, data: Buffer.from(r.bytes).toString("base64") })),
      { type: "text", text: p.prompt },
    ];
    const r = await this.interact({ model: this.imageModel, input, response_format: { type: "image", mime_type: "image/png", aspect_ratio: p.aspect, image_size: "1K" } }, IMAGE_TIMEOUT_MS);
    return r.ok ? this.media(r.json, "image") : r;
  }

  async video(p: { prompt: string; start: GenRef | null; aspect: "9:16" | "16:9" }): Promise<GenOutcome> {
    const input = [...(p.start ? [{ type: "image", mime_type: p.start.mime, data: Buffer.from(p.start.bytes).toString("base64") }] : []), { type: "text", text: p.prompt }];
    const r = await this.interact({ model: this.videoModel, input, response_format: { type: "video", aspect_ratio: p.aspect, resolution: "720p" } }, VIDEO_TIMEOUT_MS);
    return r.ok ? this.media(r.json, "video") : r;
  }
}

function sniff(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "video/mp4";
  return null;
}

export function geminiFromEnv(): GeminiProvider | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  // The endpoint override exists only for the test suite's fake server; production always uses Google.
  const base = ((appMode() !== "production" && process.env.GEMINI_API_BASE) || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const model = (v: string | undefined, d: string) => (v && /^[a-z0-9.-]{3,60}$/.test(v) ? v : d);
  return new GeminiProvider(key, base, model(process.env.GEMINI_IMAGE_MODEL, "gemini-nano-banana-2.1"), model(process.env.GEMINI_VIDEO_MODEL, "gemini-omni-1.1-flash"));
}
