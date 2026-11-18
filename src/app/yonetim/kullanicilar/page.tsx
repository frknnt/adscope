import { inputClass } from "@/components/ui";
import { getAdminRepo } from "@/lib/data";
import { requireAdmin } from "../guard";
import { AdjustForm } from "./adjust-form";

export const metadata = { title: "Kullanıcılar" };
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const users = await getAdminRepo().adminListUsers(q);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Kullanıcılar ve krediler</h1>
        <p className="mt-1 max-w-3xl text-small text-ink-soft">Kredi düzeltmesi kredi defterine “yönetici düzeltmesi” olarak yazılır ve silinemez; her düzeltme denetim günlüğüne de işlenir. Gerekçe zorunludur.</p>
      </div>
      <form method="get" className="flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">E-postaya göre ara</label>
        <input id="q" name="q" defaultValue={q} placeholder="E-postaya göre ara" className={inputClass} />
        <button type="submit" className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold">Ara</button>
      </form>
      <ul className="grid gap-3" aria-label="Kullanıcılar">
        {users.map((u) => (
          <li key={u.id} className="grid gap-3 rounded-2xl border border-line bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-end">
            <div className="min-w-0">
              <p className="break-all font-semibold">{u.email}</p>
              <p className="text-meta text-muted">
                Kayıt {dateFmt.format(new Date(u.createdAt))} · {u.analyses} analiz · bakiye <strong className="tabular text-ink">{u.balance}</strong>
              </p>
            </div>
            <AdjustForm userId={u.id} email={u.email} />
          </li>
        ))}
      </ul>
      {!users.length ? <p className="text-small text-ink-soft">Kullanıcı bulunamadı.</p> : null}
    </div>
  );
}
