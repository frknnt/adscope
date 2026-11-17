import { formatDateTimeTr } from "@/components/rule-status";
import { Button } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { demoPurchasesAllowed } from "@/lib/env";
import { getPaymentProviders } from "@/lib/payments";
import { CREDIT_PACKAGES, formatTry } from "@/lib/payments/packages";
import { startCheckoutAction } from "../actions";
import { DemoPurchaseButton } from "../forms";

export const metadata = { title: "Krediler" };

const REASON = { signup_bonus: "Kayıt hediyesi", analysis: "Analiz", purchase: "Satın alma", refund: "İade", admin_adjustment: "Düzeltme" } as const;

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ odeme?: string }> }) {
  await requirePanelUser();
  const repo = getRepo();
  const [balance, ledger, purchases, sp] = await Promise.all([repo.getBalance(), repo.listLedger(), repo.listPurchases(), searchParams]);
  const providers = getPaymentProviders().filter((p) => p.isConfigured());
  const demo = demoPurchasesAllowed();

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Krediler</h1>
      <p className="mt-2 text-ink-soft">
        Bakiye: <strong className="font-display text-2xl text-ink tabular">{balance}</strong> analiz. Bakiye, aşağıdaki değiştirilemez kredi hareketlerinin toplamıdır.
      </p>
      {sp.odeme === "kapali" ? (
        <p role="alert" className="mt-5 rounded-xl bg-coral-tint px-4 py-3 text-[0.92rem] font-medium text-coral-deep">Online ödeme henüz aktif değil.</p>
      ) : null}

      <section aria-labelledby="paketler" className="mt-8">
        <h2 id="paketler" className="font-display text-2xl font-semibold">Kredi paketleri</h2>
        {!providers.length ? (
          <p className="mt-2 text-[0.92rem] text-ink-soft">
            Online ödeme <strong className="text-ink">yakında</strong>. Ödeme sağlayıcısı hesabı bağlandığında buradan güvenli ödeme sayfasına yönlendirileceksin.
            {demo ? " Bu demo ortamında, akışı denemek için ücretsiz demo kredisi ekleyebilirsin; gerçek ödeme alınmaz." : ""}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CREDIT_PACKAGES.map((p) => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-line bg-card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <span className="font-display text-2xl font-semibold tabular">{formatTry(p.priceMinor)}</span>
              </div>
              <p className="mt-1 text-ink-soft"><span className="tabular">{p.credits}</span> analiz · {p.description}</p>
              <div className="mt-5 grid gap-2">
                {providers.map((pr) => (
                  <form key={pr.id} action={startCheckoutAction}>
                    <input type="hidden" name="provider" value={pr.id} />
                    <input type="hidden" name="packageId" value={p.id} />
                    <Button type="submit" className="w-full">{pr.label} ile öde</Button>
                  </form>
                ))}
                {demo ? <DemoPurchaseButton packageId={p.id} label={`Demo: ${p.credits} kredi ekle (ödeme yok)`} /> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="hareketler" className="mt-12">
        <h2 id="hareketler" className="font-display text-2xl font-semibold">Kredi hareketleri</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Kredi hareketleri tablosu">
          <table className="w-full min-w-[32rem] text-[0.9rem]">
            <thead className="border-b border-line text-left text-[0.8rem] text-muted">
              <tr><th scope="col" className="px-5 py-3 font-semibold">Tarih</th><th scope="col" className="px-5 py-3 font-semibold">Açıklama</th><th scope="col" className="px-5 py-3 text-right font-semibold">Değişim</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatDateTimeTr(l.createdAt)}</td>
                  <td className="px-5 py-3">{REASON[l.reason]}{l.note ? <span className="text-ink-soft"> · {l.note}</span> : null}</td>
                  <td className={`px-5 py-3 text-right font-bold tabular ${l.delta > 0 ? "text-green" : "text-ink"}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {purchases.length ? (
        <section aria-labelledby="siparisler" className="mt-12">
          <h2 id="siparisler" className="font-display text-2xl font-semibold">Siparişler</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[0.9rem]">
                <span>{formatDateTimeTr(p.createdAt)} · {p.packageId} · <span className="tabular">{p.credits}</span> kredi</span>
                <span className="text-ink-soft">{p.isDemo ? "Demo (ödeme alınmadı)" : `${formatTry(p.amountMinor)} · ${p.provider}`}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
