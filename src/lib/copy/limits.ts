import type { Platform } from "@/lib/platforms";

/**
 * Character limits applied to generated copy. Google Ads limits are hard limits of responsive search ads;
 * Meta and TikTok values are the lengths that show without truncation in most placements.
 */
export const COPY_LIMITS: Record<Platform, { headline: number; primaryText: number; description: number; cta: number; note: string }> = {
  meta: { headline: 40, primaryText: 125, description: 30, cta: 25, note: "Meta: başlık 40, ana metin 125 karakterden sonra kısaltılarak gösterilir." },
  google_ads: { headline: 30, primaryText: 90, description: 90, cta: 25, note: "Google Ads duyarlı arama reklamı: başlık en fazla 30, açıklama en fazla 90 karakter." },
  tiktok: { headline: 40, primaryText: 100, description: 40, cta: 25, note: "TikTok: reklam metni en fazla 100 karakter." },
};

/** Cuts at the last word boundary that fits; never mid-word, never adds an ellipsis. */
export function fitTo(text: string, max: number): { text: string; trimmed: boolean } {
  const t = text.trim().replace(/\s+/g, " ");
  if ([...t].length <= max) return { text: t, trimmed: false };
  const chars = [...t].slice(0, max + 1).join("");
  const cut = chars.lastIndexOf(" ");
  const out = (cut > max * 0.5 ? chars.slice(0, cut) : [...t].slice(0, max).join("")).replace(/[\s,;:–-]+$/, "");
  return { text: out, trimmed: true };
}
