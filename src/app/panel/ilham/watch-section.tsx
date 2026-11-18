import { IconExternal, IconTrash } from "@/components/icons";
import { formatDateTr } from "@/components/rule-status";
import { LIBRARY_COUNTRIES } from "@/lib/ads-library/meta";
import { getRepo } from "@/lib/data";
import { WATCH_LIMIT } from "@/lib/data/limits";
import { deleteWatchAction } from "./actions";
import { WatchForm } from "./watch-form";

export async function CompetitorWatchSection({ enabled }: { enabled: boolean }) {
  const watches = await getRepo().listWatches();
  return (
    <section aria-labelledby="rakip-baslik" className="grid gap-5">
      <div>
        <h2 id="rakip-baslik" className="text-xl font-bold">Rakip izleme</h2>
        <p className="mt-1 max-w-3xl text-small text-ink-soft">
          En fazla {WATCH_LIMIT} sayfa adı ya da anahtar kelime kaydet. Her hafta yeni reklamlar sayılır ve en uzun süredir yayında olanlar özetlenir; e-posta tanımlıysa özet e-postayla da gelir.
        </p>
        <p className="mt-2 max-w-3xl rounded-xl bg-info-tint px-4 py-3 text-small text-info">
          Meta Reklam Kütüphanesi API&apos;si ticari reklamları yalnızca AB ülkelerinde gösterilmişse verir. Yalnızca Türkiye&apos;de yayınlanan reklamlar bu izlemede görünmez.
        </p>
      </div>
      {!enabled ? <p className="text-small text-ink-soft">Meta Reklam Kütüphanesi bağlantısı kurulmamış; izleme kaydedilebilir ama kontrol çalışmaz.</p> : null}
      <WatchForm countries={Object.entries(LIBRARY_COUNTRIES)} disabled={watches.length >= WATCH_LIMIT} />
      {watches.length ? (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="İzlenen aramalar">
          {watches.map((w) => (
            <li key={w.id} className="grid gap-3 rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-bold">{w.term}</p>
                  <p className="text-meta text-muted">
                    {LIBRARY_COUNTRIES[w.country as keyof typeof LIBRARY_COUNTRIES] ?? w.country} · {w.lastCheckedAt ? `son kontrol ${formatDateTr(w.lastCheckedAt.slice(0, 10))}` : "ilk haftalık kontrol bekleniyor"}
                  </p>
                </div>
                <form action={deleteWatchAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button type="submit" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-meta font-semibold text-coral-deep" aria-label={`${w.term} izlemesini sil`}>
                    <IconTrash className="size-4" aria-hidden /> Sil
                  </button>
                </form>
              </div>
              {w.lastSummary ? (
                <>
                  <p className="text-small text-ink">
                    Bu hafta <strong className="tabular">{w.lastSummary.newCount}</strong> yeni reklam · <span className="tabular">{w.lastSummary.activeCount}</span> reklam yayında
                  </p>
                  {w.lastSummary.longest.length ? (
                    <div>
                      <p className="text-meta font-semibold text-muted">En uzun süredir yayında</p>
                      <ol className="mt-1.5 grid gap-1.5">
                        {w.lastSummary.longest.map((a) => (
                          <li key={a.id} className="flex items-start justify-between gap-2 text-small">
                            <span className="min-w-0">
                              <span className="font-semibold">{a.pageName || "Sayfa"}</span> · <span className="tabular">{a.days} gün</span>
                              {a.title ? <span className="block truncate text-meta text-ink-soft">{a.title}</span> : null}
                            </span>
                            <a href={`https://www.facebook.com/ads/library/?id=${encodeURIComponent(a.id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-meta font-semibold">
                              Kütüphanede aç <IconExternal className="size-3.5" aria-hidden />
                              <span className="sr-only">(yeni sekmede açılır)</span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-ink-soft">Henüz izlenen arama yok.</p>
      )}
    </section>
  );
}
