"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PIN_LIMIT } from "@/lib/data/limits";
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
