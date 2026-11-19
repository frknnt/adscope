import type { Metadata } from "next";
import { VariantPaste } from "@/components/variant-paste";
import { PASTE_MAX } from "@/lib/variants/paste";
import { quickVariantAction } from "./actions";
import { QuickCheck } from "./quick-check";

export const metadata: Metadata = {
  title: "Reklamım reddedilir mi? Ücretsiz ön kontrol · AdScope",
  description: "Reklam metnini yapıştır; Meta, Google Ads veya TikTok ret riskini ve Türk reklam mevzuatı açısından riskli ifadeleri üyeliksiz gör.",
};

export default function QuickCheckPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-meta font-bold uppercase tracking-wide text-coral-deep">Ücretsiz · üyeliksiz</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.2rem]">Reklamım reddedilir mi?</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Metni yapıştır, platformu seç. Riskli ifadeleri, hangi kural kartına takıldığını ve daha güvenli bir yazımı birkaç saniyede göster. Kesin bir cevap değil;
        yayından önce bakman gerekenlerin listesi.
      </p>
      <div className="mt-10"><QuickCheck /></div>

      <section id="varyantlar" aria-labelledby="varyant-baslik" className="mt-20 scroll-mt-24">
        <h2 id="varyant-baslik" className="max-w-3xl font-display text-3xl font-semibold leading-tight">Platformun ürettiği varyantları yapıştır</h2>
        <p className="mt-3 mb-8 max-w-2xl text-ink-soft">
          Reklam platformlarının yapay zekâ araçları (ör. Meta Advantage+ kreatif önerileri, Google Ads Asset Studio, TikTok Symphony) hızlıca metin varyantı yazıyor, ama Türk reklam
          mevzuatını kontrol etmiyor. En fazla {PASTE_MAX.public} varyantı satır satır yapıştır; hangisinin riskli olduğunu ve güvenli sürümünü gör. Panelde tek seferde{" "}
          {PASTE_MAX.panel} varyanta kadar kontrol edebilirsin.
        </p>
        <VariantPaste action={quickVariantAction} max={PASTE_MAX.public} publicMode />
      </section>
    </div>
  );
}
