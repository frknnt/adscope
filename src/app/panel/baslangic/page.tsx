import Link from "next/link";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { OnboardingForm } from "../forms";
import { Stepper } from "@/components/ui";
import { SiteOnboarding } from "./site-onboarding";

export const metadata = { title: "Başlangıç" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const repo = getRepo();
  const [profile, balance] = await Promise.all([repo.getProfile(), repo.getBalance()]);
  const noSite = (await searchParams).site === "yok";
  return (
    <div className="mx-auto max-w-2xl">
      <Stepper steps={noSite ? ["Marka, sektör ve ton", "İlk analiz"] : ["Siten", "Öneriler", "İlk paket"]} current={0} label="Başlangıç adımları" />
      <div className="mt-5 rounded-3xl border border-line bg-card p-6 shadow-raised sm:p-8">
        {noSite ? (
          <>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Hoş geldin. {balance} analiz kredin hazır.</h1>
            <p className="mt-3 text-ink-soft">İki küçük bilgi, raporlarını sektörüne göre ayarlamamıza yeter. Hepsini sonra Ayarlar&apos;dan değiştirebilirsin.</p>
            <OnboardingForm profile={profile} />
            <p className="mt-4 text-center text-small">
              <Link href="/panel/baslangic" className="font-semibold text-ink-soft">Sitem var, adresle başla</Link>
              <span className="mx-2 text-muted" aria-hidden>·</span>
              <Link href="/panel" className="font-semibold text-ink-soft">Şimdilik atla</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Hoş geldin. {balance} analiz kredin hazır.</h1>
            <p className="mt-3 mb-6 text-ink-soft">
              <strong className="text-ink">Tek soru: siten ne?</strong> Adresini yaz; marka kitini, sektörünü ve sitende dikkat çeken ilk ifadeleri aynı ekranda gösterelim. Onaylarsan ilk kampanya paketin bu adresle hazırlanır.
            </p>
            <SiteOnboarding balance={balance} />
            <p className="mt-6 text-center text-small">
              <Link href="/panel" className="font-semibold text-ink-soft">Şimdilik atla</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
