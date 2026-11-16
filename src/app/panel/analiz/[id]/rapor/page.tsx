import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { PrintButton } from "../../../forms";
import { ReportView } from "../../report-view";

export const metadata = { title: "Yazdırılabilir rapor" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PrintableReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const a = await getRepo().getAnalysis(id);
  if (!a || a.status !== "completed") notFound();

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/panel/analiz/${a.id}`} className="text-sm font-semibold text-coral-deep">← Rapora dön</Link>
        <PrintButton />
      </div>
      <article className="rounded-2xl border border-line bg-card p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <Logo href="/panel" />
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">Reklam ön kontrol raporu</h1>
            <p className="mt-1 text-sm text-muted">{a.headline || a.primaryText.slice(0, 80)} · {SECTOR_LABEL[a.sector]}</p>
          </div>
          <p className="text-right text-[0.82rem] text-muted">
            {formatDateTimeTr(a.completedAt ?? a.createdAt)}
            <br />
            <strong className="text-ink">Risk değerlendirmesidir, hukuki görüş değildir.</strong>
          </p>
        </header>
        <div className="mt-8">
          <ReportView a={a} print />
        </div>
      </article>
    </div>
  );
}
