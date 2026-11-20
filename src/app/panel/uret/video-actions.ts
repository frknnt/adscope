"use server";

import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";
import { MAX_CUES } from "@/lib/video-maker/subtitles";
import { MAX_IMAGES, MAX_SECONDS_WITH_VOICE, MIN_SECONDS, TRANSITIONS } from "@/lib/video-maker/timeline";
import { reviewGeneratedVideo, type VideoReviewOut } from "@/lib/video-maker/review";

const schema = z.object({
  spec: z.object({
    imageCount: z.number().int().min(1).max(MAX_IMAGES),
    durationSec: z.number().min(MIN_SECONDS).max(MAX_SECONDS_WITH_VOICE),
    brand: z.string().max(80),
    offer: z.string().max(180),
    captions: z.array(z.string().max(180)).max(MAX_IMAGES),
    cta: z.string().max(60),
    transition: z.enum(TRANSITIONS.map((t) => t.id) as ["yakinlas", "gecis", "kaydir"]),
    voice: z.enum(["script", "upload"]).nullable().optional(),
    subtitles: z.array(z.object({ start: z.number().min(0).max(600), end: z.number().min(0).max(600), text: z.string().max(240) })).max(MAX_CUES).optional(),
    aiNotice: z.boolean().optional(),
  }),
  sound: z.object({ firstSoundSec: z.number().min(0).max(60), silentRatio: z.number().min(0).max(1) }).nullable().optional(),
  mime: z.enum(["video/mp4", "video/webm"]),
  sizeBytes: z.number().int().min(1).max(200 * 1024 * 1024),
  sector: z.enum(SECTOR_IDS),
  platform: z.enum(PLATFORM_IDS),
});

export async function reviewVideoAction(raw: unknown): Promise<{ ok: true; review: VideoReviewOut } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Video bilgileri okunamadı." };
  if (!rateLimit(`video-review:${await hashKey("video", user.id)}`, 60, 60 * 60_000).ok) return { ok: false, error: "Bir saatte en fazla 60 video kontrolü yapılabilir." };
  try {
    return { ok: true, review: await reviewGeneratedVideo(getRepo(), parsed.data) };
  } catch {
    console.error("video review failed");
    return { ok: false, error: "Video kontrol edilemedi. Biraz sonra yeniden dene." };
  }
}
