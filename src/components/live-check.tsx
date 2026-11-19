"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { liveCheck, type LiveFinding } from "@/lib/engine/live";
import type { Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { SEVERITY_LABEL } from "./risk";

const PILL = { red: "bg-coral-tint text-coral-deep", yellow: "bg-amber-tint text-amber", info: "bg-info-tint text-info" } as const;
const UNDERLINE = { red: "live-u-red", yellow: "live-u-yellow", info: "live-u-info" } as const;

// inputClass without its own background: the wrapper paints it so the underline layer shows through.
const FIELD = "relative block w-full rounded-xl border border-line-strong bg-transparent px-3.5 py-2.5 text-base text-ink placeholder:text-placeholder transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-coral/40 aria-[invalid=true]:border-coral-deep";
const MIRROR = "pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-transparent px-3.5 py-2.5 text-base text-transparent";

/** Rule hints for a text, recomputed 300 ms after the last keystroke. */
export function useLiveCheck(text: string, sector: Sector, platform: Platform): LiveFinding[] {
  const [state, setState] = useState<LiveFinding[]>(() => liveCheck(text, sector, platform));
  useEffect(() => {
    const t = setTimeout(() => setState(liveCheck(text, sector, platform)), 300);
    return () => clearTimeout(t);
  }, [text, sector, platform]);
  return state;
}

function ranges(text: string, findings: LiveFinding[]) {
  const lower = text.toLocaleLowerCase("tr-TR");
  const out: { start: number; end: number; severity: LiveFinding["severity"] }[] = [];
  for (const f of findings) {
    const needle = f.matchedText.toLocaleLowerCase("tr-TR");
    const idx = needle ? lower.indexOf(needle) : -1;
    if (idx < 0) continue;
    const end = idx + needle.length;
    if (out.some((r) => idx < r.end && end > r.start)) continue;
    out.push({ start: idx, end, severity: f.severity });
  }
  return out.sort((a, b) => a.start - b.start);
}

function Underlined({ text, findings }: { text: string; findings: LiveFinding[] }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges(text, findings).forEach((r, i) => {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(<span key={i} className={UNDERLINE[r.severity]}>{text.slice(r.start, r.end)}</span>);
    cursor = r.end;
  });
  parts.push(text.slice(cursor));
  // A trailing space keeps the last line's height when the text ends with a line break.
  return <>{parts}{" "}</>;
}

/** The findings under a field: level, phrase, short explanation, rule card link and the safe version. */
export function LiveFindings({ findings, onApply, label }: { findings: LiveFinding[]; onApply: (text: string) => void; label: string }) {
  const counts = { red: findings.filter((f) => f.severity === "red").length, yellow: findings.filter((f) => f.severity === "yellow").length, info: findings.filter((f) => f.severity === "info").length };
  const summary = findings.length
    ? `${label}: ${findings.length} riskli ifade (${[counts.red ? `${counts.red} kırmızı` : "", counts.yellow ? `${counts.yellow} sarı` : "", counts.info ? `${counts.info} bilgilendirme` : ""].filter(Boolean).join(", ")}).`
    : "";
  return (
    <div className="grid gap-1.5" data-live-findings>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{summary}</p>
      {findings.length ? (
        <ul className="grid gap-1.5" aria-label="Canlı kural uyarıları">
          {findings.map((f) => (
            <li key={f.ruleId} className="rounded-lg border border-line bg-paper-2 text-meta">
              <details>
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${PILL[f.severity]}`}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {SEVERITY_LABEL[f.severity]}
                  </span>
                  <span className="font-semibold text-ink">&ldquo;{f.matchedText}&rdquo;</span>
                  <span className="text-ink-soft">{f.title}</span>
                </summary>
                <div className="grid gap-2 border-t border-line px-3 py-2 text-ink-soft">
                  <p>{f.explanation}</p>
                  {f.suggestion ? <p>Öneri: {f.suggestion}</p> : null}
                  {f.unverified ? <p>Bu kart henüz hukukçu incelemesinden geçmedi; mevzuat ihlali sayılmaz, yalnızca bilgilendirir.</p> : null}
                  <div className="flex flex-wrap items-center gap-3">
                    {f.safeText ? (
                      <button type="button" onClick={() => onApply(f.safeText!)} className="inline-flex min-h-10 items-center rounded-lg bg-ink px-3 font-semibold text-paper hover:bg-navy-700">
                        Güvenli sürümü uygula<span className="sr-only">: {f.matchedText}</span>
                      </button>
                    ) : (
                      <span>Bu ifade için hazır bir karşılık yok; metni elle düzelt.</span>
                    )}
                    <a href={`/kurallar#${f.ruleId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue">
                      Kural kartı<span className="sr-only">: {f.title} (yeni sekmede açılır)</span>
                    </a>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Common = { id: string; value: string; onChange: (v: string) => void; sector: Sector; platform: Platform; label: string; maxLength?: number; placeholder?: string; name?: string; required?: boolean; invalid?: boolean; describedBy?: string };

/**
 * A text field that underlines risky phrases while the user types (red, yellow or information, as in
 * the report) and lists them below with a one-click safe version. Nothing leaves the browser.
 */
export function LiveTextField(props: Common & ({ multiline: true; rows?: number } | { multiline?: false })) {
  const { id, value, onChange, sector, platform, label, maxLength, placeholder, name, required, invalid, describedBy } = props;
  const findings = useLiveCheck(value, sector, platform);
  const mirror = useRef<HTMLDivElement>(null);
  const hint = useId();
  const sync = (el: HTMLTextAreaElement | HTMLInputElement) => {
    if (!mirror.current) return;
    mirror.current.scrollTop = el.scrollTop;
    mirror.current.scrollLeft = el.scrollLeft;
  };
  const shared = {
    id,
    name,
    value,
    maxLength,
    placeholder,
    required,
    "aria-invalid": invalid || undefined,
    "aria-describedby": [describedBy, findings.length ? hint : null].filter(Boolean).join(" ") || undefined,
    className: FIELD,
    onScroll: (e: React.UIEvent<HTMLTextAreaElement | HTMLInputElement>) => sync(e.currentTarget),
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => sync(e.currentTarget),
  };
  const marks = useMemo(() => <Underlined text={value} findings={findings} />, [value, findings]);
  return (
    <div className="grid gap-2">
      <div className="relative rounded-xl bg-field/70">
        <div ref={mirror} aria-hidden className={`${MIRROR} ${props.multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>
          {marks}
        </div>
        {props.multiline ? (
          <textarea {...shared} rows={props.rows ?? 4} onChange={(e) => { onChange(e.target.value); sync(e.currentTarget); }} />
        ) : (
          <input {...shared} onChange={(e) => { onChange(e.target.value); sync(e.currentTarget); }} />
        )}
      </div>
      {findings.length ? <p id={hint} className="sr-only">Altı çizili ifadeler kural motoruna takıldı; ayrıntılar alanın altında.</p> : null}
      <LiveFindings findings={findings} onApply={onChange} label={label} />
    </div>
  );
}
