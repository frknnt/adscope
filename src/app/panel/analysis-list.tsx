import Link from "next/link";
import { IconTrash } from "@/components/icons";
import { LevelPill } from "@/components/risk";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import type { AnalysisSummary } from "@/lib/data/types";
import { deleteAnalysisAction } from "./actions";

function StatusCell({ a }: { a: AnalysisSummary }) {
  if (a.status === "failed") return <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[0.78rem] font-semibold text-muted">Tamamlanamadı · kredi düşülmedi</span>;
  if (a.status === "processing") return <span className="rounded-full bg-info-tint px-2.5 py-0.5 text-[0.78rem] font-semibold text-info">İşleniyor</span>;
  return null;
}

export function AnalysisList({ items, showDelete = false }: { items: AnalysisSummary[]; showDelete?: boolean }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {items.map((a) => (
        <li key={a.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <Link href={`/panel/analiz/${a.id}`} className="block truncate font-semibold text-ink no-underline hover:underline">
              {a.headline || a.primaryText.slice(0, 80) || "Başlıksız reklam"}
            </Link>
            <p className="mt-0.5 text-[0.82rem] text-muted">
              {a.mediaType === "video" ? "Video · " : ""}{SECTOR_LABEL[a.sector]} · <time dateTime={a.createdAt}>{formatDateTimeTr(a.createdAt)}</time>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {a.status === "completed" ? (
              <>
                <LevelPill level={a.metaRiskLevel} prefix="Meta" />
                <LevelPill level={a.legalRiskLevel} prefix="Mevzuat" />
                <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[0.78rem] font-bold tabular text-ink">Kreatif {a.creativeScore}</span>
              </>
            ) : (
              <StatusCell a={a} />
            )}
            {showDelete ? (
              <form action={deleteAnalysisAction}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="ml-1 inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-coral-tint hover:text-coral-deep" aria-label="Analizi ve görselini sil">
                  <IconTrash className="size-4" />
                </button>
              </form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
