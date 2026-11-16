import "server-only";
import { catalogRules } from "@/lib/data/memory-repo";
import { runPipeline } from "@/lib/engine/pipeline";

export const SAMPLE_AD = {
  headline: "Detoks çayı",
  primaryText: "Sadece 7 günde 5 kilo ver! Türkiye'nin en etkili detoks çayı. %100 doğal, garantili sonuç. Son gün %70 indirim!",
};

/** Runs the real deterministic engine on the sample ad so the marketing page shows true output. */
export async function sampleReport() {
  const rules = catalogRules().filter((r) => r.sector === "genel" || r.sector === "takviye_gida");
  const { result } = await runPipeline({
    input: {
      sector: "takviye_gida",
      headline: SAMPLE_AD.headline,
      primaryText: SAMPLE_AD.primaryText,
      description: "",
      flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
      image: { mime: "image/jpeg", width: 1080, height: 1350, sizeBytes: 240_000 },
    },
    rules,
  });
  return result;
}
