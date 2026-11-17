import { notFound } from "next/navigation";
import { IconDoc, IconPrint, IconTrash } from "@/components/icons";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import { ButtonLink, buttonClass } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { deleteAnalysisAction } from "../../actions";
import { AppealForm } from "../../forms";
import { revokeReviewShareAction } from "../../agency-actions";
import { ReviewShareForm } from "../../agency-forms";
import { PLATFORM_SHORT } from "@/lib/platforms";
import { ReportView } from "../report-view";
import { StatusPoller } from "./status-poller";

export const metadata = { title: "Analiz raporu" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server-side check at request time (a share is usable until it expires or is revoked). */
function shareActive(sh: { revokedAt: string | null; expiresAt: string }) {
  return !sh.revokedAt && Date.parse(sh.expiresAt) > Date.now();
}

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const repo = getRepo();
  const a = await repo.getAnalysis(id);
  if (!a) notFound();
  const [feedback, shares] = a.ownedByMe && a.status === "completed" ? await Promise.all([repo.listFindingFeedback(a.id), repo.listReviewShares(a.id)]) : [[], []];

  const title = a.headline || a.primaryText.slice(0, 70) || "Başlıksız reklam";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{SECTOR_LABEL[a.sector]} · {PLATFORM_SHORT[a.platform]} · {formatDateTimeTr(a.createdAt)}</p>
          {!a.ownedByMe ? <p className="mt-2 inline-flex rounded-full bg-info-tint px-3 py-1 text-[0.8rem] font-semibold text-info">Ekip analizi · salt okunur</p> : null}
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {a.status === "completed" ? (
            <>
              <a href={`/api/analyses/${a.id}/export?format=pdf`} className={buttonClass("primary")} download>
                <IconDoc className="size-4" /> PDF indir
              </a>
              <ButtonLink href={`/panel/analiz/${a.id}/rapor`} variant="ghost"><IconPrint className="size-4" /> Yazdır</ButtonLink>
            </>
          ) : null}
          {a.ownedByMe ? (
            <form action={deleteAnalysisAction}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="from" value="detail" />
              <button type="submit" className={buttonClass("ghost", "text-coral-deep")}><IconTrash className="size-4" /> Sil</button>
            </form>
          ) : null}
        </div>
      </div>

      {a.status === "processing" ? (
        <div className="sheet mt-8 rounded-2xl border border-line px-6 py-10 text-center" role="status">
          <p className="font-display text-2xl font-semibold">Analiz sürüyor…</p>
          <p className="mt-2 text-ink-soft">Bu sayfa kendini yeniler. Kredi yalnızca rapor tamamlanınca düşer.</p>
          <StatusPoller />
        </div>
      ) : a.status === "failed" ? (
        <div className="mt-8 rounded-2xl border border-line bg-card px-6 py-8" role="alert">
          <p className="font-display text-2xl font-semibold">Bu analiz tamamlanamadı.</p>
          <p className="mt-2 text-ink-soft">Krediniz düşülmedi. Görseli ve metni yeniden göndererek tekrar deneyebilirsiniz.</p>
          <ButtonLink href="/panel/yeni" variant="primary" className="mt-5">Yeni analiz başlat</ButtonLink>
        </div>
      ) : (
        <div className="mt-8">
          <ReportView a={a} feedback={a.ownedByMe ? feedback : undefined} />
          {a.ownedByMe ? (
            <section id="avukat" className="no-print mt-10 scroll-mt-6 rounded-2xl border border-line bg-card p-5 sm:p-7" aria-labelledby="avukat-h">
              <h2 id="avukat-h" className="font-display text-2xl font-semibold">Avukat incelemesine gönder</h2>
              <p className="mt-1.5 max-w-2xl text-ink-soft">
                Raporun salt okunur bir kopyasını, hesabı olmayan bir hukukçuya bağlantıyla gönder. Bağlantı süre dolunca veya iptal edince çalışmaz;
                kişi yalnızca bu raporu görür. Hukuki görüş, avukatın kendi değerlendirmesidir.
              </p>
              <div className="mt-5"><ReviewShareForm analysisId={a.id} /></div>
              {shares.length ? (
                <ul className="mt-6 grid gap-2 text-[0.88rem]">
                  {shares.map((sh) => {
                    const active = shareActive(sh);
                    return (
                      <li key={sh.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                        <span>
                          {formatDateTimeTr(sh.createdAt)} · {active ? `${formatDateTimeTr(sh.expiresAt)} tarihine kadar geçerli` : sh.revokedAt ? "İptal edildi" : "Süresi doldu"} · {sh.viewCount} görüntüleme
                          {sh.note ? <span className="block text-muted">{sh.note}</span> : null}
                        </span>
                        {active ? (
                          <form action={revokeReviewShareAction}>
                            <input type="hidden" name="id" value={sh.id} />
                            <input type="hidden" name="analysisId" value={a.id} />
                            <button type="submit" className="font-semibold text-coral-deep">İptal et</button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ) : null}
          {!a.appeal && a.ownedByMe ? (
            <section id="itiraz" className="no-print mt-10 scroll-mt-6 rounded-2xl border border-line bg-card p-5 sm:p-7" aria-labelledby="itiraz-form">
              <h2 id="itiraz-form" className="font-display text-2xl font-semibold">Bu reklam reddedildi mi?</h2>
              <p className="mt-1.5 text-ink-soft">Meta&apos;nın ret mesajını yapıştır; itiraz mı yeni reklam mı daha mantıklı, söyleyelim ve TR + EN taslağı hazırlayalım. Ek kredi düşmez.</p>
              <div className="mt-5"><AppealForm analyses={[{ id: a.id, label: title }]} defaultId={a.id} /></div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
