import type { Metadata } from "next";
import { ButtonLink, Disclaimer } from "@/components/ui";
import { getAdminRepo } from "@/lib/data";
import type { ActiveCampaign } from "@/lib/data/types";
import { CREDIT_PACKAGES, formatTry } from "@/lib/payments/packages";

export const metadata: Metadata = { title: "Fiyatlandırma · AdScope" };
// The campaign strip must disappear the moment a coupon expires or is used up.
export const dynamic = "force-dynamic";

const dayFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" });

async function activeCampaigns(): Promise<ActiveCampaign[]> {
  try {
    return (await getAdminRepo().listActiveCampaigns()).slice(0, 2);
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const campaigns = await activeCampaigns();
  const plans = [
    { name: "Ücretsiz", price: "0 ₺", credits: 3, note: "Kayıtta bir kez, kart bilgisi gerekmez.", cta: { href: "/kayit", label: "Ücretsiz başla" }, featured: false },
    ...CREDIT_PACKAGES.map((p) => ({
      name: p.name,
      price: formatTry(p.priceMinor),
      credits: p.credits,
      note: p.description,
      cta: { href: "/panel/krediler", label: `${p.name} paketini al` },
      featured: p.id === "profesyonel",
    })),
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      {campaigns.map((c) => (
        <aside key={c.code} aria-label="Aktif kampanya" className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-coral bg-coral-tint px-5 py-4 text-body text-ink">
          <strong className="font-bold">{c.label}</strong>
          <span>
            Krediler sayfasında <strong className="font-mono">{c.code}</strong> kodunu girersen{c.packageIds.length ? ` ${c.packageIds.map((id) => CREDIT_PACKAGES.find((p) => p.id === id)?.name ?? id).join(" ve ")} paketinde` : ""} <strong className="tabular">+{c.value}</strong> ek kredi alırsın.
            {c.expiresAt ? ` Son gün: ${dayFmt.format(new Date(c.expiresAt))}.` : ""}
          </span>
        </aside>
      ))}
      <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.4rem]">Analiz başına öde. Abonelik yok.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Görsel analizi 1 kredi, video/Reels analizi 2 kredidir. Kredi yalnızca rapor başarıyla tamamlandığında düşer; analiz yarıda kalırsa krediniz yerinde kalır.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <section
            key={p.name}
            className={`flex flex-col rounded-2xl border p-6 ${p.featured ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
          >
            <h2 className="font-display text-2xl font-semibold">{p.name}</h2>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold tabular">{p.price}</span>
              <span className={p.featured ? "text-paper/75" : "text-muted"}>/ {p.credits} analiz</span>
            </p>
            <p className={`mt-3 text-body ${p.featured ? "text-paper/85" : "text-ink-soft"}`}>{p.note}</p>
            <ul className={`mt-5 space-y-2 text-body ${p.featured ? "text-paper/90" : "text-ink-soft"}`}>
              <li>Meta ret riski, mevzuat riski, kreatif skoru</li>
              <li>Güvenli metin ve 5 Türkçe varyant</li>
              <li>TR + EN itiraz taslağı</li>
              <li>PDF / yazdırılabilir rapor, geçmiş</li>
            </ul>
            <div className="mt-auto pt-6">
              <ButtonLink href={p.cta.href} variant={p.featured ? "accent" : "primary"} className="w-full">
                {p.cta.label}
              </ButtonLink>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 flex flex-col gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">Ajanslar için</h2>
          <p className="mt-1 text-body text-ink-soft">
            Her pakette çoklu marka, 10 kişiye kadar salt okunur ekip, avukat inceleme bağlantısı, logolu PDF ve API anahtarı var. Krediler hesap sahibinden düşer.
          </p>
        </div>
      </section>

      <section className="mt-14 grid gap-6 border-t border-line pt-10 text-body leading-relaxed text-ink-soft md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-ink">Ödeme nasıl alınıyor?</h2>
          <p className="mt-2">
            Ödemeler barındırılan bir ödeme sayfasında alınır; kart bilgileriniz AdScope sunucularına gelmez. Kredi, ödeme sağlayıcısından gelen imzalı bildirim doğrulandıktan sonra hesabınıza bir kez eklenir.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink">Fiyatlar kesin mi?</h2>
          <p className="mt-2">
            Listelenen fiyatlar KDV dahil tüketici fiyatı olarak planlanmıştır ve ödeme sağlayıcısı aktifleştirildiğinde kesinleşir. Ödeme sayfasında gösterilen tutar geçerlidir.
          </p>
        </div>
      </section>
      <Disclaimer className="mt-10" />
    </div>
  );
}
