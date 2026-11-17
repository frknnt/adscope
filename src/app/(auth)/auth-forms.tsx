"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { signInAction, signUpAction, type AuthFormState } from "./actions";

const initial: AuthFormState = { error: null };

function FormMessage({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">
        {state.error}
      </p>
    );
  }
  if (state.info) {
    return (
      <p role="status" className="rounded-xl bg-green-tint px-4 py-3 text-body font-medium text-green">
        {state.info}
      </p>
    );
  }
  return null;
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? "/panel"} />
      <Field label="E-posta" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
      </Field>
      <Field label="Şifre" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="mt-1 h-12">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
      <p className="text-body text-ink-soft">
        Hesabın yok mu? <Link href="/kayit" className="font-semibold text-coral-deep">Ücretsiz kaydol</Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  if (state.info) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage state={state} />
        <Link href="/giris" className="font-semibold text-coral-deep">Giriş sayfasına git</Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="E-posta" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
      </Field>
      <Field label="Şifre" htmlFor="password" hint="En az 8 karakter.">
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
      </Field>
      <fieldset className="flex flex-col gap-3 text-body leading-snug text-ink-soft">
        <legend className="sr-only">Onaylar</legend>
        <label className="flex gap-3">
          <input type="checkbox" name="terms" required className="mt-0.5 size-4.5 shrink-0 accent-ink" />
          <span>
            <Link href="/kullanim-kosullari" target="_blank" className="font-semibold text-ink">Kullanım koşullarını</Link> ve{" "}
            <Link href="/gizlilik" target="_blank" className="font-semibold text-ink">gizlilik politikasını</Link> kabul ediyorum.
          </span>
        </label>
        <label className="flex gap-3">
          <input type="checkbox" name="kvkk" required className="mt-0.5 size-4.5 shrink-0 accent-ink" />
          <span>
            <Link href="/kvkk" target="_blank" className="font-semibold text-ink">KVKK aydınlatma metnini</Link> okudum.
          </span>
        </label>
        <label className="flex gap-3">
          <input type="checkbox" name="marketing" className="mt-0.5 size-4.5 shrink-0 accent-ink" />
          <span>Ürün güncellemeleri ve kampanyalar için e-posta almak istiyorum. (İsteğe bağlı)</span>
        </label>
      </fieldset>
      <Button type="submit" variant="accent" disabled={pending} className="mt-1 h-12">
        {pending ? "Hesap oluşturuluyor…" : "Hesap oluştur, 3 krediyi al"}
      </Button>
      <p className="text-body text-ink-soft">
        Zaten hesabın var mı? <Link href="/giris" className="font-semibold text-coral-deep">Giriş yap</Link>
      </p>
    </form>
  );
}
