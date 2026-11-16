import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data";
import { AuthAside } from "../aside";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Kayıt ol · AdScope" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/panel");
  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-semibold">Ücretsiz hesap oluştur</h1>
        <p className="mt-3 text-ink-soft">E-posta ve şifreyle kaydol; ilk 3 analiz bizden.</p>
        <div className="mt-8">
          <SignUpForm />
        </div>
      </div>
      <AuthAside />
    </>
  );
}
