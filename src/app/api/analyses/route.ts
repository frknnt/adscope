import { NextResponse, type NextRequest } from "next/server";
import { AnalysisFormSchema, runAnalysisRequest, type MediaUpload } from "@/lib/analysis/service";
import { MAX_VIDEO_FRAMES } from "@/lib/engine/video";
import { getCurrentUser } from "@/lib/data";
import { MAX_AUDIO_BYTES } from "@/lib/security/audio-validation";
import { rateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json(401, { ok: false, code: "unauthorized", message: "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın." });

  // Short burst guard on top of the hourly limit enforced in the database.
  const burst = rateLimit(`analysis:${user.id}`, 6, 60_000);
  if (!burst.ok) {
    return json(429, { ok: false, code: "rate_limited", message: "Kısa sürede çok fazla istek gönderdiniz. Lütfen bir dakika sonra tekrar deneyin." });
  }

  // One image (≤5 MB) or up to 6 browser-made JPEG frames (usually ~150 KB each), an optional
  // 16 kHz mono WAV (≤ ~3 MB, only with speech-to-text consent) and an optional landing screenshot (≤5 MB).
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 16 * 1024 * 1024) return json(413, { ok: false, code: "too_large", message: "Yükleme çok büyük. Görsel ve ekran görüntüsü en fazla 5 MB olabilir." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, code: "bad_request", message: "Form okunamadı. Lütfen tekrar deneyin." });
  }
  const file = form.get("image");
  const frameFiles = form.getAll("frames").filter((f): f is File => f instanceof File);
  if (!(file instanceof File) && frameFiles.length === 0) return json(400, { ok: false, code: "missing_file", message: "Bir görsel veya video seçin." });
  if (frameFiles.length > MAX_VIDEO_FRAMES) return json(400, { ok: false, code: "too_many_frames", message: "Çok fazla video karesi gönderildi." });

  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return json(400, { ok: false, code: "bad_request", message: "Form okunamadı. Lütfen tekrar deneyin." });
  }
  const parsed = AnalysisFormSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const key = first?.path[0];
    const known = key === "primaryText" || key === "transcript" || key === "landingUrl" ? first.message : "Form alanlarını kontrol edin.";
    return json(400, { ok: false, code: "invalid_form", message: known });
  }

  const audio = form.get("audio");
  if (audio instanceof File && audio.size > MAX_AUDIO_BYTES) return json(413, { ok: false, code: "too_large", message: "Ses kaydı çok uzun. Konuşma çevirisi en fazla 2 dakikalık ses için yapılır." });
  const shot = form.get("landingScreenshot");
  if (shot instanceof File && shot.size > 5 * 1024 * 1024) return json(413, { ok: false, code: "too_large", message: "Ekran görüntüsü en fazla 5 MB olabilir." });

  const media: MediaUpload =
    file instanceof File
      ? { kind: "image", file: { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type } }
      : {
          kind: "video",
          frames: await Promise.all(frameFiles.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type }))),
          audio: audio instanceof File && audio.size > 0 ? new Uint8Array(await audio.arrayBuffer()) : null,
        };
  const landingScreenshot = shot instanceof File && shot.size > 0 ? { bytes: new Uint8Array(await shot.arrayBuffer()), mime: shot.type } : null;
  const outcome = await runAnalysisRequest(parsed.data, media, { landingScreenshot });
  if (outcome.ok) return json(200, { ok: true, analysisId: outcome.analysisId, reused: outcome.reused });
  return json(outcome.status, { ok: false, code: outcome.code, message: outcome.message, analysisId: outcome.analysisId });
}
