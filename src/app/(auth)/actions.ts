"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { attachInvite } from "@/lib/growth/service";
import { clientIp, hashKey, rateLimit } from "@/lib/security/rate-limit";

export type AuthFormState = { error: string | null; info?: string | null; email?: string };

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-posta veya şifre hatalı.",
  exists: "Bu e-posta ile bir hesap zaten var. Giriş yapmayı deneyin.",
  weak_password: "Şifre en az 8 karakter olmalı ve tahmin edilmesi zor olmalı.",
  not_confirmed: "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki bağlantıya tıklayın.",
  error: "Şu anda işleminizi tamamlayamadık. Lütfen biraz sonra tekrar deneyin.",
};

const emailSchema = z.email("Geçerli bir e-posta adresi girin.").max(254).transform((v) => v.toLowerCase());

async function limited(scope: string, email: string) {
  const h = await headers();
  const ipKey = await hashKey(scope, clientIp(h));
  const emailKey = await hashKey(scope, email);
  const a = rateLimit(ipKey, 20, 10 * 60_000);
  const b = rateLimit(emailKey, 8, 10 * 60_000);
  return !a.ok || !b.ok;
}

function safeNext(raw: FormDataEntryValue | null) {
  const v = typeof raw === "string" ? raw : "";
  // Only same-site relative paths into the panel.
  if (/^\/panel\/ekip\/katil\?davet=[A-Za-z0-9_-]{20,120}$/.test(v)) return v; // team invite link
  return /^\/panel(\/[A-Za-z0-9\-/]*)?$/.test(v) ? v : "/panel";
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = emailSchema.safeParse(form.get("email"));
  const password = String(form.get("password") ?? "");
  if (!email.success) return { error: email.error.issues[0].message, email: String(form.get("email") ?? "") };
  if (!password) return { error: "Şifrenizi girin.", email: email.data };
  if (await limited("signin", email.data)) return { error: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.", email: email.data };

  const res = await getRepo().signIn(email.data, password);
  if (!res.ok) return { error: AUTH_MESSAGES[res.code] ?? AUTH_MESSAGES.error, email: email.data };
  redirect(safeNext(form.get("next")));
}

const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(72, "Şifre en fazla 72 karakter olabilir."),
  terms: z.literal("on", { error: "Devam etmek için kullanım koşullarını kabul edin." }),
  kvkk: z.literal("on", { error: "Devam etmek için KVKK aydınlatma metnini okuduğunuzu onaylayın." }),
  marketing: z.literal("on").optional(),
});

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    terms: form.get("terms") ?? undefined,
    kvkk: form.get("kvkk") ?? undefined,
    marketing: form.get("marketing") ?? undefined,
  });
  const rawEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: rawEmail };
  if (await limited("signup", parsed.data.email)) return { error: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.", email: rawEmail };

  const res = await getRepo().signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    consents: { terms: LEGAL_VERSIONS.terms, kvkk: LEGAL_VERSIONS.kvkk, privacy: LEGAL_VERSIONS.privacy, marketing: parsed.data.marketing === "on" },
  });
  if (!res.ok) return { error: AUTH_MESSAGES[res.code] ?? AUTH_MESSAGES.error, email: rawEmail };
  // Invite or partner code from /kayit?davet=KOD. A bad or repeated code never blocks the signup.
  const invite = form.get("davet");
  if (res.userId && typeof invite === "string" && invite) await attachInvite({ inviteeId: res.userId, inviteeEmail: parsed.data.email, rawCode: invite });
  if (res.needsConfirmation) {
    return { error: null, info: "Hesabın oluşturuldu. E-posta adresine gelen doğrulama bağlantısına tıklayınca 3 ücretsiz kredinle başlayabilirsin.", email: rawEmail };
  }
  redirect("/panel/baslangic");
}

export async function signOutAction() {
  await getRepo().signOut();
  redirect("/");
}
