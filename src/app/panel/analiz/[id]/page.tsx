import { notFound } from "next/navigation";
import { IconDoc, IconTrash } from "@/components/icons";
import { AdThumb, Menu } from "@/components/panel-client";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import { ButtonLink, buttonClass } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { deleteAnalysisAction } from "../../actions";
import { AppealForm } from "../../forms";
import { revokeReviewShareAction } from "../../agency-actions";
import { ReportEmailForm, ReviewShareForm } from "../../agency-forms";
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

  const brand = a.brandId && a.ownedByMe ? ((await repo.listBrands()).find((b) => b.id === a.brandId)?.name ?? null) : null;
  const title = a.headline || a.primaryText.slice(0, 70) || "Başlıksız reklam";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <AdThumb id={a.id} mediaType={a.mediaType} className="hidden size-20 shrink-0 rounded-xl sm:block" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
              <span className="rounded-md bg-paper-2 px-1.5 py-0.5 font-semibold text-ink-soft">{PLATFORM_SHORT[a.platform]}</span>
              {brand ? <span>{brand}</span> : null}
              <span>{SECTOR_LABEL[a.sector]}</span>
              <time dateTime={a.createdAt}>{formatDateTimeTr(a.createdAt)}</time>
            </p>
            {!a.ownedByMe ? <p className="mt-2 inline-flex rounded-full bg-blue-tint px-3 py-1 text-meta font-semibold text-blue">Ekip analizi · salt okunur</p> : null}
          </div>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {a.status === "completed" ? (
            <>
              <a href={`/api/analyses/${a.id}/export?format=pdf`} className={buttonClass("primary", "h-11 px-4")} download>
                <IconDoc className="size-4" /> PDF indir
              </a>
              <Menu
                label="Paylaş"
                trigger={<>Paylaş</>}
                triggerClassName={buttonClass("ghost", "h-11 px-4")}
                items={[
                  ...(a.ownedByMe ? [{ label: "E-postayla gönder", href: "#eposta" }, { label: "Avukat inceleme bağlantısı", href: "#avukat" }] : []),
                  { label: "Varyantlar (CSV)", href: `/api/analyses/${a.id}/export?format=csv`, download: true },
                  { label: "Yazdır", href: `/panel/analiz/${a.id}/rapor` },
                ]}
              />
            </>
          ) : null}
          {a.ownedByMe ? (
            <form action={deleteAnalysisAction}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="from" value="detail" />
              <button type="submit" aria-label="Analizi sil" title="Analizi sil" className="inline-flex size-11 items-center justify-center rounded-xl text-ink-soft hover:bg-coral-tint hover:text-coral-deep">
                <IconTrash className="size-4" />
              </button>
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
          <ReportView
            a={a}
            layout="tabs"
            feedback={a.ownedByMe ? feedback : undefined}
            appealSlot={
              a.ownedByMe ? (
                <section id="itiraz" className="scroll-mt-24" aria-labelledby="itiraz-form">
                  <h2 id="itiraz-form" className="font-display text-2xl font-semibold">Bu reklam reddedildi mi?</h2>
                  <p className="mt-1.5 text-ink-soft">Meta&apos;nın ret mesajını yapıştır; itiraz mı yeni reklam mı daha mantıklı, söyleyelim ve TR + EN taslağı hazırlayalım. Ek kredi düşmez.</p>
                  <div className="mt-5"><AppealForm analyses={[{ id: a.id, label: title }]} defaultId={a.id} /></div>
                </section>
              ) : undefined
            }
          />
          {a.ownedByMe && a.status === "completed" ? (
            <section id="eposta" className="no-print mt-10 scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-7" aria-labelledby="eposta-h">
              <h2 id="eposta-h" className="font-display text-2xl font-semibold">Raporu e-postayla gönder</h2>
              <p className="mt-1 text-body text-ink-soft">Logolu PDF rapor müşterine veya ekibine ek olarak gider. Saatte en fazla 10 gönderim.</p>
              <div className="mt-5"><ReportEmailForm analysisId={a.id} /></div>
            </section>
          ) : null}
          {a.ownedByMe ? (
            <section id="avukat" className="no-print mt-10 scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-7" aria-labelledby="avukat-h">
              <h2 id="avukat-h" className="font-display text-2xl font-semibold">Avukat incelemesine gönder</h2>
              <p className="mt-1.5 max-w-2xl text-ink-soft">
                Raporun salt okunur bir kopyasını, hesabı olmayan bir hukukçuya bağlantıyla gönder. Bağlantı süre dolunca veya iptal edince çalışmaz;
                kişi yalnızca bu raporu görür. Hukuki görüş, avukatın kendi değerlendirmesidir.
              </p>
              <div className="mt-5"><ReviewShareForm analysisId={a.id} /></div>
              {shares.length ? (
                <ul className="mt-6 grid gap-2 text-small">
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
        </div>
      )}
    </div>
  );
}
