/** Credits an analysis consumes on completion. Video costs more (frames + optional speech-to-text). */
export const CREDIT_COST = { image: 1, video: 2 } as const;

export function creditCostFor(media: "image" | "video") {
  return CREDIT_COST[media];
}
