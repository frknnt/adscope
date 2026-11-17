"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/* ---------- Tabs: WAI-ARIA tabs with roving focus (arrow keys, Home, End). ---------- */

export function Tabs({ label, tabs, initial = 0 }: { label: string; tabs: { title: string; content: ReactNode; /** Opens this tab when the URL hash equals it, or contains an element with that id. */ hash?: string }[]; initial?: number }) {
  const [active, setActive] = useState(initial);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const hashes = tabs.map((t) => t.hash ?? "").join("|");

  useEffect(() => {
    if (!hashes.replace(/\|/g, "")) return;
    const sync = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (!h) return;
      const list = hashes.split("|");
      const i = list.findIndex((x) => x && x === h);
      if (i >= 0) {
        // Opening the tab that holds the linked section (e.g. #itiraz after an appeal is saved).
        setActive(i);
        requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: "start" }));
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [hashes]);

  function onKey(e: KeyboardEvent) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (active === last ? 0 : active + 1) : e.key === "ArrowLeft" ? (active === 0 ? last : active - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button
            key={t.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-t${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-p${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-small font-semibold transition-colors ${i === active ? "border-blue text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.title}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.title} role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={i !== active} tabIndex={0} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/* ---------- Dialog: native <dialog> (focus trap, Esc and inert background come from the browser). ---------- */

export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-float backdrop:bg-[rgb(var(--shadow-color)/0.45)]"
    >
      <div className="p-6">
        <h2 id={titleId} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        <div className="mt-3 text-ink-soft">{children}</div>
      </div>
      {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
    </dialog>
  );
}

/* ---------- Toast: short, polite status messages; one live region for the whole app. ---------- */

type Toast = { id: number; text: string; tone: "info" | "success" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const TONE: Record<Toast["tone"], string> = {
  info: "bg-ink text-paper",
  success: "bg-green-tint text-green border border-green/30",
  error: "bg-coral-tint text-coral-deep border border-coral/30",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-small font-semibold shadow-raised ${TONE[t.tone]}`}>
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
