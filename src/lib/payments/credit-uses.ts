import { CREDIT_COST } from "@/lib/analysis/cost";
import { CREATIVE_CREDIT_COST } from "@/lib/creative/costs";

/**
 * "What does a credit buy?" examples shown next to every package. Taken from the cost tables the
 * services charge with, so a price change in one place updates the pricing and credits pages.
 */
export const CREDIT_USES = [
  { id: "image_analysis", label: "görsel analizi", credits: CREDIT_COST.image },
  { id: "video_analysis", label: "video analizi", credits: CREDIT_COST.video },
  { id: "creative_download", label: "görsel seti indirme", credits: CREATIVE_CREDIT_COST },
] as const;

export type CreditUseId = (typeof CREDIT_USES)[number]["id"];

/** How many of each use a balance or a package covers (one use at a time, not combined). */
export function creditExamples(credits: number): { id: CreditUseId; label: string; credits: number; count: number }[] {
  return CREDIT_USES.map((u) => ({ ...u, count: Math.floor(Math.max(0, credits) / u.credits) }));
}
