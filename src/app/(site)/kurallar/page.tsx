import type { Metadata } from "next";
import { IconExternal } from "@/components/icons";
import { DOMAIN_LABEL, RuleStatusPill, SECTOR_LABEL, formatDateTr } from "@/components/rule-status";
import { Disclaimer } from "@/components/ui";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Kural kartları ve kaynaklar · AdScope" };

const RISK_LABEL = { high: "Yüksek", medium: "Orta", low: "Düşük" } as const;
const REVIEW_LABEL = { pending: "Bekliyor", reviewed: "İncelendi", changes_requested: "Değişiklik istendi" } as const;

export default async function RulesPage() {
  const rules = (await getRepo().listAllRules()).filter((r) => r.status !== "draft" && r.status !== "retired");
  const groups = (["meta_policy", "tr_law"] as const).map((d) => ({ domain: d, rules: rules.filter((r) => r.domain === d) }));
  const active = rules.filter((r) => r.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.4rem]">Kural kartları ve resmî kaynaklar</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft">
        AdScope&apos;un gösterdiği her bulgu aşağıdaki kartlardan birine dayanır. {active} kart aktif: içeriği resmî kaynakta okundu ve kırmızı ya da sarı bayrak üretebilir. &quot;Doğrulama bekliyor&quot; olan kartlar yalnızca bilgilendirme notu üretir; ihlal sayılmaz, risk seviyesini değiştirmez. Hiçbir kart henüz bir hukukçu tarafından incelenmedi.
      </p>

      {groups.map((g) => (
        <section key={g.domain} className="mt-14" aria-labelledby={`h-${g.domain}`}>
          <h2 id={`h-${g.domain}`} className="font-display text-2xl font-semibold">
            {DOMAIN_LABEL[g.domain]} <span className="text-base font-normal text-muted">· {g.rules.length} kart</span>
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {g.rules.map((r) => (
              <article key={r.id} id={r.id} className="flex scroll-mt-24 flex-col rounded-2xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-fine font-semibold text-muted">
                  <span className="tabular tracking-wide">{r.id} · v{r.version}</span>
                  <RuleStatusPill status={r.status} />
                </div>
                <h3 className="mt-2.5 text-lg font-bold leading-snug">{r.title}</h3>
                <p className="mt-2 text-body leading-relaxed text-ink-soft">{r.description}</p>
                {r.riskyExamples.length ? (
                  <p className="mt-3 text-small">
                    <span className="font-semibold">Riskli örnek: </span>
                    {r.riskyExamples.slice(0, 2).map((e, i) => (
                      <span key={e}>
                        {i > 0 ? ", " : ""}
                        <span className="mark-risk">{e}</span>
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-2 text-small"><span className="font-semibold">Güvenli yaklaşım: </span><span className="text-ink-soft">{r.safeFix}</span></p>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-dashed border-line pt-3 text-meta">
                  <dt className="text-muted">Sektör</dt><dd>{SECTOR_LABEL[r.sector]}</dd>
                  <dt className="text-muted">Risk seviyesi</dt><dd>{RISK_LABEL[r.riskLevel]}</dd>
                  <dt className="text-muted">Kaynak</dt><dd>{r.sourceOrg}{r.sourceReference ? ` · ${r.sourceReference}` : ""}</dd>
                  <dt className="text-muted">Yürürlük</dt><dd className="tabular">{formatDateTr(r.effectiveDate)}</dd>
                  <dt className="text-muted">Son doğrulama</dt><dd className="tabular">{formatDateTr(r.lastVerifiedAt)}</dd>
                  <dt className="text-muted">Hukukçu incelemesi</dt><dd>{REVIEW_LABEL[r.legalReviewStatus]}</dd>
                </dl>
                <p className="mt-3 text-meta leading-relaxed text-muted">{r.verificationNote}</p>
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-coral-deep">
                  Resmî kaynak <IconExternal className="size-3.5" aria-hidden />
                  <span className="sr-only">(yeni sekmede açılır)</span>
                </a>
              </article>
            ))}
          </div>
        </section>
      ))}
      <Disclaimer className="mt-14" />
    </div>
  );
}
