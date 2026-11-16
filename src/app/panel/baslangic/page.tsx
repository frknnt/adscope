import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { OnboardingForm } from "../forms";

export const metadata = { title: "Başlangıç" };

export default async function OnboardingPage() {
  await requirePanelUser();
  const repo = getRepo();
  const [profile, balance] = await Promise.all([repo.getProfile(), repo.getBalance()]);
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Hoş geldin. {balance} analiz kredin hazır.</h1>
      <p className="mt-3 text-lg text-ink-soft">İki küçük bilgi, raporlarını sektörüne göre ayarlamamıza yeter. Hepsini sonra Ayarlar&apos;dan değiştirebilirsin.</p>
      <OnboardingForm profile={profile} />
    </div>
  );
}
