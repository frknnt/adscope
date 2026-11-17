import { requirePanelUser } from "@/app/panel/guard";
import { getRepo } from "@/lib/data";
import { SECTOR_LABEL } from "@/lib/sectors";
import { deleteBrandAction } from "../agency-actions";
import { BrandDialogButton } from "../agency-forms";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Markalar" };

const TONE = { samimi: "Samimi", kurumsal: "Kurumsal", genc: "Genç" } as const;

export default async function BrandsPage() {
  await requirePanelUser();
  const repo = getRepo();
  const [brands, analyses] = await Promise.all([repo.listBrands(), repo.listAnalyses(200)]);
  const count = (id: string) => analyses.filter((a) => a.brandId === id).length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Markalar</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Ajans olarak birden fazla markayı yönet. Her markanın tonu, yasaklı kelimeleri ve çağrı cümlesi analizde kullanılır; logo PDF raporun ve avukat inceleme sayfasının başlığına gelir.
          </p>
        </div>
        <BrandDialogButton />
      </div>

      <section aria-labelledby="marka-listesi" className="mt-8">
        <h2 id="marka-listesi" className="sr-only">Markaların</h2>
        {brands.length === 0 ? (
          <EmptyState title="Henüz marka yok." action={<BrandDialogButton />}>
            İlk markanı ekle; analiz sihirbazında ve toplu kontrolde seçebilirsin.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {brands.map((b) => (
              <li key={b.id} className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-card">
                <div className="flex items-center gap-3">
                  {b.hasLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/brands/${b.id}/logo`} alt="" className="size-12 rounded-xl border border-line bg-card object-contain" />
                  ) : (
                    <span aria-hidden className="grid size-12 place-items-center rounded-xl bg-blue-tint text-lg font-extrabold text-blue">{b.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold">{b.name}</h3>
                    <p className="truncate text-small text-muted">{b.tagline || SECTOR_LABEL[b.sector]}</p>
                  </div>
                  {b.primaryColor || b.secondaryColor ? (
                    <span className="flex shrink-0 -space-x-1.5" role="img" aria-label={`Marka renkleri: ${[b.primaryColor, b.secondaryColor].filter(Boolean).join(", ")}`}>
                      {[b.primaryColor, b.secondaryColor].filter(Boolean).map((c) => (
                        <span key={c} className="size-6 rounded-full border-2 border-card" style={{ background: c! }} />
                      ))}
                    </span>
                  ) : null}
                </div>
                {b.requiredPhrases.length ? <p className="mt-3 text-meta text-muted">Zorunlu ibare: {b.requiredPhrases.length}</p> : null}
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-paper-2 px-2 py-2.5"><dt className="text-fine text-muted">Ton</dt><dd className="text-small font-bold">{TONE[b.tone]}</dd></div>
                  <div className="rounded-xl bg-paper-2 px-2 py-2.5"><dt className="text-fine text-muted">Yasaklı kelime</dt><dd className="text-small font-bold tabular">{b.bannedWords.length}</dd></div>
                  <div className="rounded-xl bg-paper-2 px-2 py-2.5"><dt className="text-fine text-muted">Analiz</dt><dd className="text-small font-bold tabular">{count(b.id)}</dd></div>
                </dl>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <BrandDialogButton brand={b} />
                  <form action={deleteBrandAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="inline-flex h-10 items-center text-small font-semibold text-coral-deep">Markayı sil<span className="sr-only">: {b.name}</span></button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
