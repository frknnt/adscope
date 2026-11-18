import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconExternal } from "@/components/icons";
import { formatDateTr, RuleStatusPill } from "@/components/rule-status";
import { Disclaimer } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { buildGuide, GUIDE_SLUGS, isGuideSlug } from "@/lib/guides/guides";
import { QuickCheck } from "../../reklamim-reddedilir-mi/quick-check";

export function generateStaticParams() {
  return Object.keys(GUIDE_SLUGS).map((sektor) => ({ sektor }));
}
export const dynamicParams = false;

async function load(slug: string) {
  if (!isGuideSlug(slug)) return null;
  return buildGuide(slug, await getRepo().listAllRules());
}

export async function generateMetadata({ params }: { params: Promise<{ sektor: string }> }): Promise<Metadata> {
  const g = await load((await params).sektor);
  if (!g) return {};
  const url = `/rehber/${g.slug}`;
  return { title: `${g.title} · AdScope`, description: g.description, alternates: { canonical: url }, openGraph: { title: g.title, description: g.description, type: "article", locale: "tr_TR", url } };
}

export default async function GuidePage({ params }: { params: Promise<{ sektor: string }> }) {
  const g = await load((await params).sektor);
  if (!g) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    inLanguage: "tr-TR",
    dateModified: g.lastVerified ?? undefined,
    citation: g.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Konum" className="text-small text-muted">
        <Link href="/rehber">Sektör rehberleri</Link> / <span aria-current="page">{g.label}</span>
      </nav>
      <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-[3rem]">{g.title}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft">
        Bu sayfa AdScope&apos;un {g.label.toLocaleLowerCase("tr-TR")} kural kartlarından oluşturulur. Her madde bir karta, her kart resmî bir kaynağa dayanır.
        {g.lastVerified ? <> Kartların en son doğrulandığı tarih: <time dateTime={g.lastVerified}>{formatDateTr(g.lastVerified)}</time>.</> : null}
      </p>
      <p className="mt-3 max-w-3xl text-small text-ink-soft">
        <span className="font-semibold text-ink">Doğrulanmadı</span> etiketli maddeler, resmî metni henüz doğrulanamamış kartlardan gelir; ihlal sayılmaz, yalnızca dikkat edilmesi önerilir.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="riskli">
          <h2 id="riskli" className="font-display text-2xl font-semibold">Sık reddedilen ya da riskli ifadeler</h2>
          <ul className="mt-4 grid gap-2">
            {g.risky.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
                <span className="text-body text-ink">&ldquo;{r.text}&rdquo;</span>
                <a href={`/kurallar#${r.ruleId}`} className="shrink-0 text-meta font-semibold">{r.verified ? r.ruleId : `${r.ruleId} · doğrulanmadı`}</a>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="guvenli">
          <h2 id="guvenli" className="font-display text-2xl font-semibold">Daha güvenli yazım örnekleri</h2>
          <p className="mt-2 text-small text-ink-soft">AdScope&apos;un güvenli metin önerisiyle, aynı kartın örneklerinden üretildi. Ürününe uymayan bir iddiayı ekleme.</p>
          <ul className="mt-4 grid gap-2">
            {g.safe.map((s, i) => (
              <li key={i} className="rounded-xl border border-line bg-card px-4 py-3 text-body">
                <p className="text-ink-soft line-through decoration-coral/60">{s.from}</p>
                <p className="mt-1 text-ink">
                  <span className="mr-1.5 rounded-md bg-green-tint px-1.5 py-0.5 text-fine font-bold text-green">Daha güvenli</span>
                  {s.to}
                </p>
                {!s.verified ? <p className="mt-1 text-meta text-muted">Doğrulanmadı</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="kartlar" className="mt-14">
        <h2 id="kartlar" className="font-display text-2xl font-semibold">İlgili kural kartları</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[...g.cards, ...g.general].map((r) => (
            <article key={r.id} className="flex flex-col rounded-2xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-fine font-semibold text-muted">
                <span className="tabular">{r.id}</span>
                <RuleStatusPill status={r.status} />
              </div>
              <h3 className="mt-2 text-lg font-bold leading-snug">{r.title}</h3>
              <p className="mt-2 text-body leading-relaxed text-ink-soft">{r.description}</p>
              <p className="mt-auto pt-3 text-small">
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold">
                  {r.sourceOrg}: {r.sourceTitle} <IconExternal className="size-3.5" aria-hidden />
                  <span className="sr-only">(yeni sekmede açılır)</span>
                </a>
                {r.lastVerifiedAt ? <span className="block text-meta text-muted">Son doğrulama: {formatDateTr(r.lastVerifiedAt)}</span> : null}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="kaynaklar" className="mt-14">
        <h2 id="kaynaklar" className="font-display text-2xl font-semibold">Resmî kaynaklar</h2>
        <ul className="mt-4 grid gap-2 text-body">
          {g.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                {s.org}: {s.title} <IconExternal className="size-3.5" aria-hidden />
                <span className="sr-only">(yeni sekmede açılır)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kontrol" className="mt-16">
        <h2 id="kontrol" className="font-display text-2xl font-semibold">Reklam metnini ücretsiz kontrol et</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">Üyelik gerekmez; metin saklanmaz.</p>
        <div className="mt-6"><QuickCheck defaultSector={g.sector} /></div>
      </section>
      <Disclaimer className="mt-12" />
    </div>
  );
}
