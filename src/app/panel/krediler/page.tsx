import { formatDateTimeTr } from "@/components/rule-status";
import { Button, DataTable } from "@/components/ui";
import { getAdminRepo, getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { demoPurchasesAllowed } from "@/lib/env";
import { getPaymentProviders } from "@/lib/payments";
import { CREDIT_PACKAGES, formatTry } from "@/lib/payments/packages";
import { startCheckoutAction } from "../actions";
import { PackageGrid } from "./checkout";
import { releaseCouponAction } from "./coupon-actions";
import { CouponForm } from "./coupon-form";

export const metadata = { title: "Krediler" };

const ODEME_MSG: Record<string, string> = {
  kapali: "Online ödeme henüz aktif değil.",
  "onay-gerekli": "Ödemeye geçmek için ön bilgilendirme formunu okuduğunu ve mesafeli satış sözleşmesini kabul ettiğini işaretle.",
  hata: "Onayın kaydedilemedi, ödeme başlatılmadı. Lütfen tekrar dene.",
};

const REASON = { signup_bonus: "Kayıt hediyesi", analysis: "Analiz", purchase: "Satın alma", refund: "İade", admin_adjustment: "Düzeltme", generation: "Üretim", coupon_bonus: "Kupon", referral_bonus: "Davet ödülü", referral_clawback: "Davet ödülü iadesi" } as const;

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ odeme?: string }> }) {
  const user = await requirePanelUser();
  const repo = getRepo();
  const [balance, ledger, purchases, sp, reservation] = await Promise.all([repo.getBalance(), repo.listLedger(), repo.listPurchases(), searchParams, getAdminRepo().getCouponReservation(user.id)]);
  const reservedPkg = reservation ? CREDIT_PACKAGES.find((p) => p.id === reservation.packageId) : null;
  const providers = getPaymentProviders().filter((p) => p.isConfigured());
  const demo = demoPurchasesAllowed();

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Krediler</h1>
      <div className="mt-6 overflow-hidden rounded-3xl p-6 text-paper shadow-raised sm:p-8" style={{ background: "var(--gradient-brand)" }}>
        <p className="text-small font-semibold text-paper/80">Kredi bakiyesi</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-5xl font-extrabold tabular leading-none">{balance}</span>
          <span className="text-lg font-semibold text-paper/85">analiz</span>
        </p>
        <p className="mt-3 max-w-xl text-small text-paper/85">
          Bakiye: <span className="tabular">{balance}</span> kredi, yaklaşık <span className="tabular">{balance}</span> görsel ya da <span className="tabular">{Math.floor(balance / 2)}</span> video analizi. Bakiye, aşağıdaki değiştirilemez kredi hareketlerinin toplamıdır.
        </p>
      </div>
      {sp.odeme && ODEME_MSG[sp.odeme] ? (
        <p role="alert" className="mt-5 rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{ODEME_MSG[sp.odeme]}</p>
      ) : null}

      <section aria-labelledby="paketler" className="mt-8">
        <h2 id="paketler" className="font-display text-2xl font-semibold">Kredi paketleri</h2>
        {!providers.length ? (
          <p className="mt-2 text-body text-ink-soft">
            Online ödeme <strong className="text-ink">yakında</strong>. Ödeme sağlayıcısı hesabı bağlandığında buradan güvenli ödeme sayfasına yönlendirileceksin.
            {demo ? " Bu demo ortamında, akışı denemek için ücretsiz demo kredisi ekleyebilirsin; gerçek ödeme alınmaz." : ""}
          </p>
        ) : null}
        <div className="mt-4 rounded-2xl border border-line bg-card p-5">
          <h3 className="text-body font-bold">Kupon kodun var mı?</h3>
          <p className="mt-1 text-small text-ink-soft">Kupon, seçtiğin paketi aldığında hesabına ek kredi olarak eklenir. Ödeme tutarı değişmez.</p>
          {reservation ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-green-tint px-4 py-3 text-small text-ink">
              <span>
                <strong>{reservation.code}</strong> ayrıldı: {reservedPkg?.name ?? reservation.packageId} paketini aldığında <strong className="tabular">+{reservation.value}</strong> kredi.
              </span>
              <form action={releaseCouponAction}>
                <button type="submit" className="min-h-11 rounded-lg px-2 font-semibold text-blue hover:underline">Kuponu kaldır</button>
              </form>
            </div>
          ) : null}
          <div className="mt-4"><CouponForm packages={CREDIT_PACKAGES.map((p) => ({ id: p.id, name: p.name }))} /></div>
        </div>
        <PackageGrid packages={CREDIT_PACKAGES} providers={providers.map((pr) => ({ id: pr.id, label: pr.label }))} demo={demo} action={startCheckoutAction} />
      </section>

      <section aria-labelledby="hareketler" className="mt-12">
        <h2 id="hareketler" className="font-display text-2xl font-semibold">Kredi hareketleri</h2>
        <DataTable className="mt-4" label="Kredi hareketleri tablosu">
          <table className="w-full min-w-[32rem] text-body">
            <thead className="border-b border-line text-left text-meta text-muted">
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
        </DataTable>
      </section>

      {purchases.length ? (
        <section aria-labelledby="siparisler" className="mt-12">
          <h2 id="siparisler" className="font-display text-2xl font-semibold">Siparişler</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-body">
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
