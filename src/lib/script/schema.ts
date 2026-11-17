import { z } from "zod";

export const SCRIPT_DURATIONS = [15, 30, 45] as const;
export type ScriptDuration = (typeof SCRIPT_DURATIONS)[number];

/** What the model must return for a video script. Anything else is rejected, not repaired. */
export const AiScriptSchema = z.object({
  scenes: z
    .array(
      z.object({
        seconds: z.number().min(1).max(20),
        visual: z.string().min(2).max(300),
        on_screen_text: z.string().max(120),
        voiceover: z.string().max(300),
      }),
    )
    .min(2)
    .max(12),
});
export type AiScript = z.infer<typeof AiScriptSchema>;
