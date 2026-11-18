import { formatDateTimeTr } from "@/components/rule-status";
import { DataTable } from "@/components/ui";
import { getAdminRepo } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { REFERRAL_BONUS_CREDITS } from "@/lib/growth/codes";
import { formatTry } from "@/lib/payments/packages";
import { requirePanelUser } from "@/app/panel/guard";
import { CopyLink } from "./copy-link";

export const metadata = { title: "Davet et" };

const STATUS = { pending: "Bekliyor", paid: "Ödendi", reversed: "İade nedeniyle iptal" } as const;

export default async function InvitePage() {
  const user = await requirePanelUser();
  // The user id comes from the verified session; the admin repo only reads this user's rows.
  const o = await getAdminRepo().getInviteOverview(user.id);
  const link = `${siteUrl()}/kayit?davet=${o.inviteCode}`;
  const partnerLink = o.partner ? `${siteUrl()}/kayit?davet=${o.partner.code}` : null;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Davet et</h1>
      <p className="mt-3 max-w-2xl text-body text-ink-soft">
        Bağlantınla kaydolan kişi ilk kredi paketini satın aldığında ikinize de <strong className="text-ink">{REFERRAL_BONUS_CREDITS} kredi</strong> eklenir. Ödül her e-posta adresi için bir kez verilir; ödeme iade edilirse ödül kredisi geri alınır.
      </p>

      <section aria-labelledby="davet-baglanti" className="mt-8 rounded-2xl border border-line bg-card p-5 shadow-card">
        <h2 id="davet-baglanti" className="text-lg font-bold">Davet bağlantın</h2>
        <p className="mt-1 text-small text-ink-soft">Davet kodun: <strong className="tabular text-ink">{o.inviteCode}</strong></p>
        <div className="mt-4"><CopyLink url={link} /></div>
      </section>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Kaydolan" value={String(o.invited)} />
        <Stat label="Ödül kazandıran" value={String(o.rewarded)} />
        <Stat label="Kazandığın kredi" value={String(o.earnedCredits)} />
      </dl>

      {o.partner && partnerLink ? (
        <section aria-labelledby="ortaklik" className="mt-10">
          <h2 id="ortaklik" className="font-display text-2xl font-semibold">Ortaklık</h2>
          <p className="mt-2 max-w-2xl text-body text-ink-soft">
            Ortaklık kodunla gelen müşterilerin her satın alımı için tutarın <strong className="text-ink">%{(o.partner.commissionBp / 100).toLocaleString("tr-TR")}</strong>’i kadar komisyon kaydı tutulur. Ödeme elle ve sözleşmene göre yapılır; buradaki tutarlar kayıttır, ödeme taahhüdü değildir.
          </p>
          <div className="mt-4 rounded-2xl border border-line bg-card p-5">
            <p className="text-small text-ink-soft">Ortaklık kodun: <strong className="tabular text-ink">{o.partner.code}</strong></p>
            <div className="mt-3"><CopyLink url={partnerLink} /></div>
            <p className="mt-4 text-body">Bekleyen komisyon: <strong className="tabular">{formatTry(o.pendingCommissionMinor)}</strong></p>
          </div>
          {o.commissions.length ? (
            <DataTable className="mt-4" label="Komisyon kayıtları tablosu">
              <table className="w-full min-w-[32rem] text-body">
                <thead className="border-b border-line text-left text-meta text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Tarih</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Satış</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Komisyon</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {o.commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatDateTimeTr(c.createdAt)}</td>
                      <td className="px-5 py-3 tabular">{formatTry(c.amountMinor)}</td>
                      <td className="px-5 py-3 font-semibold tabular">{formatTry(c.commissionMinor)}</td>
                      <td className="px-5 py-3">{STATUS[c.status]}{c.isDemo ? " · demo" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          ) : (
            <p className="mt-4 text-small text-muted">Henüz komisyon kaydı yok.</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="kurallar" className="mt-10 rounded-2xl bg-paper-2 p-5 text-small leading-relaxed text-ink-soft">
        <h2 id="kurallar" className="text-body font-bold text-ink">Nasıl işler?</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Kendi hesabını davet edemezsin; aynı e-posta adresi (nokta ve +etiket farkları dahil) ikinci kez davet edilemez.</li>
          <li>Ödül yalnızca davet edilen kişinin ilk satın alımında, bir kez verilir.</li>
          <li>Ödeme iade edilirse ödül kredisi geri alınır; harcanmış kredi bakiyeyi eksiye düşürmez.</li>
          <li>Tüm kredi hareketleri <a href="/panel/krediler" className="font-semibold text-blue">Krediler</a> sayfasındaki defterde görünür.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <dt className="text-meta font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-semibold tabular">{value}</dd>
    </div>
  );
}
