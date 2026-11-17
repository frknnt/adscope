import "server-only";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { validateImage } from "@/lib/security/file-validation";
import { IMAGE_OPS, type ImageOp } from "./costs";
import { stripImageMetadata } from "./metadata";
import { photoroomFromEnv } from "./photoroom";
import type { ImageInput, ImageOutcome, ImageProvider } from "./provider";
import { scenePrompt, type SceneId } from "./scenes";

export const SCENE_SIZES = {
  kare: { w: 1080, h: 1080, label: "Kare 1:1" },
  dikey: { w: 1080, h: 1350, label: "Dikey 4:5" },
  hikaye: { w: 1080, h: 1920, label: "Hikâye 9:16" },
} as const;
export type SceneSize = keyof typeof SCENE_SIZES;

export type ImageJob = { op: "remove_background" } | { op: "upscale"; factor: 2 | 4 } | { op: "product_scene"; scene: SceneId; detail: string; size: SceneSize };

export function getImageProvider(): ImageProvider | null {
  return photoroomFromEnv();
}

export type ImageJobResult = { ok: true; generation: GenerationRecord; charged: number } | { ok: false; error: string };

const FAIL: Record<Exclude<ImageOutcome, { ok: true }>["reason"], string> = {
  rate_limited: "Görsel sağlayıcısı şu an yoğun. Bir dakika sonra yeniden dene; kredin düşmedi.",
  rejected: "Görsel sağlayıcısı bu dosyayı işleyemedi. Başka bir fotoğrafla dene; kredin düşmedi.",
  unavailable: "Görsel sağlayıcısına ulaşılamadı. Biraz sonra yeniden dene; kredin düşmedi.",
};

function seedsFor(requestId: string): number[] {
  let h = 0;
  for (const ch of requestId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [0, 1, 2, 3].map((i) => ((h + i * 7919) % 100_000) + 1);
}

/**
 * Validates the upload, strips its metadata, runs the provider and stores the results in the
 * caller's private folder. Credits are charged together with the record, only after every result
 * arrived; a repeated request id returns the earlier result without charging again.
 */
export async function runImageJob(repo: DataRepo, provider: ImageProvider, p: { requestId: string; bytes: Uint8Array; mime: string; job: ImageJob }): Promise<ImageJobResult> {
  const existing = await repo.getGenerationByRequest(p.requestId);
  if (existing) return existing.kind === "photo" || existing.kind === "tool" ? { ok: true, generation: existing, charged: 0 } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };

  const check = validateImage(p.bytes, p.mime, 100);
  if (!check.ok) return { ok: false, error: check.message };
  const op: ImageOp = p.job.op;
  const cost = IMAGE_OPS[op].credits;
  if (p.job.op === "upscale" && Math.max(check.meta.width, check.meta.height) > provider.upscaleMaxSide) {
    return { ok: false, error: `Büyütme için görsel en fazla ${provider.upscaleMaxSide}×${provider.upscaleMaxSide} piksel olmalı. Önce Boyutlandır aracıyla küçültebilirsin.` };
  }
  if ((await repo.getBalance()) < cost) return { ok: false, error: `Bu işlem ${cost} kredi. Krediler sayfasından paket alabilirsin.` };

  const input: ImageInput = { bytes: stripImageMetadata(p.bytes, check.meta.mime), mime: check.meta.mime, width: check.meta.width, height: check.meta.height };
  const job = p.job;
  let outcomes: ImageOutcome[];
  if (job.op === "remove_background") outcomes = [await provider.removeBackground(input)];
  else if (job.op === "upscale") outcomes = [await provider.upscale(input, job.factor)];
  else {
    const size = SCENE_SIZES[job.size];
    const prompt = scenePrompt(job.scene, job.detail);
    outcomes = await Promise.all(seedsFor(p.requestId).map((seed) => provider.generateBackground(input, { prompt, seed, width: size.w, height: size.h })));
  }
  const failed = outcomes.find((o): o is Extract<ImageOutcome, { ok: false }> => !o.ok);
  if (failed) return { ok: false, error: FAIL[failed.reason] };

  const base = job.op === "remove_background" ? "arka-plansiz" : job.op === "upscale" ? `buyutulmus-${job.factor}x` : `urun-sahnesi-${job.scene}`;
  const files: { path: string; name: string; mime: string }[] = [];
  for (const [i, o] of outcomes.entries()) {
    if (!o.ok) continue;
    const name = `adscope-${base}${outcomes.length > 1 ? `-${i + 1}` : ""}.${o.mime === "image/png" ? "png" : "jpg"}`;
    const path = await repo.saveGenerationFile(name, o.bytes, o.mime);
    if (!path) {
      await repo.removeGenerationFiles(files.map((f) => f.path));
      return { ok: false, error: "Sonuç kaydedilemedi. Biraz sonra yeniden dene; kredin düşmedi." };
    }
    files.push({ path, name, mime: o.mime });
  }
  const res = await repo.recordGeneration({
    clientRequestId: p.requestId,
    kind: job.op === "product_scene" ? "photo" : "tool",
    creditCost: cost,
    brandId: null,
    platform: null,
    output: { op, ...(job.op === "product_scene" ? { scene: job.scene, size: job.size } : {}), ...(job.op === "upscale" ? { factor: job.factor } : {}), provider: provider.name, files },
  });
  if (res.status === "created") return { ok: true, generation: res.generation, charged: cost };
  await repo.removeGenerationFiles(files.map((f) => f.path));
  if (res.status === "exists") return { ok: true, generation: res.generation, charged: 0 };
  return { ok: false, error: res.status === "insufficient_credits" ? `Bu işlem ${cost} kredi.` : "İşlem kaydedilemedi." };
}
