import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { getGenaiProvider, runGenaiJob, type GenaiJob } from "@/lib/genai/service";
import { limit } from "@/lib/security/limiter";

export const runtime = "nodejs";
// A video can take a few minutes on the provider side.
export const maxDuration = 300;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const description = z.string().trim().min(10, "Ne görmek istediğini en az birkaç kelimeyle anlat.").max(600, "Açıklama en fazla 600 karakter olabilir.");
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("ai_image"), requestId: z.uuid(), description, aspect: z.enum(["1:1", "4:5", "9:16"]), count: z.coerce.number().int().min(1).max(4) }),
  z.object({ op: z.literal("ai_video"), requestId: z.uuid(), description, aspect: z.enum(["9:16", "16:9"]) }),
]);

/** Generative creatives through Google Gemini: AI images (Nano Banana) and short AI videos (Omni Flash). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json(401, { ok: false, message: "Oturumunun süresi doldu. Lütfen yeniden giriş yap." });
  const provider = getGenaiProvider();
  if (!provider) return json(503, { ok: false, message: "Yapay zekâ üretimi bu ortamda bağlı değil; bu araç kapalı." });
  if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return json(413, { ok: false, message: "Dosya 5 MB sınırını aşıyor." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, message: "Form okunamadı. Yeniden dene." });
  }
  const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return json(400, { ok: false, message: parsed.error.issues[0]?.message ?? "Form alanlarını kontrol et." });
  const d = parsed.data;
  const lim = await limit(`genai:${d.op}:${user.id}`, d.op === "ai_video" ? 10 : 30, 60 * 60_000);
  if (!lim.ok) return json(429, { ok: false, message: d.op === "ai_video" ? "Bir saatte en fazla 10 video üretilebilir. Biraz sonra yeniden dene." : "Bir saatte en fazla 30 üretim isteği gönderilebilir. Biraz sonra yeniden dene." });

  const file = form.get("image");
  const reference = file instanceof File && file.size > 0 ? { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type } : null;
  const job: GenaiJob = d.op === "ai_image" ? { op: d.op, description: d.description, aspect: d.aspect, count: d.count } : { op: d.op, description: d.description, aspect: d.aspect };
  try {
    const res = await runGenaiJob(getRepo(), provider, { requestId: d.requestId, job, reference });
    if (!res.ok) return json(400, { ok: false, message: res.error });
    const files = (res.generation.output.files as { name: string; mime: string }[]).map((f, i) => ({ name: f.name, mime: f.mime, href: `/api/generations/${res.generation.id}/files/${i}` }));
    return json(200, { ok: true, id: res.generation.id, charged: res.charged, partial: res.partial, files });
  } catch {
    console.error("[genai] job_failed");
    return json(500, { ok: false, message: "İşlem tamamlanamadı. Biraz sonra yeniden dene; kredin düşmedi." });
  }
}
