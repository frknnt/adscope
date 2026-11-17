import type { Metadata } from "next";
import { QuickCheck } from "./quick-check";

export const metadata: Metadata = {
  title: "Reklamım reddedilir mi? Ücretsiz ön kontrol · AdScope",
  description: "Reklam metnini yapıştır; Meta, Google Ads veya TikTok ret riskini ve Türk reklam mevzuatı açısından riskli ifadeleri üyeliksiz gör.",
};

export default function QuickCheckPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-[0.8rem] font-bold uppercase tracking-wide text-coral-deep">Ücretsiz · üyeliksiz</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.2rem]">Reklamım reddedilir mi?</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Metni yapıştır, platformu seç. Riskli ifadeleri, hangi kural kartına takıldığını ve daha güvenli bir yazımı birkaç saniyede göster. Kesin bir cevap değil;
        yayından önce bakman gerekenlerin listesi.
      </p>
      <div className="mt-10"><QuickCheck /></div>
    </div>
  );
}
