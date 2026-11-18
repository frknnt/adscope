/**
 * Builds the provider prompt. The advertiser's description is cleaned (no e-mails, links, phone
 * numbers or markup) and quoted as a labelled detail, so it cannot replace the fixed instructions.
 * The fixed part keeps legal risk low: no invented text, prices, discounts, health or result claims,
 * and the uploaded product is kept as it is (changing it could mislead consumers).
 */
export function cleanDescription(raw: string, max = 600): string {
  return [
    ...raw
      .normalize("NFC")
      .replace(/\S+@\S+/g, " ")
      .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
      .replace(/(\+?\d[\d\s().-]{7,}\d)/g, " ")
      .replace(/[^\p{L}\p{N} ,.;:!?%&'()-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .slice(0, max)
    .join("")
    .trim();
}

const RULES =
  "Do not add any text, letters, logos, prices, discount badges, before/after comparisons, medical or health symbols, or claims of results. No real or famous people, no children, no national flags or official emblems.";

export function imagePrompt(description: string, hasProduct: boolean, variant: number): string {
  const d = cleanDescription(description);
  return [
    "Create a professional social media advertising image.",
    hasProduct ? "Use the attached product photo: keep the product exactly as it is (same shape, colour, label and contents); only build the scene around it." : "",
    `Scene requested by the advertiser: "${d}".`,
    RULES,
    variant > 0 ? `Variation ${variant + 1}: use a different composition and camera angle.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function videoPrompt(description: string, hasStart: boolean): string {
  const d = cleanDescription(description);
  return [
    "Create a short, smooth advertising video for social media, under 10 seconds.",
    hasStart ? "Start from the attached image and keep the product in it exactly as it is (same shape, colour, label and contents)." : "",
    `Scene requested by the advertiser: "${d}".`,
    RULES,
    "Soft background music only, no voice-over, no spoken claims.",
  ]
    .filter(Boolean)
    .join(" ");
}
