import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { LEVEL_LABEL } from "@/components/risk";
import type { Level } from "@/lib/engine/types";

/* ---------- KpiCard: one real number with a label; "—" when there is no data yet. ---------- */

export function KpiCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
  Icon,
  href,
}: {
  label: string;
  value: number | null;
  unit?: string;
  hint?: string;
  tone?: "default" | "warn" | "risk";
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string;
}) {
  const toneClass = tone === "warn" ? "bg-amber-tint text-amber" : tone === "risk" ? "bg-coral-tint text-coral-deep" : "bg-blue-tint text-blue";
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-meta font-semibold text-muted">{label}</span>
        {Icon ? (
          <span className={`inline-flex size-8 items-center justify-center rounded-lg ${toneClass}`} aria-hidden>
            <Icon className="size-4" />
          </span>
        ) : null}
      </span>
      <span className="mt-2 block text-3xl font-extrabold tabular leading-none text-ink">
        {value === null ? "—" : value}
        {value !== null && unit ? <span className="ml-1 text-small font-semibold text-ink-soft">{unit}</span> : null}
      </span>
      {hint ? <span className="mt-2 block text-meta text-muted">{hint}</span> : null}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-card p-5 shadow-card no-underline";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------- RiskBadge: colour + number + level name (colour never stands alone). ---------- */

const BADGE: Record<Level, string> = {
  low: "bg-green-tint text-green",
  medium: "bg-amber-tint text-amber",
  high: "bg-coral-tint text-coral-deep",
};

export function RiskBadge({ level, score, label = "Ret riski", className = "" }: { level: Level | null; score?: number | null; label?: string; className?: string }) {
  if (!level) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-bold ${BADGE[level]} ${className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      <span className="sr-only">{label}: </span>
      {score !== null && score !== undefined ? <span className="tabular">{score}</span> : null}
      {LEVEL_LABEL[level]}
    </span>
  );
}

/* ---------- SegmentedControl: a small set of mutually exclusive links (e.g. grid / list). ---------- */

export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: string; active: boolean; Icon?: ComponentType<SVGProps<SVGSVGElement>> }[] }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-card p-1">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "true" : undefined}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-small font-semibold no-underline ${it.active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink"}`}
        >
          {it.Icon ? <it.Icon className="size-4" aria-hidden /> : null}
          {it.label}
        </Link>
      ))}
    </div>
  );
}

