import { CREDIT_PACKAGES, formatTry, PLAN_REMINDER_DAYS } from "@/lib/payments/packages";

/** Current credit packages, as listed in the pre-contract documents. */
export function PackageTable() {
  return (
    <div tabIndex={0} role="region" aria-label="Paket tablosu" className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left">
        <thead className="border-b border-line text-meta text-muted">
          <tr>
            <th scope="col" className="py-2 pr-4 font-semibold">Paket</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Kredi</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Toplam fiyat</th>
            <th scope="col" className="py-2 font-semibold">Süre ve yenileme</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {CREDIT_PACKAGES.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-4 font-semibold text-ink">{p.name}</td>
              <td className="py-2 pr-4 tabular">{p.plan ? `${p.credits} (marka başına ${p.plan.perBrandCredits})` : p.credits}</td>
              <td className="py-2 pr-4 tabular">{p.plan ? `${formatTry(p.priceMinor)} / ay (marka başına ${formatTry(p.plan.perBrandMinor)})` : formatTry(p.priceMinor)}</td>
              <td className="py-2">{p.plan ? `1 ay; kendiliğinden yenilenmez, bitişten ${PLAN_REMINDER_DAYS} gün önce hatırlatılır` : "Tek seferlik"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
