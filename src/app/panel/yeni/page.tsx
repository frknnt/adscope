import { ButtonLink } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { AnalysisWizard } from "./wizard";

export const metadata = { title: "Yeni analiz" };

export default async function NewAnalysisPage() {
  await requirePanelUser();
  const repo = getRepo();
  const [profile, brands, balance] = await Promise.all([repo.getProfile(), repo.listBrands(), repo.getBalance()]);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Yeni analiz</h1>
      <p className="mt-2 text-ink-soft">Yedi adım, yaklaşık bir dakika. Yüklediğin içerik model eğitiminde kullanılmaz.</p>
      {balance < 1 ? (
        <div className="mt-8 rounded-2xl border border-line bg-card px-6 py-8">
          <p className="font-display text-2xl font-semibold">Kredin kalmadı.</p>
          <p className="mt-2 text-ink-soft">Yeni analiz başlatmak için kredi yükle. Tamamlanan raporların Geçmiş&apos;te durmaya devam eder.</p>
          <ButtonLink href="/panel/krediler" variant="accent" className="mt-5">Kredi yükle</ButtonLink>
        </div>
      ) : (
        <AnalysisWizard brands={brands.map((b) => ({ id: b.id, name: b.name, sector: b.sector }))} defaultSector={profile?.defaultSector ?? "genel"} balance={balance} />
      )}
    </div>
  );
}
