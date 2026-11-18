import { formatDateTr, RuleStatusPill } from "@/components/rule-status";
import { getRepo } from "@/lib/data";
import { requireAdmin } from "../guard";
import { daysAgo } from "../time";

export const metadata = { title: "Kural kartları" };

export default async function AdminRules() {
  await requireAdmin();
  const rules = (await getRepo().listAllRules()).sort((a, b) => (a.lastVerifiedAt ?? "").localeCompare(b.lastVerifiedAt ?? ""));
  const stale = daysAgo(180);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Kural kartları</h1>
        <p className="mt-1 max-w-3xl text-small text-ink-soft">En eski doğrulanan kart en üstte. 180 günden eski doğrulamalar işaretlenir. Kart durumu ve kaynakları kod deposundaki katalogdan gelir; değişiklik inceleme akışıyla yapılır.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Kural kartları">
        <table className="w-full min-w-[44rem] text-left text-small">
          <thead className="bg-paper-2 text-meta text-muted">
            <tr>
              {["Kart", "Sektör", "Durum", "Son doğrulama", "Kaynak"].map((h) => <th key={h} scope="col" className="px-3 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <th scope="row" className="px-3 py-2.5 font-semibold">
                  <span className="block">{r.title}</span>
                  <span className="font-mono text-meta text-muted">{r.id} · v{r.version}</span>
                </th>
                <td className="px-3 py-2.5">{r.sector}</td>
                <td className="px-3 py-2.5"><RuleStatusPill status={r.status} /></td>
                <td className={`px-3 py-2.5 tabular ${!r.lastVerifiedAt || Date.parse(r.lastVerifiedAt) < stale ? "font-bold text-coral-deep" : ""}`}>{r.lastVerifiedAt ? formatDateTr(r.lastVerifiedAt) : "Yok"}</td>
                <td className="max-w-[16rem] truncate px-3 py-2.5">{r.sourceOrg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
