import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { BudgetCalculator } from "./calculator";

const TITLE = "Reklam bütçe ve kâr hesaplama: başa baş ROAS, TBM, BGBM · AdScope";
const DESCRIPTION = "Ürün fiyatı, maliyet, kargo ve komisyondan başa baş ROAS, dönüşüm başına maliyet, tıklama başına maliyet (TBM), bin gösterim maliyeti (BGBM) ve aylık kâr senaryolarını ücretsiz hesapla.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/reklam-butce-hesaplama" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "tr_TR", url: "/reklam-butce-hesaplama" },
};

const FAQ = [
  {
    q: "Başa baş ROAS nedir?",
    a: "Reklamdan gelen ciroyu reklam harcamasına bölünce bulunan orandır. Başa baş ROAS, ürün başına kalan katkı payının reklam harcamasını tam karşıladığı noktadır; bunun altında her satış reklam yüzünden zarar ettirir.",
  },
  {
    q: "TBM ve BGBM ne demek?",
    a: "TBM tıklama başına maliyet, BGBM bin gösterim başına maliyettir. Hesaplayıcı, girdiğin dönüşüm ve tıklama oranlarıyla bu ikisinin en fazla ne kadar olabileceğini gösterir.",
  },
  {
    q: "Sonuçlar kesin mi?",
    a: "Hayır. Hesap girdiğin tahminlere dayanır; gerçek tıklama maliyeti, dönüşüm oranı, iadeler ve vergiler kampanyadan kampanyaya değişir. Sonuçları karar öncesi bir ön fikir olarak kullan.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Reklam bütçe ve kâr hesaplayıcı",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "tr-TR",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function BudgetPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="text-meta font-bold uppercase tracking-wide text-coral-deep">Ücretsiz · üyeliksiz</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.2rem]">Reklam bütçe ve kâr hesaplayıcı</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Ürün başına ne kadar reklam harcayabileceğini, başa baş ROAS&apos;ı ve aylık kâr senaryolarını gör. Hesap tamamen tarayıcında yapılır; girdiğin rakamlar hiçbir yere gönderilmez ve saklanmaz.
      </p>
      <div className="mt-10">
        <BudgetCalculator />
      </div>

      <section aria-labelledby="sss" className="mt-16 max-w-3xl">
        <h2 id="sss" className="font-display text-2xl font-semibold">Sık sorulanlar</h2>
        <dl className="mt-4 grid gap-4">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-2xl border border-line bg-card p-5">
              <dt className="font-bold text-ink">{f.q}</dt>
              <dd className="mt-2 text-body text-ink-soft">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="sonraki" className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-navy-950 p-6 text-paper sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 id="sonraki" className="font-display text-2xl font-semibold">Bütçe hazır, peki reklam metni?</h2>
          <p className="mt-2 max-w-xl text-paper/80">Reddedilen bir reklam bütçeyi boşa harcatır. Metnini yayından önce ücretsiz kontrol et.</p>
        </div>
        <Link href="/reklamim-reddedilir-mi" className={buttonClass("accent", "shrink-0")}>Reklamımı ücretsiz kontrol et</Link>
      </section>
    </div>
  );
}
