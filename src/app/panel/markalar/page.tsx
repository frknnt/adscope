import { requirePanelUser } from "@/app/panel/guard";
import { getRepo } from "@/lib/data";
import { SECTOR_LABEL } from "@/lib/sectors";
import { deleteBrandAction } from "../agency-actions";
import { BrandForm } from "../agency-forms";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Markalar" };

const TONE = { samimi: "Samimi", kurumsal: "Kurumsal", genc: "Genç" } as const;

export default async function BrandsPage() {
  await requirePanelUser();
  const brands = await getRepo().listBrands();
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Markalar</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Ajans olarak birden fazla markayı yönet. Her markanın tonu, yasaklı kelimeleri ve çağrı cümlesi analizde kullanılır; logo PDF raporun ve avukat
        inceleme sayfasının başlığına gelir.
      </p>

      <section aria-labelledby="yeni-marka" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="yeni-marka" className="font-display text-2xl font-semibold">Yeni marka</h2>
        <div className="mt-5"><BrandForm /></div>
      </section>

      <section aria-labelledby="marka-listesi" className="mt-8">
        <h2 id="marka-listesi" className="font-display text-2xl font-semibold">Markaların <span className="text-base font-normal text-muted">· {brands.length}</span></h2>
        {brands.length === 0 ? (
          <EmptyState className="mt-4" title="Henüz marka yok.">İlk markanı yukarıdan ekle; analiz sihirbazında seçebilirsin.</EmptyState>
        ) : (
          <ul className="mt-4 grid gap-4">
            {brands.map((b) => (
              <li key={b.id} className="rounded-2xl border border-line bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {b.hasLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/brands/${b.id}/logo`} alt="" className="size-10 rounded-lg border border-line bg-field object-contain" />
                    ) : (
                      <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-paper font-display text-lg font-semibold">{b.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                    )}
                    <div>
                      <h3 className="text-lg font-bold">{b.name}</h3>
                      <p className="text-small text-muted">{SECTOR_LABEL[b.sector]} · {TONE[b.tone]} · {b.bannedWords.length} yasaklı kelime</p>
                    </div>
                  </div>
                  <form action={deleteBrandAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="text-small font-semibold text-coral-deep">Markayı sil</button>
                  </form>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-body font-semibold">Düzenle</summary>
                  <div className="mt-4"><BrandForm brand={b} /></div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
