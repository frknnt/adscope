import type { Metadata } from "next";
import { IconExternal } from "@/components/icons";
import { DOMAIN_LABEL, RuleStatusPill, SECTOR_LABEL, formatDateTr } from "@/components/rule-status";
import { SegmentedLinks } from "@/components/panel-ui";
import { RuleTrustBand } from "@/components/rule-trust-band";
import { Disclaimer } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { matchesRuleStatusFilter, parseRuleStatusFilter, type RuleStatusFilter } from "@/lib/rules/stats";

export const metadata: Metadata = { title: "Kural kartları ve kaynaklar · AdScope" };

const RISK_LABEL = { high: "Yüksek", medium: "Orta", low: "Düşük" } as const;
const REVIEW_LABEL = { pending: "Bekliyor", reviewed: "İncelendi", changes_requested: "Değişiklik istendi" } as const;

const FILTER_LABEL: Record<RuleStatusFilter, string> = { hepsi: "Tümü", dogrulandi: "Doğrulandı", inceleme: "İncelemede" };
const FILTER_HREF: Record<RuleStatusFilter, string> = { hepsi: "/kurallar", dogrulandi: "/kurallar?durum=dogrulandi", inceleme: "/kurallar?durum=inceleme" };

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ durum?: string | string[] }> }) {
  const filter = parseRuleStatusFilter((await searchParams).durum);
  const all = (await getRepo().listAllRules()).filter((r) => matchesRuleStatusFilter(r, "hepsi"));
  const rules = all.filter((r) => matchesRuleStatusFilter(r, filter));
  const groups = (["meta_policy", "tr_law"] as const).map((d) => ({ domain: d, rules: rules.filter((r) => r.domain === d) })).filter((g) => g.rules.length);
  const count = (f: RuleStatusFilter) => all.filter((r) => matchesRuleStatusFilter(r, f)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.4rem]">Kural kartları ve resmî kaynaklar</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft">
        AdScope&apos;un gösterdiği her bulgu aşağıdaki kartlardan birine dayanır. Aktif kartların içeriği resmî kaynakta okundu; bu kartlar kırmızı ya da sarı bayrak üretebilir. &quot;Doğrulama bekliyor&quot; olan kartlar yalnızca bilgilendirme notu üretir; ihlal sayılmaz, risk seviyesini değiştirmez.
      </p>
      <RuleTrustBand className="mt-8" />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <SegmentedLinks
          label="Kart durumu"
          items={(["hepsi", "dogrulandi", "inceleme"] as const).map((f) => ({ href: FILTER_HREF[f], label: `${FILTER_LABEL[f]} (${count(f)})`, active: filter === f }))}
        />
        <p className="text-small text-muted" aria-live="polite">{rules.length} kart gösteriliyor.</p>
      </div>

      {groups.map((g) => (
        <section key={g.domain} className="mt-10" aria-labelledby={`h-${g.domain}`}>
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
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-1 text-sm font-semibold text-coral-deep">
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
