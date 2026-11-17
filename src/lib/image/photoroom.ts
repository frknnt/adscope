import "server-only";
import { appMode } from "@/lib/env";
import type { ImageInput, ImageOutcome, ImageProvider } from "./provider";

/**
 * Photoroom API (https://docs.photoroom.com). Remove Background: POST {sdk}/v1/segment with
 * multipart `image_file`. Image Editing: POST {imageApi}/v2/edit with multipart `imageFile` and
 * dotted parameters. Authentication is the `x-api-key` header. Photoroom states that API images
 * are not stored; images are processed on servers in the United States.
 */
export class PhotoroomProvider implements ImageProvider {
  readonly name = "Photoroom";
  /** `upscale.mode=ai.fast` accepts inputs up to 1000×1000. */
  readonly upscaleMaxSide = 1000;

  constructor(
    private readonly key: string,
    private readonly sdkUrl: string,
    private readonly imageApiUrl: string,
  ) {}

  private async call(url: string, form: FormData): Promise<ImageOutcome> {
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: { "x-api-key": this.key, Accept: "image/png, image/jpeg" }, body: form, signal: AbortSignal.timeout(60_000), redirect: "error" });
    } catch {
      console.error("image provider request failed");
      return { ok: false, reason: "unavailable" };
    }
    if (!res.ok) {
      // Only the status code is logged: never the image, the prompt or the response body.
      console.error(`image provider status ${res.status}`);
      return { ok: false, reason: res.status === 429 ? "rate_limited" : res.status === 400 || res.status === 413 || res.status === 415 ? "rejected" : "unavailable" };
    }
    const type = res.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024) return { ok: false, reason: "unavailable" };
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpeg) return { ok: false, reason: "unavailable" };
    return { ok: true, bytes, mime: png || type.includes("png") ? "image/png" : "image/jpeg" };
  }

  /** The user's original file name is never sent; parts get a neutral name. */
  private file(img: ImageInput) {
    return new Blob([img.bytes.slice().buffer], { type: img.mime });
  }

  removeBackground(img: ImageInput) {
    const f = new FormData();
    f.set("image_file", this.file(img), `urun.${img.mime.split("/")[1]}`);
    f.set("format", "png");
    return this.call(`${this.sdkUrl}/v1/segment`, f);
  }

  generateBackground(img: ImageInput, o: { prompt: string; seed: number; width: number; height: number }) {
    const f = new FormData();
    f.set("imageFile", this.file(img), `urun.${img.mime.split("/")[1]}`);
    f.set("removeBackground", "true");
    f.set("background.prompt", o.prompt);
    f.set("background.seed", String(o.seed));
    f.set("background.expandPrompt.mode", "ai.never");
    f.set("shadow.mode", "ai.soft");
    f.set("padding", "0.12");
    f.set("outputSize", `${o.width}x${o.height}`);
    f.set("export.format", "png");
    return this.call(`${this.imageApiUrl}/v2/edit`, f);
  }

  upscale(img: ImageInput, factor: 2 | 4) {
    const f = new FormData();
    f.set("imageFile", this.file(img), `gorsel.${img.mime.split("/")[1]}`);
    f.set("upscale.mode", "ai.fast");
    // The model upscales 4×; for 2× the result is delivered at twice the input size.
    if (factor === 2) f.set("outputSize", `${img.width * 2}x${img.height * 2}`);
    f.set("export.format", "png");
    return this.call(`${this.imageApiUrl}/v2/edit`, f);
  }
}

/** Configured provider, or null (feature off) when no key is set. */
export function photoroomFromEnv(): PhotoroomProvider | null {
  const key = process.env.PHOTOROOM_API_KEY?.trim();
  if (!key) return null;
  // Endpoint overrides exist only for the test suite's fake server; production always uses Photoroom.
  const test = appMode() !== "production";
  const sdk = (test && process.env.PHOTOROOM_SDK_URL) || "https://sdk.photoroom.com";
  const api = (test && process.env.PHOTOROOM_IMAGE_API_URL) || "https://image-api.photoroom.com";
  return new PhotoroomProvider(key, sdk.replace(/\/$/, ""), api.replace(/\/$/, ""));
}
