import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { SCENE_IDS } from "@/lib/image/scenes";
import { getImageProvider, runImageJob, SCENE_SIZES, type ImageJob } from "@/lib/image/service";
import { rateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("remove_background"), requestId: z.uuid() }),
  z.object({ op: z.literal("upscale"), requestId: z.uuid(), factor: z.enum(["2", "4"]) }),
  z.object({ op: z.literal("product_scene"), requestId: z.uuid(), scene: z.enum(SCENE_IDS), detail: z.string().max(300).default(""), size: z.enum(Object.keys(SCENE_SIZES) as [keyof typeof SCENE_SIZES]) }),
]);

/** Provider-backed image tools: background removal, upscale and product scenes. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json(401, { ok: false, message: "Oturumunun süresi doldu. Lütfen yeniden giriş yap." });
  const provider = getImageProvider();
  if (!provider) return json(503, { ok: false, message: "Görsel sağlayıcısı bu ortamda bağlı değil; bu araç kapalı." });
  if (!rateLimit(`images:${user.id}`, 10, 60_000).ok) return json(429, { ok: false, message: "Kısa sürede çok fazla istek gönderdin. Bir dakika sonra yeniden dene." });
  if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return json(413, { ok: false, message: "Dosya 5 MB sınırını aşıyor." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, message: "Form okunamadı. Yeniden dene." });
  }
  const file = form.get("image");
  if (!(file instanceof File)) return json(400, { ok: false, message: "Bir görsel seç." });
  const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return json(400, { ok: false, message: "Form alanlarını kontrol et." });
  const d = parsed.data;
  const job: ImageJob = d.op === "remove_background" ? { op: d.op } : d.op === "upscale" ? { op: d.op, factor: d.factor === "4" ? 4 : 2 } : { op: d.op, scene: d.scene, detail: d.detail, size: d.size };
  try {
    const res = await runImageJob(getRepo(), provider, { requestId: d.requestId, bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, job });
    if (!res.ok) return json(400, { ok: false, message: res.error });
    const files = (res.generation.output.files as { name: string }[]).map((f, i) => ({ name: f.name, href: `/api/generations/${res.generation.id}/files/${i}` }));
    return json(200, { ok: true, id: res.generation.id, charged: res.charged, files });
  } catch {
    console.error("image job failed");
    return json(500, { ok: false, message: "İşlem tamamlanamadı. Biraz sonra yeniden dene; kredin düşmedi." });
  }
}
