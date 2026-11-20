import type { Metadata } from "next";
import Link from "next/link";
import { CreditExamples, PricingTerms } from "@/components/pricing-terms";
import { ButtonLink, Disclaimer } from "@/components/ui";
import { getAdminRepo } from "@/lib/data";
import type { ActiveCampaign } from "@/lib/data/types";
import { AGENCY_FEATURES, AGENCY_PACKAGES, AGENCY_PER_BRAND_CREDITS, AGENCY_PER_BRAND_MINOR, CREDIT_PACKAGES, formatTry, PLAN_REMINDER_DAYS, SIGNUP_BONUS_CREDITS } from "@/lib/payments/packages";

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
    { name: "Ücretsiz", price: "0 ₺", credits: SIGNUP_BONUS_CREDITS, note: "Kayıtta bir kez, kart bilgisi gerekmez.", cta: { href: "/kayit", label: "Ücretsiz başla" }, featured: false },
    ...CREDIT_PACKAGES.filter((p) => !p.plan).map((p) => ({
      name: p.name,
      price: formatTry(p.priceMinor),
      credits: p.credits,
      note: p.description,
      cta: { href: "/panel/krediler", label: `${p.name} paketini al` },
      featured: p.id === "profesyonel",
    })),
    {
      name: "Ajans",
      price: formatTry(AGENCY_PACKAGES[0].priceMinor),
      credits: AGENCY_PACKAGES[0].credits,
      note: `Aylık, ${AGENCY_PACKAGES[0].plan!.brands} markadan başlar: marka başına ${formatTry(AGENCY_PER_BRAND_MINOR)} ve ${AGENCY_PER_BRAND_CREDITS} kredi. Kendiliğinden yenilenmez.`,
      cta: { href: "#ajans-paketi", label: "Ajans paketini incele" },
      featured: false,
    },
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
      <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.4rem]">Analiz başına öde. Otomatik yenileme yok.</h1>
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
              <span className={p.featured ? "text-paper/75" : "text-muted"}>/ {p.credits} analiz{p.name === "Ajans" ? " · ay" : ""}</span>
            </p>
            <p className={`mt-3 text-body ${p.featured ? "text-paper/85" : "text-ink-soft"}`}>{p.note}</p>
            <CreditExamples credits={p.credits} className={`mt-2 ${p.featured ? "text-paper/85" : "text-muted"}`} />
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

      <section id="ajans-paketi" aria-labelledby="ajans-baslik" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-card p-6 sm:p-8">
        <h2 id="ajans-baslik" className="font-display text-2xl font-semibold">Ajans paketi: aylık, marka başına</h2>
        <p className="mt-2 max-w-3xl text-body text-ink-soft">
          Marka başına ayda {formatTry(AGENCY_PER_BRAND_MINOR)} ve {AGENCY_PER_BRAND_CREDITS} kredi. Her ödeme bir aylık dönem açar ve krediler hesaba hemen eklenir. Paket kendiliğinden yenilenmez,
          kartından otomatik çekim yapılmaz: dönem bitmeden {PLAN_REMINDER_DAYS} gün önce e-postayla hatırlatırız, istersen Krediler sayfasından tek tıkla yenilersin. Erken yenilersen yeni ay, mevcut dönemin bittiği andan başlar.
        </p>
        <div tabIndex={0} role="region" aria-label="Ajans paketi fiyat tablosu" className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-body">
            <caption className="sr-only">Ajans paketi fiyatları</caption>
            <thead className="border-b border-line text-meta text-muted">
              <tr><th scope="col" className="py-2 pr-4 font-semibold">Marka</th><th scope="col" className="py-2 pr-4 font-semibold">Aylık fiyat</th><th scope="col" className="py-2 font-semibold">Aylık kredi</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {AGENCY_PACKAGES.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 font-semibold text-ink tabular">{p.plan!.brands} marka</td>
                  <td className="py-2 pr-4 tabular">{formatTry(p.priceMinor)}</td>
                  <td className="py-2 tabular">{p.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-5 grid gap-2 text-body text-ink-soft sm:grid-cols-2">
          {AGENCY_FEATURES.map((f) => <li key={f}>{f} dahil</li>)}
        </ul>
        <ButtonLink href="/panel/krediler#ajans-paketi" variant="primary" className="mt-6">Ajans paketini al</ButtonLink>
      </section>

      <PricingTerms className="mt-14" />

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
        <div>
          <h2 className="text-lg font-bold text-ink">İptal nasıl olur?</h2>
          <p className="mt-2">
            Otomatik yenilenen abonelik olmadığı için iptal etmen gereken bir şey yok. Kredi paketleri tek seferlik ödemedir; Ajans paketi aylıktır ama kendiliğinden yenilenmez, yenilemediğin sürece ücret alınmaz. Cayma hakkı ve iade koşulları <Link href="/mesafeli-satis-sozlesmesi" className="font-semibold text-blue">mesafeli satış sözleşmesinde</Link> yazar.
          </p>
        </div>
      </section>
      <Disclaimer className="mt-10" />
    </div>
  );
}
