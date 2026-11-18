import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data";
import { AuthAside } from "../aside";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Kayıt ol · AdScope" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ davet?: string }> }) {
  if (await getCurrentUser()) redirect("/panel");
  const davet = (await searchParams).davet;
  const invite = typeof davet === "string" && /^[A-Za-z0-9-]{6,16}$/.test(davet) ? davet.toUpperCase() : null;
  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-semibold">Ücretsiz hesap oluştur</h1>
        <p className="mt-3 text-ink-soft">E-posta ve şifreyle kaydol; ilk 3 analiz bizden.</p>
        {invite ? (
          <p className="mt-4 rounded-xl bg-paper-2 px-4 py-3 text-small text-ink">
            <strong>{invite}</strong> davet koduyla kaydoluyorsun. İlk kredi paketini aldığında hesabına ek kredi tanımlanır.
          </p>
        ) : null}
        <div className="mt-8">
          <SignUpForm invite={invite} />
        </div>
      </div>
      <AuthAside />
    </>
  );
}
