import { getAdminRepo } from "@/lib/data";
import { CREDIT_PACKAGES, formatTry } from "@/lib/payments/packages";
import { toggleCouponAction } from "../actions";
import { requireAdmin } from "../guard";
import { CouponCreateForm, PartnerForm } from "./forms";

export const metadata = { title: "Kupon ve ortaklık" };
const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeZone: "Europe/Istanbul" });
const KIND: Record<string, string> = { bonus_credits: "Ek kredi", percent: "Yüzde", fixed: "Sabit" };
const STATUS: Record<string, string> = { pending: "Bekliyor", paid: "Ödendi", reversed: "İptal" };

function valueLabel(kind: string, value: number) {
  if (kind === "bonus_credits") return `+${value} kredi`;
  if (kind === "percent") return `%${value}`;
  return formatTry(value);
}

export default async function AdminCoupons() {
  await requireAdmin();
  const repo = getAdminRepo();
  const [coupons, commissions] = await Promise.all([repo.listCoupons(), repo.adminListCommissions(200)]);
  return (
    <div className="grid gap-10">
      <section aria-labelledby="yeni-kupon" className="grid gap-4">
        <div>
          <h1 id="yeni-kupon" className="font-display text-3xl font-semibold">Kupon oluştur</h1>
          <p className="mt-1 max-w-3xl text-small text-ink-soft">
            Kuponlar satın alma sırasında sunucuda ayrılır; toplam ve kişi başı sınırlar eşzamanlı isteklerde de korunur. Shopier her paket için sabit bir ödeme bağlantısı kullandığından ödeme tutarı değiştirilemez; bu yüzden şu an yalnızca ek kredi kuponları kullanılabilir.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5"><CouponCreateForm packages={CREDIT_PACKAGES.map((p) => ({ id: p.id, name: p.name }))} /></div>
      </section>

      <section aria-labelledby="kuponlar" className="grid gap-3">
        <h2 id="kuponlar" className="text-xl font-bold">Kuponlar</h2>
        {coupons.length ? (
          <div className="overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Kupon listesi">
            <table className="w-full min-w-[52rem] text-left text-small">
              <thead className="bg-paper-2 text-meta text-muted">
                <tr>{["Kod", "Tür", "Değer", "Paket", "Geçerlilik", "Kullanım", "Kampanya", "Durum"].map((h) => <th key={h} scope="col" className="px-3 py-2.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2.5 font-mono font-semibold">{c.code}</td>
                    <td className="px-3 py-2.5">{KIND[c.kind]}</td>
                    <td className="px-3 py-2.5 tabular">{valueLabel(c.kind, c.value)}</td>
                    <td className="px-3 py-2.5">{c.packageIds.length ? c.packageIds.join(", ") : "Tümü"}</td>
                    <td className="px-3 py-2.5 tabular">{dateFmt.format(new Date(c.startsAt))} – {c.expiresAt ? dateFmt.format(new Date(c.expiresAt)) : "süresiz"}</td>
                    <td className="px-3 py-2.5 tabular">{c.redeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""} · kişi başı {c.perUserLimit}</td>
                    <td className="px-3 py-2.5">{c.campaignLabel ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <form action={toggleCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                        <button type="submit" className="min-h-11 rounded-lg px-2 font-semibold text-blue hover:underline" aria-label={`${c.code} kuponunu ${c.active ? "durdur" : "etkinleştir"}`}>
                          {c.active ? "Aktif · durdur" : "Durduruldu · etkinleştir"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-small text-muted">Henüz kupon yok.</p>
        )}
      </section>

      <section aria-labelledby="ortaklik" className="grid gap-4">
        <div>
          <h2 id="ortaklik" className="text-xl font-bold">Ortaklık kodu</h2>
          <p className="mt-1 max-w-3xl text-small text-ink-soft">Ajanslara ayrı bir kod verilir. Kodla gelen müşterilerin her satın alımında komisyon kaydı tutulur; ödeme elle yapılır. Her işlem denetim günlüğüne yazılır.</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5"><PartnerForm /></div>
        {commissions.length ? (
          <div className="overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Komisyon kayıtları">
            <table className="w-full min-w-[40rem] text-left text-small">
              <thead className="bg-paper-2 text-meta text-muted">
                <tr>{["Tarih", "Ortak", "Satış", "Oran", "Komisyon", "Durum"].map((h) => <th key={h} scope="col" className="px-3 py-2.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2.5 tabular">{dateFmt.format(new Date(c.createdAt))}</td>
                    <td className="px-3 py-2.5">{c.partnerEmail ?? c.partnerId}</td>
                    <td className="px-3 py-2.5 tabular">{formatTry(c.amountMinor)}</td>
                    <td className="px-3 py-2.5 tabular">%{(c.commissionBp / 100).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2.5 font-semibold tabular">{formatTry(c.commissionMinor)}</td>
                    <td className="px-3 py-2.5">{STATUS[c.status]}{c.isDemo ? " · demo" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
