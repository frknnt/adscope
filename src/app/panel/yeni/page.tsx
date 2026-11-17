import { ButtonLink } from "@/components/ui";
import { speechToTextAvailable } from "@/lib/analysis/service";
import { findTemplate } from "@/lib/calendar/templates";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { AnalysisWizard } from "./wizard";

export const metadata = { title: "Yeni analiz" };

export default async function NewAnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const repo = getRepo();
  const [profile, brands, balance, sp] = await Promise.all([repo.getProfile(), repo.listBrands(), repo.getBalance(), searchParams]);
  const template = findTemplate(typeof sp.sablon === "string" ? sp.sablon : null);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Yeni analiz</h1>
      <p className="mt-2 text-ink-soft">Yedi adım, yaklaşık bir dakika. Yüklediğin içerik model eğitiminde kullanılmaz.</p>
      {template ? (
        <p className="mt-4 max-w-3xl rounded-xl bg-info-tint px-4 py-3 text-body text-info">
          <strong>{template.title}</strong> şablonuyla başladın. Köşeli parantezli alanları kendi bilgilerinle değiştir; şablon bir başlangıç noktasıdır, analiz yine de yapılır.
        </p>
      ) : null}
      {balance < 1 ? (
        <div className="mt-8 rounded-2xl border border-line bg-card px-6 py-8">
          <p className="font-display text-2xl font-semibold">Kredin kalmadı.</p>
          <p className="mt-2 text-ink-soft">Yeni analiz başlatmak için kredi yükle. Tamamlanan raporların Geçmiş&apos;te durmaya devam eder.</p>
          <ButtonLink href="/panel/krediler" variant="accent" className="mt-5">Kredi yükle</ButtonLink>
        </div>
      ) : (
        <AnalysisWizard
          brands={brands.map((b) => ({ id: b.id, name: b.name, sector: b.sector }))}
          defaultSector={profile?.defaultSector ?? "genel"}
          balance={balance}
          speechEnabled={speechToTextAvailable()}
          initial={
            template
              ? { headline: template.headline, primaryText: template.primaryText, description: template.description, sector: template.sector, templateTitle: template.title }
              : sp.tur === "video"
                ? { media: "video" }
                : undefined
          }
        />
      )}
    </div>
  );
}
