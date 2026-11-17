import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data";
import { AuthAside } from "../aside";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Giriş · AdScope" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; durum?: string }> }) {
  if (await getCurrentUser()) redirect("/panel");
  const sp = await searchParams;
  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-semibold">Giriş yap</h1>
        <p className="mt-3 text-ink-soft">Raporlarına ve kredi bakiyene devam et.</p>
        {sp.durum === "dogrulama-hatasi" ? (
          <p role="alert" className="mt-6 rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">
            Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Giriş yapmayı deneyin veya yeniden kaydolun.
          </p>
        ) : null}
        <div className="mt-8">
          <SignInForm next={sp.next} />
        </div>
      </div>
      <AuthAside />
    </>
  );
}
