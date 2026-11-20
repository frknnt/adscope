import { creditExamples, CREDIT_USES } from "@/lib/payments/credit-uses";
import { SIGNUP_BONUS_CREDITS } from "@/lib/payments/packages";

/**
 * Promises on how credits are charged. Each one is checked against the code (see
 * tests/unit/pricing-terms.test.ts); a promise the code does not keep must not be added here.
 * Credit expiry is deliberately left out until the owner decides on it.
 */
export const PRICING_TERMS: { title: string; body: string }[] = [
  { title: `Kart istemeden ${SIGNUP_BONUS_CREDITS} ücretsiz kredi`, body: `Kayıt olduğunda hesabına bir kez ${SIGNUP_BONUS_CREDITS} kredi eklenir. Kart bilgisi istenmez.` },
  { title: "Otomatik yenileme yok", body: "Kredi paketleri tek seferlik ödemedir. Ajans paketi aylıktır ama kendiliğinden yenilenmez ve karttan otomatik çekim yapılmaz; bitişten önce hatırlatırız, istersen yenilersin." },
  { title: "Kredi yalnızca iş bitince düşer", body: "Analiz yarıda kalırsa ya da üretim başarısız olursa kredin yerinde kalır. Aynı istek iki kez gelirse bir kez düşer." },
  { title: "Önizleme ücretsiz, indirme kredili", body: "Şablonlu görsellerin önizlemesi ücretsizdir. Tam boyutlu dosyayı indirdiğinde kredi düşer." },
];

export function PricingTerms({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="ucretlendirme" className={className}>
      <h2 id="ucretlendirme" className="font-display text-2xl font-semibold">Nasıl ücretlendiriyoruz</h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {PRICING_TERMS.map((t) => (
          <li key={t.title} className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <h3 className="text-body font-bold text-ink">{t.title}</h3>
            <p className="mt-1.5 text-body leading-relaxed text-ink-soft">{t.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-2xl border border-dashed border-line-strong px-5 py-4">
        <h3 className="text-body font-bold text-ink">Bir kredi ne eder?</h3>
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-body text-ink-soft">
          {CREDIT_USES.map((u) => (
            <li key={u.id}>
              1 {u.label}: <strong className="tabular text-ink">{u.credits}</strong> kredi
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** "This package covers, for example, …" line next to a credit package. */
export function CreditExamples({ credits, className = "" }: { credits: number; className?: string }) {
  const ex = creditExamples(credits);
  return (
    <p className={`text-small ${className}`}>
      Örneğin {ex.map((e, i) => (
        <span key={e.id}>
          {i > 0 ? (i === ex.length - 1 ? " ya da " : ", ") : ""}
          <span className="tabular">{e.count}</span> {e.label}
        </span>
      ))}
      .
    </p>
  );
}
