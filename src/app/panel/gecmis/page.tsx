import { ButtonLink } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { AnalysisList } from "../analysis-list";

export const metadata = { title: "Geçmiş" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ silindi?: string }> }) {
  await requirePanelUser();
  const [items, profile, sp] = await Promise.all([getRepo().listAnalyses(200), getRepo().getProfile(), searchParams]);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Geçmiş</h1>
      <p className="mt-2 text-ink-soft">
        Analizler ve görseller {profile?.retentionDays ?? 90} gün sonra otomatik silinir. Bir analizi silmek görselini de kalıcı olarak siler; düşülen kredi geri yüklenmez.
      </p>
      {sp.silindi ? <p role="status" className="mt-5 rounded-xl bg-green-tint px-4 py-3 text-[0.92rem] font-medium text-green">Analiz ve görseli silindi.</p> : null}
      <div className="mt-8">
        {items.length ? (
          <AnalysisList items={items} showDelete />
        ) : (
          <div className="sheet rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-display text-2xl font-semibold">Geçmişin boş.</p>
            <p className="mt-2 text-ink-soft">Tamamladığın analizler burada listelenir.</p>
            <ButtonLink href="/panel/yeni" className="mt-6">Yeni analiz</ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
