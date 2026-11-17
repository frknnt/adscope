import { z } from "zod";

export const COPY_FRAMEWORKS = ["aida", "pas", "fayda", "merak", "dogrudan"] as const;
export type CopyFramework = (typeof COPY_FRAMEWORKS)[number];

export const FRAMEWORK_LABEL: Record<CopyFramework, string> = {
  aida: "AIDA",
  pas: "PAS (sorun, büyüt, çöz)",
  fayda: "Fayda odaklı",
  merak: "Merak uyandıran",
  dogrudan: "Doğrudan teklif",
};

const item = z.object({ text: z.string().min(2).max(400), framework: z.enum(COPY_FRAMEWORKS) });

/** What the model must return. Anything else is rejected, not repaired. */
export const AiCopySchema = z.object({
  headlines: z.array(item).min(1).max(12),
  primary_texts: z.array(item).min(1).max(12),
  descriptions: z.array(item).min(1).max(8),
  ctas: z.array(z.string().min(2).max(60)).min(1).max(5),
});
export type AiCopy = z.infer<typeof AiCopySchema>;

/** Audience suggestions from a website (P1.3). */
export const AiAudienceSchema = z.object({
  audiences: z
    .array(
      z.object({
        name: z.string().min(2).max(60),
        age_min: z.number().int().min(18).max(80),
        age_max: z.number().int().min(18).max(80),
        need: z.string().min(2).max(300),
        objections: z.string().max(300),
        tone: z.string().max(120),
      }),
    )
    .min(1)
    .max(3),
});
export type AiAudience = z.infer<typeof AiAudienceSchema>;
