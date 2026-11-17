import Link from "next/link";
import { IconGrid, IconList, IconPlus, IconSearch } from "@/components/icons";
import { SegmentedLinks } from "@/components/panel-ui";
import { ButtonLink, EmptyState, inputClass, selectClass } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { filterReports, parseReportFilters, type ReportFilters } from "@/lib/panel/reports";
import { PLATFORM_IDS, PLATFORM_SHORT } from "@/lib/platforms";
import { requirePanelUser } from "@/app/panel/guard";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Raporlar" };

function hrefWith(f: ReportFilters, patch: Partial<ReportFilters>) {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.brand) p.set("marka", n.brand);
  if (n.platform) p.set("platform", n.platform);
  if (n.risk) p.set("risk", n.risk);
  if (n.sort === "eski") p.set("sirala", "eski");
  if (n.view === "liste") p.set("gorunum", "liste");
  const s = p.toString();
  return s ? `/panel/gecmis?${s}` : "/panel/gecmis";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const repo = getRepo();
  const [all, brands, profile, sp] = await Promise.all([repo.listAnalyses(200), repo.listBrands(), repo.getProfile(), searchParams]);
  const f = parseReportFilters(sp);
  const items = filterReports(all, f);
  const filtered = !!(f.q || f.brand || f.platform || f.risk);
  const brandNames = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Raporlar</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Analizler ve görseller {profile?.retentionDays ?? 90} gün sonra otomatik silinir. Bir raporu silmek görselini de kalıcı olarak siler; düşülen kredi geri yüklenmez.
          </p>
        </div>
        {all.length ? (
          <SegmentedLinks
            label="Görünüm"
            items={[
              { href: hrefWith(f, { view: "izgara" }), label: "Izgara", active: f.view === "izgara", Icon: IconGrid },
              { href: hrefWith(f, { view: "liste" }), label: "Liste", active: f.view === "liste", Icon: IconList },
            ]}
          />
        ) : null}
      </div>
      {sp.silindi ? <p role="status" className="mt-5 rounded-xl bg-green-tint px-4 py-3 text-body font-medium text-green">Analiz ve görseli silindi.</p> : null}

      {all.length ? (
        <>
          <form method="get" action="/panel/gecmis" role="search" aria-label="Raporlarda ara ve süz" className="mt-6 grid gap-3 rounded-2xl border border-line bg-card p-4 shadow-card md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]">
            {f.view === "liste" ? <input type="hidden" name="gorunum" value="liste" /> : null}
            <label className="relative block md:col-span-2 xl:col-span-1">
              <span className="sr-only">Metinde ara</span>
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" name="q" defaultValue={f.q} placeholder="Başlık veya metinde ara" className={`${inputClass} pl-10`} maxLength={80} />
            </label>
            <label className="block">
              <span className="sr-only">Marka</span>
              <select name="marka" defaultValue={f.brand ?? ""} className={selectClass}>
                <option value="">Marka: tümü</option>
                <option value="yok">Markasız</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Platform</span>
              <select name="platform" defaultValue={f.platform ?? ""} className={selectClass}>
                <option value="">Platform: tümü</option>
                {PLATFORM_IDS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_SHORT[p]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Risk düzeyi</span>
              <select name="risk" defaultValue={f.risk ?? ""} className={selectClass}>
                <option value="">Risk: tümü</option>
                <option value="high">Yüksek risk</option>
                <option value="medium">Orta risk</option>
                <option value="low">Düşük risk</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Sıralama</span>
              <select name="sirala" defaultValue={f.sort} className={selectClass}>
                <option value="yeni">En yeni önce</option>
                <option value="eski">En eski önce</option>
              </select>
            </label>
            <div className="flex gap-2 md:col-span-2 xl:col-span-1">
              <button type="submit" className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-paper hover:bg-navy-700">
                Süz
              </button>
              {filtered ? (
                <Link href={hrefWith({ ...f, q: "", brand: null, platform: null, risk: null }, {})} className="inline-flex h-12 items-center rounded-xl px-3 font-semibold text-ink-soft">
                  Temizle
                </Link>
              ) : null}
            </div>
          </form>
          <p className="mt-4 text-small text-muted" aria-live="polite">
            {filtered ? `${all.length} rapordan ${items.length} tanesi süzgece uyuyor.` : `${all.length} rapor`}
          </p>
          <div className="mt-2">
            {items.length ? (
              <ReportsView items={items} view={f.view} brands={brandNames} />
            ) : (
              <EmptyState title="Bu süzgece uyan rapor yok." action={<ButtonLink href={hrefWith({ ...f, q: "", brand: null, platform: null, risk: null }, {})} variant="ghost">Süzgeçleri temizle</ButtonLink>}>
                Arama metnini kısalt ya da bir süzgeci kaldır.
              </EmptyState>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          className="mt-8"
          title="Henüz rapor yok."
          action={
            <ButtonLink href="/panel/yeni" variant="primary">
              <IconPlus className="size-[18px]" /> İlk analizi başlat
            </ButtonLink>
          }
        >
          Tamamladığın analizler burada kart olarak listelenir; arayabilir, süzebilir ve CSV olarak indirebilirsin.
        </EmptyState>
      )}
    </div>
  );
}
