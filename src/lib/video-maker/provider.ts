/**
 * Second route for P3.1: a provider that turns a still image into a short video clip. No provider
 * is connected yet (user decision, 17.11.2026); the feature stays off until one is added here and
 * its key is set. Any implementation must send only the image and our own prompt, never personal
 * data, and must not log images.
 */
export interface ImageToVideoProvider {
  readonly name: string;
  generate(image: { bytes: Uint8Array; mime: string }, o: { prompt: string; seconds: number; width: number; height: number }): Promise<{ ok: true; bytes: Uint8Array; mime: "video/mp4" } | { ok: false; reason: "rate_limited" | "rejected" | "unavailable" }>;
}

export function getImageToVideoProvider(): ImageToVideoProvider | null {
  return null;
}
