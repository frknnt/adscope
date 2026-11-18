import { getAdminRepo } from "@/lib/data";
import { requireAdmin } from "./guard";
import { daysAgo } from "./time";

export const metadata = { title: "Özet" };

const pct = (a: number, b: number) => (b ? `%${((a / b) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}` : "-");
const ERROR_LABEL: Record<string, string> = { insufficient_credits: "Kredi yetersiz", ai_failed: "Yapay zekâ hatası", engine_failed: "Kural motoru hatası", unknown: "Bilinmiyor" };

export default async function AdminHome() {
  await requireAdmin();
  const repo = getAdminRepo();
  const since = new Date(daysAgo(7)).toISOString();
  const [stats, users, purchases, funnel] = await Promise.all([repo.adminErrorStats(since), repo.adminListUsers(), repo.adminListPurchases(200), repo.adminFunnel(new Date(daysAgo(30)).toISOString())]);
  const paid = purchases.filter((p) => p.status === "paid" && !p.isDemo && p.createdAt >= since);
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Özet</h1>
        <p className="mt-1 text-small text-ink-soft">Son 7 gün. Reklam metinleri ve kreatifler bu panelde gösterilmez.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Analiz", String(stats.analyses.total)],
          ["Analiz hata oranı", pct(stats.analyses.failed, stats.analyses.total)],
          ["Yapay zekâ çağrısı hata oranı", pct(stats.aiRuns.failed + stats.aiRuns.schemaInvalid, stats.aiRuns.total)],
          ["Ücretli satın alma", String(paid.length)],
          ["Kullanıcı (son 200)", String(users.length)],
          ["Şemaya uymayan yapay zekâ yanıtı", String(stats.aiRuns.schemaInvalid)],
          ["Kural motoruna düşülen", String(stats.aiRuns.fallback)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-card p-4">
            <dt className="text-meta font-semibold text-muted">{k}</dt>
            <dd className="mt-1 text-2xl font-bold tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="huni">
        <h2 id="huni" className="text-lg font-bold">Dönüşüm hunisi (son 30 günde açılan hesaplar)</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["Hesap açtı", funnel.signups, null],
            ["İlk analizini tamamladı", funnel.firstAnalysis, pct(funnel.firstAnalysis, funnel.signups)],
            ["İlk satın almayı yaptı", funnel.firstPurchase, pct(funnel.firstPurchase, funnel.signups)],
          ].map(([k, v, p]) => (
            <li key={String(k)} className="rounded-2xl border border-line bg-card p-4">
              <p className="text-meta font-semibold text-muted">{k}</p>
              <p className="mt-1 text-2xl font-bold tabular">{v}{p ? <span className="ml-2 text-body font-semibold text-ink-soft">{p}</span> : null}</p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-small text-ink-soft">
          Sayılar mevcut tablolardan hesaplanır; kişi bazında iz tutulmaz. Kuyrukta bekleyen iş: <span className="font-semibold tabular">{funnel.queuedJobs}</span>, son 30 günde başarısız iş: <span className="font-semibold tabular">{funnel.failedJobs}</span>.
        </p>
      </section>
      <section aria-labelledby="hatalar">
        <h2 id="hatalar" className="text-lg font-bold">Başarısız analizler (hata koduna göre)</h2>
        {Object.keys(stats.analyses.byCode).length ? (
          <ul className="mt-3 grid gap-2">
            {Object.entries(stats.analyses.byCode).map(([code, n]) => (
              <li key={code} className="flex justify-between rounded-xl border border-line bg-card px-4 py-2.5 text-small">
                <span>{ERROR_LABEL[code] ?? code}</span>
                <span className="font-bold tabular">{n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-small text-ink-soft">Son 7 günde başarısız analiz yok.</p>
        )}
      </section>
    </div>
  );
}
