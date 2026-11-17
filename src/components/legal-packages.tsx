import { CREDIT_PACKAGES, formatTry } from "@/lib/payments/packages";

/** Current credit packages, as listed in the pre-contract documents. */
export function PackageTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[24rem] text-left">
        <thead className="border-b border-line text-meta text-muted">
          <tr>
            <th scope="col" className="py-2 pr-4 font-semibold">Paket</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Kredi</th>
            <th scope="col" className="py-2 font-semibold">Toplam fiyat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {CREDIT_PACKAGES.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-4 font-semibold text-ink">{p.name}</td>
              <td className="py-2 pr-4 tabular">{p.credits}</td>
              <td className="py-2 tabular">{formatTry(p.priceMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
