import { apiError, apiJson, authenticate, serializeAnalysis } from "@/lib/api/v1";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return apiError(404, "not_found", "Analiz bulunamadı.");
  const a = await auth.repo.getAnalysis(id);
  if (!a) return apiError(404, "not_found", "Analiz bulunamadı.");
  return apiJson(200, { ok: true, analysis: serializeAnalysis(a) });
}
