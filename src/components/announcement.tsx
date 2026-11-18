"use client";

import Link from "next/link";
import { useState } from "react";

/** Thin top bar for real product news only (no fake countdowns or sales). Dismissal lasts for the visit. */
export function Announcement({ text, href, cta }: { text: string; href: string; cta: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="no-print relative bg-navy-950 px-12 py-0 text-center text-meta text-paper/90">
      <span className="mr-2 rounded-full bg-blue px-2 py-0.5 text-fine font-bold uppercase tracking-wide text-paper">Yeni</span>
      {text}{" "}
      <Link href={href} className="inline-flex min-h-11 items-center font-bold text-paper underline underline-offset-2">
        {cta}
      </Link>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Duyuruyu kapat"
        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-paper/80 hover:bg-paper/10 hover:text-paper"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
