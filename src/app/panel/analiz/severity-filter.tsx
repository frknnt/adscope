"use client";

import { useState, type ReactNode } from "react";

type Sev = "all" | "red" | "yellow" | "info";
const LABEL: Record<Sev, string> = { all: "Tümü", red: "Kırmızı", yellow: "Sarı", info: "Bilgi" };

/** Finding level filter; hides the other groups with CSS so the server-rendered list stays as is. */
export function SeverityFilter({ counts, children }: { counts: Record<Exclude<Sev, "all">, number>; children: ReactNode }) {
  const [f, setF] = useState<Sev>("all");
  const total = counts.red + counts.yellow + counts.info;
  return (
    <div className="sev-filter" data-f={f}>
      {total ? (
        <div role="group" aria-label="Bulgu düzeyi" className="mb-1 flex flex-wrap gap-2">
          {(["all", "red", "yellow", "info"] as const).map((k) => {
            const n = k === "all" ? total : counts[k];
            if (k !== "all" && !n) return null;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={f === k}
                onClick={() => setF(k)}
                className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-small font-semibold ${f === k ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft hover:border-line-strong"}`}
              >
                {LABEL[k]} <span className="tabular">{n}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {children}
    </div>
  );
}
