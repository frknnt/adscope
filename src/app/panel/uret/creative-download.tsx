"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { downloadCreativeAction, type CreativeDownloadState } from "./creative-actions";

/** Paid full-size download of one layout: the selected size as PNG, or every size in a ZIP. */
export function CreativeDownload({ layout, layoutLabel, size, sizeLabel, query, disabled }: { layout: string; layoutLabel: string; size: string; sizeLabel: string; query: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<CreativeDownloadState, FormData>(downloadCreativeAction, { error: null });
  // One request id per choice; a second click on the same choice is not charged again.
  const [ids] = useState(() => ({ one: crypto.randomUUID(), all: crypto.randomUUID() }));
  const link = useRef<HTMLAnchorElement>(null);
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (state.href && opened.current !== state.href) {
      opened.current = state.href;
      link.current?.click();
    }
  }, [state.href]);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {([
          ["one", size, `PNG indir (${sizeLabel})`],
          ["all", "hepsi", "Tüm boyutlar (ZIP)"],
        ] as const).map(([k, value, label]) => (
          <form key={k} action={action}>
            <input type="hidden" name="requestId" value={ids[k]} />
            <input type="hidden" name="layout" value={layout} />
            <input type="hidden" name="size" value={value} />
            <input type="hidden" name="query" value={query} />
            <button type="submit" disabled={disabled || pending} className="inline-flex min-h-10 items-center rounded-xl border border-line-strong bg-card px-3.5 text-small font-semibold text-ink hover:border-ink disabled:opacity-50">
              {label}
              <span className="sr-only">: {layoutLabel}</span>
            </button>
          </form>
        ))}
      </div>
      <p className="text-meta text-muted">{pending ? "Hazırlanıyor…" : "Her indirme 1 kredi; aynı düğmeye ikinci kez basmak yeniden ücretlendirmez."}</p>
      {state.href ? (
        <a ref={link} href={state.href} download className="text-small font-semibold text-blue">
          Dosya hazır, indirme başlamadıysa buraya dokun<span className="sr-only">: {layoutLabel}</span>
        </a>
      ) : null}
      {state.error ? <p role="alert" className="text-small font-medium text-coral-deep">{state.error}</p> : null}
    </div>
  );
}
