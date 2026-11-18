import type { Metadata } from "next";
import Link from "next/link";
import { verifyUnsubscribe } from "@/lib/email/links";
import { unsubscribeAction } from "./actions";

export const metadata: Metadata = { title: "E-posta tercihleri · AdScope", robots: { index: false, follow: false } };

export default async function EmailPreferences({ searchParams }: { searchParams: Promise<{ u?: string; t?: string; durum?: string }> }) {
  const sp = await searchParams;
  const valid = verifyUnsubscribe(sp.u, sp.t);
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold leading-tight">E-posta tercihleri</h1>
      {sp.durum === "tamam" ? (
        <p role="status" className="mt-6 rounded-xl bg-green-tint px-4 py-3 text-body text-ink">
          Tamam. Karşılama e-postaları, sezon hatırlatmaları ve kampanya e-postaları artık gönderilmeyecek. Şifre sıfırlama gibi hesap e-postaları gelmeye devam eder.
        </p>
      ) : valid ? (
        <form action={unsubscribeAction} className="mt-6 grid gap-4">
          <input type="hidden" name="u" value={sp.u} />
          <input type="hidden" name="t" value={sp.t} />
          <p className="text-body text-ink-soft">Bu bağlantı, AdScope&apos;tan gelen bilgilendirme ve kampanya e-postalarını kapatır. Hesabın ve raporların etkilenmez.</p>
          <button type="submit" className="min-h-11 justify-self-start rounded-xl bg-ink px-5 text-small font-semibold text-paper">Tüm e-postalardan çık</button>
        </form>
      ) : (
        <p className="mt-6 text-body text-ink-soft">
          {sp.durum === "gecersiz" ? "Bu bağlantı geçerli değil. " : ""}E-posta tercihlerini giriş yaptıktan sonra <Link href="/panel/ayarlar" className="font-semibold text-blue">Ayarlar</Link> sayfasından değiştirebilirsin.
        </p>
      )}
    </div>
  );
}
