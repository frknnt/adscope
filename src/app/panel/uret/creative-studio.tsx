import Link from "next/link";
import { RiskBadge } from "@/components/panel-ui";
import { buttonClass, Disclaimer, inputClass, selectClass } from "@/components/ui";
import { getRepo } from "@/lib/data";
import type { Brand } from "@/lib/data/types";
import { LAYOUTS } from "@/lib/creative/layouts";
import { creativeQueryString, parseCreativeQuery } from "@/lib/creative/request";
import { docFromTemplate, docWarnings } from "@/lib/creative/editor-service";
import { creativeContext, CREATIVE_LIMITS, scoreCreative, warningsFor } from "@/lib/creative/service";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES } from "@/lib/creative/sizes";
import { PLATFORM_IDS, PLATFORM_SHORT } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { deleteTemplateAction } from "./creative-actions";
import { CreativeDownload } from "./creative-download";

const LEGAL_LABEL = { low: "düşük", medium: "orta", high: "yüksek" } as const;

export async function CreativeStudio({ sp, brands, defaultSector, balance }: { sp: Record<string, string | string[] | undefined>; brands: Brand[]; defaultSector: Sector; balance: number }) {
  const q = parseCreativeQuery((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));
  if (!sp.sektor) q.sektor = defaultSector;
  const brand = brands.find((b) => b.id === q.marka) ?? null;
  const repo = getRepo();
  const ctx = q.baslik ? await creativeContext(repo, { brandId: brand?.id ?? null, platform: q.platform, sector: q.sektor, headline: q.baslik, body: q.metin, cta: q.cta }) : null;
  const score = ctx ? await scoreCreative(repo, ctx) : null;
  const size = CREATIVE_SIZES[q.boyut];
  // Brand templates (P10.3) appear next to the eight layouts; new copy is placed into each.
  const templates = ctx && brand ? await repo.listBrandTemplates(brand.id) : [];
  const templateCards = ctx
    ? (
        await Promise.all(
          templates.map(async (t) => {
            const doc = docFromTemplate(ctx, t.doc);
            return doc ? { t, warnings: await docWarnings(ctx, doc, q.boyut) } : null;
          }),
        )
      ).filter((x) => x !== null)
    : [];
  const cardFoot = (label: string, query: string, warnings: { kind: string; message: string }[], extra?: React.ReactNode) => (
    <>
      {warnings.length ? (
        <ul className="grid gap-1.5" aria-label={`${label}: uyarılar`}>
          {warnings.map((w, i) => <li key={`${w.kind}-${i}`} className="rounded-lg bg-amber-tint px-3 py-2 text-meta text-ink">{w.message}</li>)}
        </ul>
      ) : (
        <p className="text-meta text-green">Taşma, güvenli alan ve kontrast sorunu yok.</p>
      )}
      <div className="mt-auto grid gap-2">
        <Link href={`/panel/uret/duzenle?${query}`} className="inline-flex min-h-10 w-fit items-center rounded-xl bg-ink px-3.5 text-small font-semibold text-paper no-underline hover:bg-navy-700">
          Düzenle<span className="sr-only">: {label}</span>
        </Link>
        {extra}
      </div>
    </>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <form method="get" action="/panel/uret" className="grid content-start gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
        <input type="hidden" name="sekme" value="gorsel" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cr-baslik" className="text-sm font-semibold text-ink">Başlık</label>
          <input id="cr-baslik" name="baslik" required maxLength={CREATIVE_LIMITS.headline} defaultValue={q.baslik} className={inputClass} placeholder="ör. Sabah kahven artık evde" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cr-metin" className="text-sm font-semibold text-ink">Kısa metin (isteğe bağlı)</label>
          <textarea id="cr-metin" name="metin" rows={3} maxLength={CREATIVE_LIMITS.body} defaultValue={q.metin} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-cta" className="text-sm font-semibold text-ink">Çağrı (isteğe bağlı)</label>
            <input id="cr-cta" name="cta" maxLength={CREATIVE_LIMITS.cta} defaultValue={q.cta || brand?.preferredCta || ""} className={inputClass} placeholder="ör. Hemen incele" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-marka" className="text-sm font-semibold text-ink">Marka kiti</label>
            <select id="cr-marka" name="marka" defaultValue={brand?.id ?? ""} className={selectClass}>
              <option value="">Markasız (AdScope renkleri)</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <p className="text-meta text-muted">Renk, yazı tipi, logo, slogan ve zorunlu ibareler marka kitinden gelir.</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cr-sektor" className="text-sm font-semibold text-ink">Sektör</label>
          <select id="cr-sektor" name="sektor" defaultValue={q.sektor} className={selectClass}>
            {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
          </select>
          <p className="text-meta text-muted">Marka seçiliyse kural kontrolünde markanın sektörü kullanılır.</p>
        </div>
        <fieldset>
          <legend className="text-small font-semibold text-ink">Platform</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORM_IDS.map((p) => (
              <label key={p} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-small font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                <input type="radio" name="platform" value={p} defaultChecked={q.platform === p} className="accent-ink" />
                {PLATFORM_SHORT[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-small font-semibold text-ink">Önizleme boyutu</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {CREATIVE_SIZE_IDS.map((s) => (
              <label key={s} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-small has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                <input type="radio" name="boyut" value={s} defaultChecked={q.boyut === s} className="accent-ink" />
                <span>
                  <span className="block font-semibold text-ink">{CREATIVE_SIZES[s].label}</span>
                  <span className="block text-meta text-muted">{CREATIVE_SIZES[s].w}×{CREATIVE_SIZES[s].h}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className={buttonClass("accent")}>Önizlemeleri göster</button>
        <p className="text-meta text-muted">Önizleme ücretsizdir. Tam boyutlu PNG ya da tüm boyutlar ZIP olarak 1 kredi; dosyalar yalnızca senin erişebildiğin özel alanda 90 gün tutulur.</p>
      </form>

      <section id="gorseller" aria-labelledby="gorseller-baslik" className="min-w-0">
        <h2 id="gorseller-baslik" className="text-2xl font-bold">Görseller</h2>
        {!ctx ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line-strong bg-card px-6 py-10 text-center text-ink-soft">
            Bir başlık yaz ve önizlemeleri göster. Metin sekmesinde ürettiğin satırları &ldquo;Seçilenlerle görsel yap&rdquo; ile buraya taşıyabilirsin.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
              <RiskBadge level={score!.metaLevel} score={score!.metaScore} label={`${PLATFORM_SHORT[q.platform]} kural puanı`} />
              <p className="min-w-0 flex-1 text-small text-ink-soft">
                Görseldeki sözcükler kural motorundan geçti. Mevzuat riski: {LEGAL_LABEL[score!.legalLevel]}.{" "}
                {score!.issues.length ? `Dikkat: ${score!.issues.join(" · ")}.` : "Sözcüklerde eşleşen kural yok."}{" "}
                <Link href={`/panel/yeni#${new URLSearchParams({ baslik: ctx.text.headline, metin: [ctx.text.body, ctx.text.cta].filter(Boolean).join(" "), platform: q.platform }).toString()}`}>Tam analiz başlat</Link>
              </p>
            </div>
            {ctx.notes.map((n) => <p key={n} className="mt-3 rounded-xl bg-info-tint px-4 py-3 text-small text-info">{n}</p>)}
            {balance < 1 ? <p className="mt-3 text-small text-coral-deep">İndirme için kredin yok. <Link href="/panel/krediler">Krediler</Link> sayfasından paket alabilirsin; önizleme ücretsiz.</p> : null}
            <ul className={`mt-6 grid gap-5 ${q.boyut === "yatay" ? "lg:grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3"}`}>
              {LAYOUTS.map((l) => {
                const warnings = warningsFor(ctx, l.id, q.boyut);
                return (
                  <li key={l.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/creative/preview?${creativeQueryString(q, { yerlesim: l.id, sablon: null })}`}
                      alt={`${l.label} yerleşimi, ${size.label} önizleme`}
                      width={Math.round(size.w * 0.4)}
                      height={Math.round(size.h * 0.4)}
                      loading="lazy"
                      className="h-auto w-full border-b border-line bg-paper-2"
                    />
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{l.label}</h3>
                          <p className="text-meta text-muted">{l.note}</p>
                        </div>
                        <RiskBadge level={score!.metaLevel} score={score!.metaScore} label="Kural puanı" className="shrink-0" />
                      </div>
                      {cardFoot(l.label, creativeQueryString(q, { yerlesim: l.id, sablon: null }), warnings, <CreativeDownload layout={l.id} layoutLabel={l.label} size={q.boyut} sizeLabel={size.label} query={creativeQueryString(q, { yerlesim: l.id, sablon: null })} disabled={balance < 1} />)}
                    </div>
                  </li>
                );
              })}
            </ul>
            {brand ? (
              <section aria-labelledby="marka-sablonlari" className="mt-8">
                <h3 id="marka-sablonlari" className="text-xl font-bold">{brand.name} şablonları</h3>
                {templateCards.length ? (
                  <ul className={`mt-4 grid gap-5 ${q.boyut === "yatay" ? "lg:grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3"}`}>
                    {templateCards.map(({ t, warnings }) => {
                      const query = creativeQueryString(q, { sablon: t.id });
                      return (
                        <li key={t.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/creative/preview?${query}`} alt={`${t.name} şablonu, ${size.label} önizleme`} width={Math.round(size.w * 0.4)} height={Math.round(size.h * 0.4)} loading="lazy" className="h-auto w-full border-b border-line bg-paper-2" />
                          <div className="flex flex-1 flex-col gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="font-bold">{t.name}</h4>
                                <p className="text-meta text-muted">Markanın şablonu. Sığmayan metin küçülür, gerekirse kısaltılır.</p>
                              </div>
                              <RiskBadge level={score!.metaLevel} score={score!.metaScore} label="Kural puanı" className="shrink-0" />
                            </div>
                            {cardFoot(
                              t.name,
                              query,
                              warnings,
                              <>
                                <CreativeDownload layout="manset" layoutLabel={t.name} size={q.boyut} sizeLabel={size.label} query={query} disabled={balance < 1} />
                                <form action={deleteTemplateAction}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <input type="hidden" name="back" value={`/panel/uret?sekme=gorsel&${creativeQueryString(q, { sablon: null })}#marka-sablonlari`} />
                                  <button type="submit" className="inline-flex min-h-10 items-center rounded-lg px-2 text-meta font-semibold text-coral-deep hover:bg-coral-tint">
                                    Şablonu sil<span className="sr-only">: {t.name}</span>
                                  </button>
                                </form>
                              </>,
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-small text-ink-soft">Bu markanın kayıtlı şablonu yok. Bir yerleşimi &ldquo;Düzenle&rdquo; ile açıp &ldquo;Şablon olarak kaydet&rdquo; dersen burada çıkar.</p>
                )}
              </section>
            ) : null}
            <Disclaimer className="mt-6" />
          </>
        )}
      </section>
    </div>
  );
}
