export interface ImageInput {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

export type ImageOutcome =
  | { ok: true; bytes: Uint8Array; mime: "image/png" | "image/jpeg" }
  | { ok: false; reason: "rate_limited" | "rejected" | "unavailable" };

/** Provider-agnostic image operations (background removal, new background, upscale). */
export interface ImageProvider {
  readonly name: string;
  removeBackground(img: ImageInput): Promise<ImageOutcome>;
  /** Removes the background and generates a new one around the untouched product. */
  generateBackground(img: ImageInput, o: { prompt: string; seed: number; width: number; height: number }): Promise<ImageOutcome>;
  upscale(img: ImageInput, factor: 2 | 4): Promise<ImageOutcome>;
  /** Largest input side the upscaler accepts. */
  readonly upscaleMaxSide: number;
}
