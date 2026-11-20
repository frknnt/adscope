"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconDots, IconPrint, IconTrash } from "@/components/icons";
import { Dialog, useToast } from "@/components/interactive";
import { AdThumb, Menu } from "@/components/panel-client";
import { RiskBadge } from "@/components/panel-ui";
import { LevelPill } from "@/components/risk";
import { ApprovalPill } from "@/components/approval-badge";
import type { ApprovalBadge } from "@/lib/approval";
import { Button, DataTable } from "@/components/ui";
import type { AnalysisSummary } from "@/lib/data/types";
import { toCsv } from "@/lib/export/csv";
import { PLATFORM_SHORT } from "@/lib/platforms";
import {
  REPORT_CSV_HEADER,
  reportRows,
  reportTitle,
} from "@/lib/panel/reports";
import { deleteAnalysesAction } from "../actions";

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function Status({ a }: { a: AnalysisSummary }) {
  if (a.status === "failed")
    return (
      <span className="rounded-full bg-paper-2 px-2.5 py-1 text-meta font-semibold text-muted">
        Tamamlanamadı · kredi düşülmedi
      </span>
    );
  if (a.status === "processing")
    return (
      <span className="rounded-full bg-blue-tint px-2.5 py-1 text-meta font-semibold text-blue">
        İşleniyor
      </span>
    );
  return null;
}

export function ReportsView({
  items,
  view,
  brands,
  selectable = true,
  approvals = {},
}: {
  items: AnalysisSummary[];
  view: "izgara" | "liste";
  brands: Record<string, string>;
  selectable?: boolean;
  /** Client approval badge per analysis id (P12.1). */
  approvals?: Record<string, ApprovalBadge>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const visible = new Set(items.map((a) => a.id));
  const chosen = [...selected].filter((id) => visible.has(id));
  const allChosen = items.length > 0 && chosen.length === items.length;
  const brandName = (id: string | null) => (id ? (brands[id] ?? "") : "");

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function downloadCsv() {
    const rows = items.filter((a) => !chosen.length || selected.has(a.id));
    const blob = new Blob(
      [toCsv([REPORT_CSV_HEADER, ...reportRows(rows, brandName)])],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "adscope-raporlar.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function doDelete(ids: string[]) {
    start(async () => {
      const { deleted } = await deleteAnalysesAction(ids);
      setConfirm(null);
      setSelected(new Set());
      toast(
        deleted
          ? `${deleted} rapor ve görselleri silindi.`
          : "Silinemedi. Lütfen tekrar deneyin.",
        deleted ? "success" : "error",
      );
      router.refresh();
    });
  }

  const menuFor = (a: AnalysisSummary) => (
    <Menu
      label={`İşlemler: ${reportTitle(a)}`}
      trigger={<IconDots className="size-5" />}
      items={[
        ...(a.status === "completed"
          ? [
              {
                label: "PDF indir",
                href: `/api/analyses/${a.id}/export?format=pdf`,
                download: true,
              },
            ]
          : []),
        ...(a.ownedByMe
          ? [{ label: "Sil", danger: true, onSelect: () => setConfirm([a.id]) }]
          : []),
      ]}
    />
  );

  const check = (a: AnalysisSummary) => (
    <input
      type="checkbox"
      className="size-5 accent-[var(--color-blue)]"
      checked={selected.has(a.id)}
      onChange={() => toggle(a.id)}
      aria-label={`Seç: ${reportTitle(a)}`}
    />
  );

  return (
    <div>
      {selectable ? (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-2">
          <label className="inline-flex items-center gap-2.5 text-small font-semibold text-ink">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-blue)]"
              checked={allChosen}
              onChange={() =>
                setSelected(
                  allChosen ? new Set() : new Set(items.map((a) => a.id)),
                )
              }
            />
            {chosen.length
              ? `${chosen.length} rapor seçildi`
              : `Tümünü seç (${items.length})`}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-4"
              onClick={downloadCsv}
            >
              {chosen.length ? "Seçilenleri CSV indir" : "Listeyi CSV indir"}
            </Button>
            {chosen.length ? (
              <Button
                type="button"
                variant="danger"
                className="h-10 px-4"
                onClick={() => setConfirm(chosen)}
              >
                Seçilenleri sil
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "izgara" ? (
        <ul
          className={`${selectable ? "mt-4" : ""} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`}
        >
          {items.map((a) => (
            <li key={a.id}>
              <article className="flex h-full flex-col rounded-2xl border border-line bg-card shadow-card">
                <div className="relative">
                  <AdThumb
                    id={a.id}
                    mediaType={a.mediaType}
                    className="aspect-[16/10] rounded-t-2xl"
                  />
                  <span className="absolute left-3 top-3">
                    {a.status === "completed" ? (
                      <RiskBadge
                        level={a.metaRiskLevel}
                        score={a.metaRiskScore}
                        className="shadow-card"
                      />
                    ) : (
                      <Status a={a} />
                    )}
                  </span>
                  {selectable ? (
                    <span className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-xl bg-card/90">
                      {check(a)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 font-bold leading-snug text-ink">
                    {reportTitle(a)}
                  </h3>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
                    <span className="rounded-md bg-paper-2 px-1.5 py-0.5 font-semibold text-ink-soft">
                      {PLATFORM_SHORT[a.platform]}
                    </span>
                    {brandName(a.brandId) ? (
                      <span>{brandName(a.brandId)}</span>
                    ) : null}
                    <time dateTime={a.createdAt}>
                      {dateFmt.format(new Date(a.createdAt))}
                    </time>
                  </p>
                  {a.status === "completed" ? (
                    <p className="mt-2.5 flex flex-wrap gap-1.5">
                      <LevelPill level={a.legalRiskLevel} prefix="Mevzuat" />
                      <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-meta font-bold tabular text-ink">
                        Kreatif {a.creativeScore}
                      </span>
                      {approvals[a.id] ? <ApprovalPill badge={approvals[a.id]} short /> : null}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <Link
                      href={`/panel/analiz/${a.id}`}
                      className="inline-flex h-11 items-center font-semibold text-blue"
                    >
                      Aç<span className="sr-only">: {reportTitle(a)}</span>
                    </Link>
                    {menuFor(a)}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <DataTable label="Raporlar tablosu" className="mt-4">
          <table className="w-full min-w-[46rem] text-left text-small">
            <thead className="border-b border-line bg-paper-2 text-meta font-semibold text-muted">
              <tr>
                <th scope="col" className="w-12 px-4 py-3">
                  <span className="sr-only">Seç</span>
                </th>
                <th scope="col" className="px-2 py-3">
                  Rapor
                </th>
                <th scope="col" className="px-2 py-3">
                  Platform
                </th>
                <th scope="col" className="px-2 py-3">
                  Ret riski
                </th>
                <th scope="col" className="px-2 py-3">
                  Mevzuat
                </th>
                <th scope="col" className="px-2 py-3">
                  Kreatif
                </th>
                <th scope="col" className="w-24 px-2 py-3">
                  <span className="sr-only">İşlemler</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2">{check(a)}</td>
                  <td className="max-w-[22rem] px-2 py-2">
                    <Link
                      href={`/panel/analiz/${a.id}`}
                      className="block truncate font-semibold text-ink"
                    >
                      {reportTitle(a)}
                    </Link>
                    <span className="text-meta text-muted">
                      {a.mediaType === "video" ? "Video · " : ""}
                      {brandName(a.brandId) ? `${brandName(a.brandId)} · ` : ""}
                      <time dateTime={a.createdAt}>
                        {dateFmt.format(new Date(a.createdAt))}
                      </time>
                    </span>
                    {approvals[a.id] ? <span className="mt-1 block"><ApprovalPill badge={approvals[a.id]} short /></span> : null}
                  </td>
                  <td className="px-2 py-2">{PLATFORM_SHORT[a.platform]}</td>
                  <td className="px-2 py-2">
                    {a.status === "completed" ? (
                      <RiskBadge
                        level={a.metaRiskLevel}
                        score={a.metaRiskScore}
                      />
                    ) : (
                      <Status a={a} />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {a.status === "completed" ? (
                      <LevelPill level={a.legalRiskLevel} />
                    ) : null}
                  </td>
                  <td className="px-2 py-2 tabular">
                    {a.creativeScore ?? "—"}
                  </td>
                  <td className="px-2 py-1">
                    {/* Inline actions: a dropdown would be clipped by the scrolling table frame. */}
                    <span className="flex justify-end">
                      {a.status === "completed" ? (
                        <a href={`/api/analyses/${a.id}/export?format=pdf`} download aria-label={`PDF indir: ${reportTitle(a)}`} title="PDF indir" className="inline-flex size-11 items-center justify-center rounded-xl text-ink-soft hover:bg-paper-2 hover:text-ink">
                          <IconPrint className="size-4" />
                        </a>
                      ) : null}
                      {a.ownedByMe ? (
                        <button type="button" onClick={() => setConfirm([a.id])} aria-label={`Sil: ${reportTitle(a)}`} title="Sil" className="inline-flex size-11 items-center justify-center rounded-xl text-ink-soft hover:bg-coral-tint hover:text-coral-deep">
                          <IconTrash className="size-4" />
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm && confirm.length > 1
            ? `${confirm.length} rapor silinsin mi?`
            : "Rapor silinsin mi?"
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-4"
              onClick={() => setConfirm(null)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="danger"
              className="h-11 px-4"
              disabled={pending}
              onClick={() => confirm && doDelete(confirm)}
            >
              {pending ? "Siliniyor…" : "Kalıcı olarak sil"}
            </Button>
          </>
        }
      >
        Rapor ve görseli kalıcı olarak silinir. Düşülen kredi geri yüklenmez.
      </Dialog>
    </div>
  );
}
