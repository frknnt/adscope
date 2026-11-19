import Link from "next/link";
import { formatDateTr } from "@/components/rule-status";
import { RULE_CATALOG } from "@/lib/rules/catalog";
import { ruleTrustStats } from "@/lib/rules/stats";

/**
 * Public trust band: counts come from the rule catalog at build/render time, never by hand.
 * Says how many cards were read on an official source and how many passed the lawyer review;
 * it never implies that an ad will be approved.
 */
export function RuleTrustBand({ link = false, className = "" }: { link?: boolean; className?: string }) {
  const s = ruleTrustStats(RULE_CATALOG);
  return (
    <section aria-label="Kural kartı güven göstergesi" className={`rounded-2xl border border-line bg-card px-5 py-4 shadow-card ${className}`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-body text-ink-soft">
          <li>
            <strong className="text-lg font-extrabold tabular text-ink">{s.total}</strong> kural kartı
          </li>
          <li>
            <strong className="text-lg font-extrabold tabular text-ink">{s.active}</strong> tanesi resmî kaynakta doğrulandı
          </li>
          <li>
            {s.lawyerReviewed ? (
              <>
                <strong className="text-lg font-extrabold tabular text-ink">{s.lawyerReviewed}</strong> tanesi hukukçu tarafından doğrulandı
              </>
            ) : (
              "Hukukçu tarafından doğrulanan kart henüz yok"
            )}
          </li>
          <li>
            Son güncelleme <strong className="font-semibold tabular text-ink">{formatDateTr(s.lastUpdated)}</strong>
          </li>
        </ul>
        {link ? (
          <Link href="/kurallar" className="inline-flex min-h-11 items-center text-body font-semibold text-blue sm:ml-auto">
            Kartları ve kaynakları gör
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-meta text-muted">Doğrulama bekleyen kartlar yalnızca bilgilendirme notu üretir. Bu sayılar reklamın onaylanacağı anlamına gelmez.</p>
    </section>
  );
}
