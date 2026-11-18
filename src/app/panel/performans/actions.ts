"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { importReport, inspectReport, type Inspection } from "@/lib/performance/service";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";

export type InspectState = { error: string | null; inspection?: Inspection; fileKey?: string };
export type ImportState = { error: string | null; id?: string; note?: string };

async function readFile(form: FormData): Promise<{ name: string; bytes: Uint8Array } | string> {
  const f = form.get("file");
  if (!(f instanceof File) || f.size === 0) return "Bir CSV ya da XLSX dosyası seç.";
  if (f.size > 5 * 1024 * 1024) return "Dosya en fazla 5 MB olabilir.";
  return { name: f.name.slice(0, 200), bytes: new Uint8Array(await f.arrayBuffer()) };
}

export async function inspectReportAction(_prev: InspectState, form: FormData): Promise<InspectState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  if (!rateLimit(`perf-inspect:${await hashKey("perf", user.id)}`, 60, 60 * 60_000).ok) return { error: "Kısa sürede çok fazla dosya yüklendi. Biraz sonra tekrar dene." };
  const file = await readFile(form);
  if (typeof file === "string") return { error: file };
  const res = inspectReport(file.name, file.bytes);
  if (!res.ok) return { error: res.error };
  return { error: null, inspection: res.inspection, fileKey: `${file.name}:${file.bytes.byteLength}` };
}

const importSchema = z.object({
  label: z.string().trim().min(1, "Rapora bir ad ver.").max(120, "Rapor adı en fazla 120 karakter olabilir."),
  mapping: z.string().max(2000),
  share: z.literal("on").optional(),
});

export async function importReportAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun kapanmış. Lütfen yeniden giriş yap." };
  const parsed = importSchema.safeParse({ label: form.get("label") ?? "", mapping: form.get("mapping") ?? "{}", share: form.get("share") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lütfen alanları kontrol et." };
  if (!rateLimit(`perf-import:${await hashKey("perf", user.id)}`, 20, 60 * 60_000).ok) return { error: "Bir saatte en fazla 20 rapor içe aktarılabilir." };
  const file = await readFile(form);
  if (typeof file === "string") return { error: file };
  let mapping: Record<string, unknown>;
  try {
    const m = JSON.parse(parsed.data.mapping) as unknown;
    mapping = m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
  } catch {
    return { error: "Sütun eşleştirmesi okunamadı." };
  }
  try {
    const res = await importReport(getRepo(), { name: file.name, bytes: file.bytes, mapping, label: parsed.data.label, shareConsent: parsed.data.share === "on" });
    if (!res.ok) return { error: res.error };
    revalidatePath("/panel/performans");
    const notes = [res.ignoredCells ? `${res.ignoredCells} hücrede sayı yerine formül ya da metin vardı; bunlar 0 sayıldı.` : "", res.skippedRows ? `${res.skippedRows} özet ya da adsız satır atlandı.` : ""].filter(Boolean).join(" ");
    return { error: null, id: res.id, note: notes || undefined };
  } catch {
    console.error("[performance] import_failed");
    return { error: "Rapor içe aktarılamadı. Lütfen tekrar dene." };
  }
}

export async function setShareConsentAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await getRepo().setPerformanceShareConsent(id, form.get("on") === "1");
  revalidatePath("/panel/performans");
}

export async function deleteImportAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await getRepo().deletePerformanceImport(id);
  revalidatePath("/panel/performans");
}
