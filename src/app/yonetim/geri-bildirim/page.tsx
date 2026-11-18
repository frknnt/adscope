import { getAdminRepo } from "@/lib/data";
import { requireAdmin } from "../guard";

export const metadata = { title: "Geri bildirimler" };
const pct = (a: number, b: number) => (b ? `%${((a / b) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}` : "-");

export default async function AdminFeedback() {
  await requireAdmin();
  const rows = await getAdminRepo().adminFeedbackStats();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Uyarı geri bildirimleri</h1>
        <p className="mt-1 max-w-3xl text-small text-ink-soft">Kullanıcıların “yanlış uyarı” işaretleri kural kartına göre gruplanır. Yanlış pozitif oranı yüksek kartlar önce gözden geçirilmeli. Reklam metinleri gösterilmez.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Kural kartına göre geri bildirim">
        <table className="w-full min-w-[40rem] text-left text-small">
          <thead className="bg-paper-2 text-meta text-muted">
            <tr>
              {["Kural kartı", "Toplam", "Yanlış", "Belirsiz", "Faydalı", "Yanlış pozitif oranı"].map((h) => <th key={h} scope="col" className="px-3 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ruleId} className="border-t border-line">
                <th scope="row" className="px-3 py-2.5 font-semibold">
                  <span className="block">{r.title}</span>
                  <span className="font-mono text-meta text-muted">{r.ruleId}</span>
                </th>
                <td className="px-3 py-2.5 tabular">{r.total}</td>
                <td className="px-3 py-2.5 tabular">{r.wrong}</td>
                <td className="px-3 py-2.5 tabular">{r.unclear}</td>
                <td className="px-3 py-2.5 tabular">{r.helpful}</td>
                <td className={`px-3 py-2.5 font-bold tabular ${r.wrong / r.total >= 0.3 ? "text-coral-deep" : ""}`}>{pct(r.wrong, r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="text-small text-ink-soft">Henüz geri bildirim yok.</p> : null}
    </div>
  );
}
