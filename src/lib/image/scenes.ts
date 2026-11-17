/**
 * Ready-made scenes for product photos. The prompt text is ours; the user's short description is
 * cleaned and added as a separate, clearly labelled detail so it cannot replace the instructions.
 */
export const SCENES = [
  { id: "studyo", label: "Stüdyo beyazı", prompt: "clean seamless white studio backdrop, soft diffused light, subtle floor reflection" },
  { id: "mermer", label: "Mermer", prompt: "polished white marble surface with soft grey veins, bright natural window light" },
  { id: "doga", label: "Doğa", prompt: "natural outdoor setting with soft green foliage and morning sunlight, shallow depth of field" },
  { id: "mutfak", label: "Mutfak", prompt: "bright modern kitchen countertop, light wood and ceramic, warm daylight" },
  { id: "vitrin", label: "Vitrin", prompt: "minimal boutique display shelf, warm spotlights, neutral beige wall" },
  { id: "pastel", label: "Pastel", prompt: "smooth pastel colour gradient backdrop with a simple round podium, soft shadows" },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];
export const SCENE_IDS = SCENES.map((s) => s.id) as [SceneId, ...SceneId[]];

/** Removes contact details and anything that is not plain scene wording; at most 120 characters. */
export function cleanSceneDetail(raw: string): string {
  return [
    ...raw
      .normalize("NFC")
      .replace(/\S+@\S+/g, " ")
      .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
      .replace(/(\+?\d[\d\s().-]{7,}\d)/g, " ")
      .replace(/[^\p{L}\p{N} ,.'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .slice(0, 120)
    .join("")
    .trim();
}

export function scenePrompt(scene: SceneId, detail: string): string {
  const base = SCENES.find((s) => s.id === scene)!.prompt;
  const extra = cleanSceneDetail(detail);
  // The product itself is never described or changed; only the background is generated.
  return `Professional product photo background: ${base}.${extra ? ` Scene detail requested by the advertiser: "${extra}".` : ""} Keep the product exactly as it is.`;
}
