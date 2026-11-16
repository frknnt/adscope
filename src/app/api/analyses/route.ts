import { NextResponse, type NextRequest } from "next/server";
import { AnalysisFormSchema, runAnalysisRequest } from "@/lib/analysis/service";
import { getCurrentUser } from "@/lib/data";
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

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 6 * 1024 * 1024) return json(413, { ok: false, code: "too_large", message: "Görsel en fazla 5 MB olabilir." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, code: "bad_request", message: "Form okunamadı. Lütfen tekrar deneyin." });
  }
  const file = form.get("image");
  if (!(file instanceof File)) return json(400, { ok: false, code: "missing_file", message: "Bir görsel seçin." });

  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return json(400, { ok: false, code: "bad_request", message: "Form okunamadı. Lütfen tekrar deneyin." });
  }
  const parsed = AnalysisFormSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const known = first?.path[0] === "primaryText" ? first.message : "Form alanlarını kontrol edin.";
    return json(400, { ok: false, code: "invalid_form", message: known });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const outcome = await runAnalysisRequest(parsed.data, { bytes, mime: file.type });
  if (outcome.ok) return json(200, { ok: true, analysisId: outcome.analysisId, reused: outcome.reused });
  return json(outcome.status, { ok: false, code: outcome.code, message: outcome.message, analysisId: outcome.analysisId });
}
