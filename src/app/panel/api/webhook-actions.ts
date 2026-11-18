"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminRepo, getCurrentUser } from "@/lib/data";
import { WEBHOOK_LIMIT } from "@/lib/data/limits";
import { newWebhookSecret, validateWebhookUrl } from "@/lib/webhooks/sign";
import type { ActionState } from "../actions";

export async function createWebhookAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturumun sona erdi. Yeniden giriş yap." };
  const url = validateWebhookUrl(String(form.get("url") ?? ""));
  if (!url) return { error: "Adres https:// ile başlamalı, 443 dışında port ya da yerel ağ adresi içermemeli." };
  const secret = newWebhookSecret();
  const res = await getAdminRepo().createWebhook(user.id, url, secret);
  if (res === "limit") return { error: `En fazla ${WEBHOOK_LIMIT} webhook adresi eklenebilir. Kullanmadığın birini sil.` };
  if (res !== "ok") return { error: "Webhook eklenemedi. Lütfen tekrar dene." };
  revalidatePath("/panel/api");
  return { error: null, ok: "Webhook eklendi. İmza anahtarı yalnızca şimdi gösteriliyor; güvenli bir yere kaydet.", link: secret };
}

export async function deleteWebhookAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) await getAdminRepo().deleteWebhook(user.id, id.data);
  revalidatePath("/panel/api");
}
