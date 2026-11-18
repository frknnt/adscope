import { getAdminRepo } from "@/lib/data";
import { requireAdmin } from "../guard";

export const metadata = { title: "Satın almalar" };
const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" });
const STATUS: Record<string, string> = { paid: "Ödendi", refunded: "İade", ignored: "Yok sayıldı" };

export default async function AdminPurchases() {
  await requireAdmin();
  const rows = await getAdminRepo().adminListPurchases(200);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Satın almalar ve webhook olayları</h1>
        <p className="mt-1 text-small text-ink-soft">İmzası doğrulanmış ödeme olayları. Aynı olay kimliği ikinci kez gelirse kredi eklenmez.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Satın alma olayları">
        <table className="w-full min-w-[48rem] text-left text-small">
          <thead className="bg-paper-2 text-meta text-muted">
            <tr>
              {["Tarih", "Sağlayıcı", "Olay", "Paket", "Kredi", "Tutar", "Durum", "Kullanıcı"].map((h) => <th key={h} scope="col" className="px-3 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-3 py-2.5 tabular">{dateFmt.format(new Date(p.createdAt))}</td>
                <td className="px-3 py-2.5">{p.provider}{p.isDemo ? " (demo)" : ""}</td>
                <td className="max-w-[12rem] truncate px-3 py-2.5 font-mono text-meta">{p.eventId}</td>
                <td className="px-3 py-2.5">{p.packageId}</td>
                <td className="px-3 py-2.5 tabular">{p.credits}</td>
                <td className="px-3 py-2.5 tabular">{(p.amountMinor / 100).toLocaleString("tr-TR", { style: "currency", currency: p.currency })}</td>
                <td className="px-3 py-2.5">{STATUS[p.status] ?? p.status}</td>
                <td className="px-3 py-2.5 font-mono text-meta">{p.userId ? p.userId.slice(0, 8) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="text-small text-ink-soft">Henüz satın alma yok.</p> : null}
    </div>
  );
}
