import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/ui";
import { GUIDE_SLUGS } from "@/lib/guides/guides";
import { SECTOR_INFO } from "@/lib/sectors";

export const metadata: Metadata = {
  title: "Sektör rehberleri: reklamda riskli ifadeler · AdScope",
  description: "Takviye gıda, estetik, kozmetik, kurs, emlak ve finans reklamlarında riskli ifadeler, güvenli yazım örnekleri ve resmî kaynaklar.",
  alternates: { canonical: "/rehber" },
};

export default function GuidesIndex() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3rem]">Sektör rehberleri</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">Her rehber AdScope kural kartlarından ve kartların dayandığı resmî kaynaklardan oluşur.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(GUIDE_SLUGS).map(([slug, sector]) => (
          <li key={slug}>
            <Link href={`/rehber/${slug}`} className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 no-underline hover:border-ink">
              <span className="text-lg font-bold text-ink">{SECTOR_INFO[sector].long}</span>
              <span className="mt-1 text-small text-ink-soft">{SECTOR_INFO[sector].note}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Disclaimer className="mt-12" />
    </div>
  );
}
