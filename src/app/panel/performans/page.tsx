import Link from "next/link";
import { requirePanelUser } from "@/app/panel/guard";
import { RiskBadge } from "@/components/panel-ui";
import { Disclaimer } from "@/components/ui";
import { getRepo } from "@/lib/data";
import type { PerformanceRow } from "@/lib/data/types";
import { bestAndWorst, metricsOf, riskVsPerformance, totals, type RankBy } from "@/lib/performance/report";
import { deleteImportAction, setShareConsentAction } from "./actions";
import { ImportForm } from "./import-form";

export const metadata = { title: "Performans" };

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
const n0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const n2 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const pct = (v: number | null) => (v === null ? "-" : `%${n2.format(v * 100)}`);
const RANK_LABEL: Record<RankBy, string> = { roas: "ROAS", cpa: "dönüşüm başına maliyet", ctr: "tıklama oranı" };
const LEVEL_LABEL = { low: "Düşük ret riski", medium: "Orta ret riski", high: "Yüksek ret riski" } as const;

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const sp = await searchParams;
  const repo = getRepo();
  const imports = await repo.listPerformanceImports();
  const wanted = typeof sp.rapor === "string" && /^[0-9a-f-]{36}$/i.test(sp.rapor) ? sp.rapor : imports[0]?.id;
  const report = wanted ? await repo.getPerformanceImport(wanted) : null;
  const note = typeof sp.not === "string" ? sp.not.slice(0, 300) : null;

  let view: null | {
    money: (v: number | null) => string;
    t: ReturnType<typeof totals>;
    rank: ReturnType<typeof bestAndWorst<PerformanceRow & { risk: { level: "low" | "medium" | "high"; score: number | null } | null }>>;
    byRisk: ReturnType<typeof riskVsPerformance>;
    matched: number;
  } = null;
  if (report) {
    const money = (v: number | null) => (v === null ? "-" : new Intl.NumberFormat("tr-TR", { style: "currency", currency: report.import.currency, maximumFractionDigits: 2 }).format(v));
    const analyses = new Map((await repo.listAnalyses(500)).map((a) => [a.id, a]));
    const rows = report.rows.map((r) => {
      const a = r.analysisId ? analyses.get(r.analysisId) : undefined;
      return { ...r, risk: a?.metaRiskLevel ? { level: a.metaRiskLevel, score: a.metaRiskScore } : null };
    });
    view = {
      money,
      t: totals(rows),
      rank: bestAndWorst(rows),
      byRisk: riskVsPerformance(rows.map((r) => ({ ...r, riskLevel: r.risk?.level ?? null }))),
      matched: rows.filter((r) => r.risk).length,
    };
  }

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Performans</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Meta Reklam Yöneticisi&apos;nden dışa aktardığın raporu yükle; hesap bağlamadan harcama, tıklama, dönüşüm ve ROAS&apos;ı gör, AdScope analizlerinin ret riskiyle karşılaştır.
      </p>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <ImportForm />
          <details className="rounded-2xl border border-line bg-card p-4 text-small text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">Raporu nasıl dışa aktarırım?</summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              <li>Reklam Yöneticisi&apos;nde Reklamlar sekmesine geç ve tarih aralığını seç.</li>
              <li>Sütunlara harcanan tutar, gösterim, bağlantı tıklamaları, satın almalar ve dönüşüm değerini ekle. Metinle eşleştirme için Gövde ve Başlık (reklam ayarları) sütunlarını da ekleyebilirsin.</li>
              <li>Dışa aktar menüsünden CSV ya da Excel (.xlsx) olarak indir ve buraya yükle.</li>
            </ol>
          </details>
          {imports.length ? (
            <section aria-labelledby="raporlar">
              <h2 id="raporlar" className="text-lg font-bold">İçe aktarılan raporlar</h2>
              <ul className="mt-3 grid gap-2">
                {imports.map((i) => (
                  <li key={i.id}>
                    <Link href={`/panel/performans?rapor=${i.id}#rapor`} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-small no-underline ${i.id === report?.import.id ? "border-blue bg-blue-tint/40" : "border-line bg-card hover:border-line-strong"}`}>
                      <span className="min-w-0 truncate font-semibold text-ink">{i.label}</span>
                      <span className="shrink-0 text-meta text-muted">{i.adCount} reklam</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <section id="rapor" aria-labelledby="rapor-baslik" className="min-w-0">
          {!report || !view ? (
            <p className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-10 text-center text-ink-soft">Henüz rapor yok. Soldan bir dışa aktarım dosyası yükle.</p>
          ) : (
            <div className="grid gap-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="rapor-baslik" className="font-display text-2xl font-semibold">{report.import.label}</h2>
                  <p className="mt-1 text-small text-muted">
                    {report.import.adCount} reklam
                    {report.import.periodStart ? ` · ${dateFmt.format(new Date(report.import.periodStart))} – ${report.import.periodEnd ? dateFmt.format(new Date(report.import.periodEnd)) : ""}` : ""} · {view.matched} reklam AdScope analiziyle eşleşti
                  </p>
                </div>
                <form action={deleteImportAction}>
                  <input type="hidden" name="id" value={report.import.id} />
                  <button type="submit" className="min-h-11 rounded-xl border border-line px-4 text-small font-semibold text-coral-deep hover:border-coral-deep">Raporu sil</button>
                </form>
              </div>
              {note ? <p className="rounded-xl bg-info-tint px-4 py-3 text-small text-info">{note}</p> : null}

              <dl className="grid gap-3 sm:grid-cols-3 2xl:grid-cols-6">
                {[
                  ["Harcama", view.money(view.t.spend)],
                  ["Gösterim", n0.format(view.t.impressions)],
                  ["Tıklama oranı (TO)", pct(view.t.ctr)],
                  ["Tıklama başına (TBM)", view.money(view.t.cpc)],
                  ["Bin gösterim (BGBM)", view.money(view.t.cpm)],
                  ["ROAS", view.t.roas === null ? "-" : `${n2.format(view.t.roas)}x`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-line bg-card p-4">
                    <dt className="text-meta font-semibold text-muted">{k}</dt>
                    <dd className="mt-1 text-xl font-bold tabular text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-small text-ink-soft">
                Dönüşüm: {n2.format(view.t.conversions)} · dönüşüm başına maliyet: {view.money(view.t.cpa)}
              </p>

              <section aria-labelledby="risk-perf">
                <h3 id="risk-perf" className="text-lg font-bold">Ret riski skoru ile performans</h3>
                {view.matched ? (
                  <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Risk düzeyine göre performans tablosu">
                    <table className="w-full min-w-[30rem] text-left text-small">
                      <thead className="bg-paper-2 text-meta text-muted">
                        <tr>
                          <th scope="col" className="px-4 py-3">Risk düzeyi</th>
                          <th scope="col" className="px-4 py-3">Reklam</th>
                          <th scope="col" className="px-4 py-3">TO</th>
                          <th scope="col" className="px-4 py-3">Dönüşüm başına</th>
                          <th scope="col" className="px-4 py-3">ROAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.byRisk.map((g) => (
                          <tr key={g.level} className="border-t border-line">
                            <th scope="row" className="px-4 py-3 font-semibold">{LEVEL_LABEL[g.level]}</th>
                            <td className="px-4 py-3 tabular">{g.ads}</td>
                            <td className="px-4 py-3 tabular">{g.ads ? pct(g.ctr) : "-"}</td>
                            <td className="px-4 py-3 tabular">{g.ads ? view.money(g.cpa) : "-"}</td>
                            <td className="px-4 py-3 tabular">{g.ads && g.roas !== null ? `${n2.format(g.roas)}x` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-small text-ink-soft">Bu rapordaki reklamların metni AdScope analizlerinle eşleşmedi. Eşleştirme için dışa aktarıma Gövde ve Başlık sütunlarını ekle ya da reklamı yayından önce AdScope&apos;ta analiz et.</p>
                )}
                <p className="mt-2 text-meta text-muted">Az sayıda reklamla yapılan karşılaştırma tesadüfi olabilir; neden-sonuç ilişkisi göstermez.</p>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                {([["En iyi 5", view.rank.best], ["En kötü 5", view.rank.worst]] as const).map(([title, list]) => (
                  <section key={title} aria-label={`${title} reklam`}>
                    <h3 className="text-lg font-bold">{title} <span className="text-small font-semibold text-muted">({RANK_LABEL[view.rank.basis]} sırasına göre)</span></h3>
                    {list.length ? (
                      <ol className="mt-3 grid gap-2">
                        {list.map((r) => {
                          const m = metricsOf(r);
                          return (
                            <li key={r.id} className="rounded-xl border border-line bg-card p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 break-words font-semibold text-ink">{r.adName}</p>
                                {r.risk ? <RiskBadge level={r.risk.level} score={r.risk.score} className="shrink-0" /> : null}
                              </div>
                              <p className="mt-1 text-meta text-ink-soft tabular">
                                Harcama {view.money(r.spend)} · TO {pct(m.ctr)} · Dönüşüm başına {view.money(m.cpa)} · ROAS {m.roas === null ? "-" : `${n2.format(m.roas)}x`}
                              </p>
                              {r.analysisId ? <Link href={`/panel/analiz/${r.analysisId}`} className="mt-1 inline-block text-meta font-semibold">Analizi aç</Link> : null}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="mt-2 text-small text-ink-soft">Karşılaştırma için en az 100 gösterim almış yeterli reklam yok.</p>
                    )}
                  </section>
                ))}
              </div>

              <form action={setShareConsentAction} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 text-small">
                <input type="hidden" name="id" value={report.import.id} />
                <input type="hidden" name="on" value={report.import.shareConsent ? "0" : "1"} />
                <p className="min-w-0 flex-1 text-ink-soft">
                  Skor ağırlıklarının iyileştirilmesine anonim katkı: <strong className="text-ink">{report.import.shareConsent ? "açık" : "kapalı"}</strong>. Açıkken yalnızca risk düzeyi ve oranlar gibi toplamlar, reklam adı ve hesap bilgisi olmadan kullanılabilir.
                </p>
                <button type="submit" className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink hover:border-ink">{report.import.shareConsent ? "Katkıyı kapat" : "Katkıyı aç"}</button>
              </form>
              <Disclaimer />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
