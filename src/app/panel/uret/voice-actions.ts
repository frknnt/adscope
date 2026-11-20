"use server";

import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { hashKey } from "@/lib/security/rate-limit";
import { limit } from "@/lib/security/limiter";
import { getTtsProvider, previewVoice, runVoiceover } from "@/lib/speech/voiceover";
import { MAX_VOICE_TEXT, TTS_SPEED_IDS, TTS_VOICE_IDS } from "@/lib/speech/voices";

const OFF = "Seslendirme bu ortamda bağlı değil; bu özellik kapalı.";
const base = { scriptId: z.uuid(), voice: z.enum(TTS_VOICE_IDS), speed: z.enum(TTS_SPEED_IDS) };
const previewSchema = z.object({ ...base, text: z.string().trim().min(1, "Seslendirilecek metin boş.").max(MAX_VOICE_TEXT, `Metin en fazla ${MAX_VOICE_TEXT} karakter olabilir.`) });
const voiceSchema = z.object({
  ...base,
  requestId: z.uuid(),
  lines: z.array(z.object({ index: z.number().int().min(0).max(11), text: z.string().max(MAX_VOICE_TEXT, `Bir satır en fazla ${MAX_VOICE_TEXT} karakter olabilir.`) })).min(1).max(12),
});

/** Free five-second preview. Returns a WAV as base64; nothing is stored and no credit is charged. */
export async function previewVoiceAction(raw: unknown): Promise<{ ok: true; audio: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const provider = getTtsProvider();
  if (!provider) return { ok: false, error: OFF };
  const parsed = previewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Seçimleri kontrol et." };
  if (!(await limit(`tts-preview:${await hashKey("tts-preview", user.id)}`, 30, 60 * 60_000)).ok) return { ok: false, error: "Bir saatte en fazla 30 ön dinleme yapılabilir. Biraz sonra yeniden dene." };
  try {
    const res = await previewVoice(getRepo(), provider, parsed.data);
    return res.ok ? { ok: true, audio: Buffer.from(res.wav).toString("base64") } : res;
  } catch {
    console.error("[tts] preview_failed");
    return { ok: false, error: "Ön dinleme hazırlanamadı. Biraz sonra yeniden dene." };
  }
}

/** Full voice-over of the chosen scenes: one credit, charged only when every line succeeded. */
export async function voiceoverAction(raw: unknown): Promise<{ ok: true; id: string; charged: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const provider = getTtsProvider();
  if (!provider) return { ok: false, error: OFF };
  const parsed = voiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Seçimleri kontrol et." };
  if (!(await limit(`tts-full:${await hashKey("tts-full", user.id)}`, 20, 60 * 60_000)).ok) return { ok: false, error: "Bir saatte en fazla 20 seslendirme yapılabilir. Biraz sonra yeniden dene." };
  try {
    const res = await runVoiceover(getRepo(), provider, parsed.data);
    return res.ok ? { ok: true, id: res.generation.id, charged: res.charged } : res;
  } catch {
    console.error("[tts] voiceover_failed");
    return { ok: false, error: "Seslendirme tamamlanamadı. Biraz sonra yeniden dene; kredin düşmedi." };
  }
}
