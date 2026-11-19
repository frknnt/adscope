import "server-only";
import { zipSync } from "fflate";
import { BRAND_FONT_IDS, type BrandFontId } from "@/lib/brand/kit";
import type { DataRepo, GenerationRecord } from "@/lib/data/types";
import { validateImage } from "@/lib/security/file-validation";
import { CREATIVE_CREDIT_COST } from "./costs";
import { DocSchema, EDITOR_LIMITS, fillTemplate, frameToPlan, frameWarnings, planToFrame, stripAssets, type EditorDoc } from "./editor";
import { loadCreativeFont, type LoadedFont } from "./fonts";
import type { LayoutId, PlanWarning, TextRole } from "./layouts";
import { renderPlanPng } from "./render";
import { creativeContext, planFor, type CreativeContext } from "./service";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, type CreativeSizeId } from "./sizes";
import { cleanForFont } from "./text-fit";

/** Families a text layer may use: the brand kit's typeface, or any bundled family without a brand. */
export function allowedFonts(ctx: CreativeContext): BrandFontId[] {
  return ctx.brandId ? [ctx.font.id] : [...BRAND_FONT_IDS];
}

/** Brand context of a document (colours, logo, typeface). Null when the brand is not the caller's. */
export function docContext(repo: DataRepo, doc: Pick<EditorDoc, "brandId" | "platform" | "sector">) {
  return creativeContext(repo, { brandId: doc.brandId, platform: doc.platform, sector: doc.sector, headline: "", body: "", cta: "" });
}

/** Layout texts as the editor's copy slots. */
export function layoutTexts(ctx: CreativeContext): Partial<Record<TextRole, string>> {
  return { headline: ctx.text.headline, body: ctx.text.body, cta: ctx.text.cta, brand: ctx.kit.brandName ?? "", tagline: ctx.kit.tagline ?? "", note: ctx.kit.note };
}

/** One of the eight layouts, all four sizes, as an editor document. */
export function docFromLayout(ctx: CreativeContext, layout: LayoutId): EditorDoc {
  const texts = layoutTexts(ctx);
  const frames = Object.fromEntries(CREATIVE_SIZE_IDS.map((s) => [s, planToFrame(planFor(ctx, layout, s), texts, ctx.font.id)])) as EditorDoc["frames"];
  return { v: 1, brandId: ctx.brandId, platform: ctx.platform, sector: ctx.sector, frames, assets: {} };
}

/** A saved template with new copy; text that no longer fits shrinks, then shortens (the layouts' rule). */
export function docFromTemplate(ctx: CreativeContext, stored: unknown): EditorDoc | null {
  const parsed = DocSchema.safeParse(stored);
  if (!parsed.success) return null;
  const t = ctx.text;
  const texts: Partial<Record<TextRole, string>> = { headline: t.headline, body: t.body, cta: t.cta };
  return { ...fillTemplate(parsed.data, texts), brandId: ctx.brandId, platform: ctx.platform, sector: ctx.sector };
}

export type DocCheck = { ok: true; doc: EditorDoc; notes: string[] } | { ok: false; error: string };

/**
 * Validates a document sent by the browser: schema, uploaded images (real PNG/JPEG bytes), families
 * the brand allows, and characters the font can draw. Everything in it is untrusted input.
 */
export function checkDoc(ctx: CreativeContext, raw: unknown): DocCheck {
  const parsed = DocSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Düzenleyici verisi okunamadı. Sayfayı yenileyip yeniden dene." };
  const doc = structuredClone(parsed.data);
  for (const [id, url] of Object.entries(doc.assets)) {
    const mime = url.slice(5, url.indexOf(";"));
    const bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    const check = validateImage(new Uint8Array(bytes), mime, 16);
    if (!check.ok || check.meta.width > 4000 || check.meta.height > 4000) return { ok: false, error: `Yüklenen görsel (${id}) okunamadı. PNG ya da JPEG, en fazla 4000 piksel bir dosya dene.` };
  }
  const fonts = allowedFonts(ctx);
  const ms = (f: LoadedFont) => [f.regular.m, f.bold.m];
  let dropped = false;
  for (const s of CREATIVE_SIZE_IDS) {
    for (const l of doc.frames[s].layers) {
      if (l.font && !fonts.includes(l.font)) l.font = ctx.font.id;
      if (l.text) {
        // Measured against the brand font here; other families cover the same Latin + Turkish set.
        const r = cleanForFont(l.text.slice(0, EDITOR_LIMITS.text), ms(ctx.font));
        dropped ||= r.dropped;
        l.text = r.text;
      }
    }
  }
  return { ok: true, doc, notes: dropped ? ["Yazı tipinin çizemediği bazı karakterler (ör. emoji) görselden çıkarıldı."] : [] };
}

async function fontsOf(ctx: CreativeContext, doc: EditorDoc) {
  const ids = new Set<BrandFontId>();
  for (const s of CREATIVE_SIZE_IDS) for (const l of doc.frames[s].layers) if (l.font && l.font !== ctx.font.id) ids.add(l.font);
  const extra = await Promise.all([...ids].map((id) => loadCreativeFont(id)));
  const byId = new Map<BrandFontId, LoadedFont>([[ctx.font.id, ctx.font], ...extra.map((f) => [f.id, f] as const)]);
  return { extra, byId };
}

async function planOf(ctx: CreativeContext, doc: EditorDoc, size: CreativeSizeId) {
  const { extra, byId } = await fontsOf(ctx, doc);
  const plan = frameToPlan(doc, size, {
    measure: (f, w) => {
      const font = byId.get(f) ?? ctx.font;
      return w === 800 ? font.bold.m : font.regular.m;
    },
    defaultFont: ctx.font.id,
    hasLogo: Boolean(ctx.logoDataUrl),
  });
  return { plan, extra };
}

/** Overflow, safe-area and contrast warnings of one size, without drawing it. */
export async function docWarnings(ctx: CreativeContext, doc: EditorDoc, size: CreativeSizeId): Promise<PlanWarning[]> {
  const { plan } = await planOf(ctx, doc, size);
  return frameWarnings(doc, size, plan);
}

export async function renderDoc(ctx: CreativeContext, doc: EditorDoc, size: CreativeSizeId, scale = 1): Promise<{ png: Uint8Array; warnings: PlanWarning[] }> {
  const { plan, extra } = await planOf(ctx, doc, size);
  const png = await renderPlanPng(plan, ctx.font, { scale, logoDataUrl: ctx.logoDataUrl, extraFonts: extra });
  return { png, warnings: frameWarnings(doc, size, plan) };
}

export type DocExportResult = { ok: true; generation: GenerationRecord; charged: number } | { ok: false; error: string };

/**
 * Full-size files of an edited document (one size as PNG or all four in a ZIP), stored privately,
 * recorded and charged one credit in one step. A repeated request id returns the earlier result free.
 * The stored output keeps the layer list (without uploaded images) so the design can be traced.
 */
export async function exportDoc(repo: DataRepo, p: { requestId: string; doc: unknown; size: CreativeSizeId | "hepsi"; label: string }): Promise<DocExportResult> {
  const existing = await repo.getGenerationByRequest(p.requestId);
  if (existing) return existing.kind === "creative" ? { ok: true, generation: existing, charged: 0 } : { ok: false, error: "İstek kimliği başka bir işte kullanılmış." };
  if ((await repo.getBalance()) < CREATIVE_CREDIT_COST) return { ok: false, error: "Bu indirme için 1 kredi gerekiyor. Krediler sayfasından kredi alabilirsin." };
  const head = DocSchema.safeParse(p.doc);
  if (!head.success) return { ok: false, error: "Düzenleyici verisi okunamadı. Sayfayı yenileyip yeniden dene." };
  const ctx = await docContext(repo, head.data);
  if (!ctx) return { ok: false, error: "Marka bulunamadı." };
  const checked = checkDoc(ctx, p.doc);
  if (!checked.ok) return checked;
  const doc = checked.doc;
  const slug = p.label.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "duzenlenmis";
  const sizes = p.size === "hepsi" ? CREATIVE_SIZE_IDS : [p.size];
  const pngs: { name: string; bytes: Uint8Array }[] = [];
  for (const size of sizes) {
    const { w, h } = CREATIVE_SIZES[size];
    pngs.push({ name: `adscope-${slug}-${w}x${h}.png`, bytes: (await renderDoc(ctx, doc, size)).png });
  }
  const file =
    p.size === "hepsi"
      ? { name: `adscope-${slug}-tum-boyutlar.zip`, mime: "application/zip", bytes: zipSync(Object.fromEntries(pngs.map((f) => [f.name, [f.bytes, { level: 0 }]]))) }
      : { name: pngs[0].name, mime: "image/png", bytes: pngs[0].bytes };
  const path = await repo.saveGenerationFile(file.name, file.bytes, file.mime);
  if (!path) return { ok: false, error: "Dosya kaydedilemedi. Biraz sonra yeniden dene." };
  const res = await repo.recordGeneration({
    clientRequestId: p.requestId,
    kind: "creative",
    creditCost: CREATIVE_CREDIT_COST,
    brandId: ctx.brandId,
    platform: ctx.platform,
    output: { layout: slug, size: p.size, editor: true, doc: stripAssets(doc), files: [{ path, name: file.name, mime: file.mime }] },
  });
  if (res.status === "created" || res.status === "exists") {
    if (res.status === "exists") await repo.removeGenerationFiles([path]);
    return { ok: true, generation: res.generation, charged: res.status === "created" ? CREATIVE_CREDIT_COST : 0 };
  }
  await repo.removeGenerationFiles([path]);
  return { ok: false, error: res.status === "insufficient_credits" ? "Bu indirme için 1 kredi gerekiyor." : "Marka bulunamadı." };
}
