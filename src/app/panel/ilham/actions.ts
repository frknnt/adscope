"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PIN_LIMIT, WATCH_LIMIT } from "@/lib/data/limits";
import { isLibraryCountry } from "@/lib/ads-library/meta";

export type PinState = { status: "idle" | "saved" | "exists" | "error"; message?: string };

const pinSchema = z.object({
  adArchiveId: z.string().regex(/^[0-9]{1,30}$/),
  pageName: z.string().trim().max(200).default(""),
  title: z.string().trim().max(300).default(""),
  body: z.string().trim().max(2200).default(""),
  country: z.string().refine(isLibraryCountry),
  deliveryStart: z.iso.date().optional().or(z.literal("")),
  note: z.string().trim().max(300, "Not en fazla 300 karakter olabilir.").default(""),
});

export async function savePinAction(_prev: PinState, form: FormData): Promise<PinState> {
  if (!(await getCurrentUser())) redirect("/giris");
  const parsed = pinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Kaydedilemedi." };
  const d = parsed.data;
  const r = await getRepo().savePin({ ...d, deliveryStart: d.deliveryStart || null });
  if (r === "limit") return { status: "error", message: `Panoda en fazla ${PIN_LIMIT} reklam tutulabilir. Eski kayıtları sil.` };
  if (r === "error") return { status: "error", message: "Kaydedilemedi. Biraz sonra tekrar dene." };
  revalidatePath("/panel/ilham");
  return { status: r === "exists" ? "exists" : "saved" };
}

export async function deletePinAction(form: FormData) {
  if (!(await getCurrentUser())) redirect("/giris");
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getRepo().deletePin(id.data);
  revalidatePath("/panel/ilham");
}

export type WatchState = { error: string | null; ok?: boolean };

const watchSchema = z.object({
  term: z.string().trim().min(2, "En az 2 karakterlik bir sayfa adı ya da anahtar kelime yaz.").max(100, "En fazla 100 karakter olabilir."),
  country: z.string().refine(isLibraryCountry, "Geçerli bir ülke seç."),
});

export async function addWatchAction(_prev: WatchState, form: FormData): Promise<WatchState> {
  if (!(await getCurrentUser())) redirect("/giris");
  const parsed = watchSchema.safeParse({ term: String(form.get("term") ?? "").replace(/[\u0000-\u001F]/g, " "), country: form.get("country") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kaydedilemedi." };
  const r = await getRepo().addWatch(parsed.data.term.replace(/\s+/g, " "), parsed.data.country);
  if (r === "limit") return { error: `En fazla ${WATCH_LIMIT} arama izlenebilir. Birini silip tekrar dene.` };
  if (r === "exists") return { error: "Bu aramayı zaten izliyorsun." };
  if (r === "error") return { error: "Kaydedilemedi. Biraz sonra tekrar dene." };
  revalidatePath("/panel/ilham");
  return { error: null, ok: true };
}

export async function deleteWatchAction(form: FormData) {
  if (!(await getCurrentUser())) redirect("/giris");
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getRepo().deleteWatch(id.data);
  revalidatePath("/panel/ilham");
}
