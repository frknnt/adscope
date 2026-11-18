"use server";

import { redirect } from "next/navigation";
import { getAdminRepo } from "@/lib/data";
import { verifyUnsubscribe } from "@/lib/email/links";

export async function unsubscribeAction(form: FormData) {
  const u = form.get("u");
  const t = form.get("t");
  if (!verifyUnsubscribe(u, t)) redirect("/e-posta-tercihleri?durum=gecersiz");
  await getAdminRepo().unsubscribeEmails(u);
  redirect("/e-posta-tercihleri?durum=tamam");
}
