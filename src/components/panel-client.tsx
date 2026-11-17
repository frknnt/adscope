"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconImage, IconVideo } from "@/components/icons";

/* ---------- AdThumb: the creative (or first video frame), with a quiet fallback. ---------- */

export function AdThumb({ id, mediaType, className = "" }: { id: string; mediaType: "image" | "video"; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/analyses/${id}/asset${mediaType === "video" ? "?frame=0" : ""}`;
  return (
    <div className={`relative overflow-hidden bg-tint ${className}`}>
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-muted" aria-hidden>
          {mediaType === "video" ? <IconVideo className="size-8" /> : <IconImage className="size-8" />}
        </span>
      ) : (
        // Private, per-user asset route: next/image would need a loader for it, a plain img is enough.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      )}
      {mediaType === "video" ? (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-ink/85 px-1.5 py-0.5 text-fine font-bold text-paper">
          <IconVideo className="size-3.5" aria-hidden /> Video
        </span>
      ) : null}
    </div>
  );
}

/* ---------- Menu: a button that opens a keyboard-navigable list of actions. ---------- */

export type MenuItem = { label: string; href?: string; onSelect?: () => void; danger?: boolean; download?: boolean };

export function Menu({ label, items, trigger, triggerClassName }: { label: string; items: MenuItem[]; trigger: ReactNode; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    const els = [...(list.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") els[(i + 1) % els.length]?.focus();
    else if (e.key === "ArrowUp") els[(i - 1 + els.length) % els.length]?.focus();
    else if (e.key === "Home") els[0]?.focus();
    else if (e.key === "End") els[els.length - 1]?.focus();
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") button.current?.focus();
      if (e.key === "Tab") return;
    } else return;
    e.preventDefault();
  }

  const itemCls = (danger?: boolean) =>
    `flex min-h-11 w-full items-center rounded-lg px-3 text-left text-small font-semibold no-underline outline-none focus-visible:bg-paper-2 hover:bg-paper-2 ${danger ? "text-coral-deep" : "text-ink"}`;

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => {
          // Open upwards when the list would run under the viewport edge (or the mobile bottom bar).
          const r = button.current?.getBoundingClientRect();
          setUp(!!r && r.bottom + 56 * items.length + 110 > window.innerHeight);
          setOpen((v) => !v);
        }}
        className={triggerClassName ?? "inline-flex size-11 items-center justify-center rounded-xl text-ink-soft hover:bg-paper-2 hover:text-ink"}
      >
        {trigger}
      </button>
      {open ? (
        <ul ref={list} id={id} role="menu" aria-label={label} onKeyDown={onKey} className={`absolute right-0 z-20 w-48 ${up ? "bottom-full mb-1" : "top-full mt-1"} rounded-xl border border-line bg-card p-1.5 shadow-float`}>
          {items.map((it) => (
            <li key={it.label} role="none">
              {it.href ? (
                <a role="menuitem" tabIndex={-1} href={it.href} download={it.download || undefined} className={itemCls(it.danger)} onClick={() => setOpen(false)}>
                  {it.label}
                </a>
              ) : (
                <button
                  role="menuitem"
                  tabIndex={-1}
                  type="button"
                  className={itemCls(it.danger)}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                >
                  {it.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
