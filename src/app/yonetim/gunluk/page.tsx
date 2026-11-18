import { getAdminRepo } from "@/lib/data";
import { requireAdmin } from "../guard";

export const metadata = { title: "Denetim günlüğü" };
const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Istanbul" });
const ACTION: Record<string, string> = { credit_adjustment: "Kredi düzeltmesi", coupon_created: "Kupon oluşturuldu", coupon_disabled: "Kupon kapatıldı" };

export default async function AdminAudit() {
  await requireAdmin();
  const rows = await getAdminRepo().listAudit(200);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Denetim günlüğü</h1>
        <p className="mt-1 text-small text-ink-soft">Yönetici işlemleri. Günlük yalnızca eklenebilir; düzenlenemez ve silinemez.</p>
      </div>
      <ol className="grid gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-card px-4 py-3 text-small">
            <p className="font-semibold">{ACTION[r.action] ?? r.action}</p>
            <p className="text-meta text-muted">
              {dateFmt.format(new Date(r.createdAt))} · yönetici {r.adminId.slice(0, 8)}
              {r.targetUserId ? ` · kullanıcı ${r.targetUserId.slice(0, 8)}` : ""}
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-meta text-ink-soft">{JSON.stringify(r.details)}</pre>
          </li>
        ))}
      </ol>
      {!rows.length ? <p className="text-small text-ink-soft">Henüz kayıt yok.</p> : null}
    </div>
  );
}
