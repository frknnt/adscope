/**
 * Credit cost of generative creatives (Google Gemini API). Basis, to be re-checked against
 * https://ai.google.dev/gemini-api/docs/pricing (as of 18.11.2026 the page did not list these two
 * models): Nano Banana 2.1 about 0.034 $ per 1K image (developersdigest.tech, 18.10.2026); Gemini
 * Omni Flash about 0.07 $ per second at 720p (buildmvpfast.com, November 2026), a video is at most
 * 10 s. One AdScope credit sells for about 3.7–6.6 TL; costs below cover the provider price at
 * roughly 45 TL/$ with a margin. Failed generations are not charged.
 */
export const GENAI_OPS = {
  ai_image: { creditsPerResult: 1, maxResults: 4, label: "Yapay zekâ görseli" },
  ai_video: { creditsPerResult: 8, maxResults: 1, label: "Yapay zekâ videosu (3–10 sn, 720p)" },
} as const;
export type GenaiOp = keyof typeof GENAI_OPS;

export const IMAGE_ASPECTS = [
  { id: "1:1", label: "Kare 1:1" },
  { id: "4:5", label: "Dikey 4:5" },
  { id: "9:16", label: "Hikâye 9:16" },
] as const;
export const VIDEO_ASPECTS = [
  { id: "9:16", label: "Dikey 9:16 (Reels, TikTok)" },
  { id: "16:9", label: "Yatay 16:9" },
] as const;
