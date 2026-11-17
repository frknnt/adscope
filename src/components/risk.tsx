import type { Level } from "@/lib/engine/types";

export const LEVEL_LABEL: Record<Level, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };

const LEVEL_STYLE: Record<Level, string> = {
  low: "bg-green-tint text-green",
  medium: "bg-amber-tint text-amber",
  high: "bg-coral-tint text-coral-deep",
};

export function LevelPill({ level, prefix }: { level: Level | null; prefix?: string }) {
  if (!level) return <span className="text-muted">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta font-bold uppercase tracking-wide ${LEVEL_STYLE[level]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {prefix ? `${prefix} ` : ""}
      {LEVEL_LABEL[level]}
    </span>
  );
}

export const SEVERITY_LABEL = { red: "Kırmızı bayrak", yellow: "Sarı bayrak", info: "Bilgilendirme" } as const;

/** A 0–100 measurement rule with a marker. `invert` for scores where high is good. */
export function ScaleBar({ value, invert = false, label }: { value: number; invert?: boolean; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-3">
      <div
        className="relative h-2 rounded-full"
        style={{
          background: invert
            ? "linear-gradient(90deg, #e2553a 0%, #e9b43c 50%, #3f8a64 100%)"
            : "linear-gradient(90deg, #3f8a64 0%, #e9b43c 45%, #e2553a 80%)",
        }}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      >
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-ink shadow-[0_2px_6px_rgba(19,33,60,.35)]"
          style={{ left: `${v}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-fine font-medium text-muted tabular">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
