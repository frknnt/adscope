import { notFound } from "next/navigation";
import { IconPrint, IconTrash } from "@/components/icons";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import { ButtonLink, buttonClass } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { deleteAnalysisAction } from "../../actions";
import { AppealForm } from "../../forms";
import { ReportView } from "../report-view";
import { StatusPoller } from "./status-poller";

export const metadata = { title: "Analiz raporu" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const a = await getRepo().getAnalysis(id);
  if (!a) notFound();

  const title = a.headline || a.primaryText.slice(0, 70) || "Başlıksız reklam";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{SECTOR_LABEL[a.sector]} · {formatDateTimeTr(a.createdAt)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {a.status === "completed" ? (
            <ButtonLink href={`/panel/analiz/${a.id}/rapor`} variant="ghost"><IconPrint className="size-4" /> Rapor / PDF</ButtonLink>
          ) : null}
          <form action={deleteAnalysisAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="from" value="detail" />
            <button type="submit" className={buttonClass("ghost", "text-coral-deep")}><IconTrash className="size-4" /> Sil</button>
          </form>
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
          <ReportView a={a} />
          {!a.appeal ? (
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
