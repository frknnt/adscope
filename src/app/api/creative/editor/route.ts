import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { EDITOR_LIMITS, parseDoc, stripAssets } from "@/lib/creative/editor";
import { checkDoc, docContext, exportDoc, renderDoc } from "@/lib/creative/editor-service";
import { CREATIVE_SIZE_IDS } from "@/lib/creative/sizes";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 60;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("preview"), size: z.enum(CREATIVE_SIZE_IDS), doc: z.unknown() }),
  z.object({ op: z.literal("export"), requestId: z.uuid(), size: z.enum([...CREATIVE_SIZE_IDS, "hepsi"] as const), label: z.string().max(60).default(""), doc: z.unknown() }),
  z.object({ op: z.literal("template"), name: z.string().trim().min(2).max(EDITOR_LIMITS.templateName), doc: z.unknown() }),
]);

/**
 * Layered editor (P10.1, P10.3). `preview` draws one size with render.tsx (free, reduced size),
 * `export` writes the full-size files (1 credit, idempotent by request id), `template` saves the
 * layer layout to the brand. The document is untrusted input and is validated before use.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json(401, { ok: false, message: "Oturumunun süresi doldu. Lütfen yeniden giriş yap." });
  if (Number(req.headers.get("content-length") ?? 0) > 9 * 1024 * 1024) return json(413, { ok: false, message: "Görseller çok büyük. Daha küçük bir ürün görseli dene." });
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 9 * 1024 * 1024) return json(413, { ok: false, message: "Görseller çok büyük. Daha küçük bir ürün görseli dene." });
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, message: "İstek okunamadı. Sayfayı yenileyip yeniden dene." });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json(400, { ok: false, message: "İstek okunamadı. Sayfayı yenileyip yeniden dene." });
  const d = parsed.data;
  const repo = getRepo();
  const key = await hashKey("creative", user.id);
  try {
    if (d.op === "export") {
      if (!rateLimit(`creative-dl:${key}`, 30, 60 * 60_000).ok) return json(429, { ok: false, message: "Bir saatte en fazla 30 indirme yapılabilir. Biraz sonra tekrar dene." });
      const res = await exportDoc(repo, { requestId: d.requestId, doc: d.doc, size: d.size, label: d.label });
      if (!res.ok) return json(400, { ok: false, message: res.error });
      return json(200, { ok: true, href: `/api/generations/${res.generation.id}/files/0`, charged: res.charged });
    }
    const head = parseDoc(d.doc);
    if (!head) return json(400, { ok: false, message: "Düzenleyici verisi okunamadı. Sayfayı yenileyip yeniden dene." });
    const ctx = await docContext(repo, head);
    if (!ctx) return json(404, { ok: false, message: "Marka bulunamadı." });
    const checked = checkDoc(ctx, d.doc);
    if (!checked.ok) return json(400, { ok: false, message: checked.error });
    if (d.op === "template") {
      if (!checked.doc.brandId) return json(400, { ok: false, message: "Şablon bir markaya kaydedilir. Önce bir marka kiti seç." });
      if (!rateLimit(`creative-tpl:${key}`, 60, 60 * 60_000).ok) return json(429, { ok: false, message: "Kısa sürede çok fazla şablon kaydettin. Biraz sonra yeniden dene." });
      const res = await repo.createBrandTemplate({ brandId: checked.doc.brandId, name: d.name, doc: stripAssets(checked.doc) as unknown as Record<string, unknown> });
      if (res.status === "limit") return json(400, { ok: false, message: `Bir markaya en fazla ${EDITOR_LIMITS.templatesPerBrand} şablon kaydedilebilir. Eskilerden birini silip yeniden dene.` });
      if (res.status !== "created") return json(400, { ok: false, message: res.status === "brand_not_found" ? "Marka bulunamadı." : "Şablon kaydedilemedi. Biraz sonra yeniden dene." });
      return json(200, { ok: true, id: res.template.id, name: res.template.name });
    }
    if (!rateLimit(`creative-preview:${user.id}`, 600, 3600_000).ok) return json(429, { ok: false, message: "Kısa sürede çok fazla önizleme istendi. Biraz bekleyip yeniden dene." });
    const { png, warnings } = await renderDoc(ctx, checked.doc, d.size, 0.5);
    return json(200, { ok: true, image: `data:image/png;base64,${Buffer.from(png).toString("base64")}`, warnings, notes: checked.notes });
  } catch {
    console.error("creative editor request failed");
    return json(500, { ok: false, message: "Görsel hazırlanamadı. Biraz sonra yeniden dene; kredin düşmedi." });
  }
}

