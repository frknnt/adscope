"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input readOnly value={url} aria-label="Davet bağlantın" className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-paper-2 px-4 text-small tabular text-ink" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-xl bg-ink px-4 text-small font-semibold text-paper"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
          } catch {
            setDone(false);
          }
        }}
      >
        {done ? "Kopyalandı" : "Bağlantıyı kopyala"}
      </button>
      <span role="status" className="sr-only">{done ? "Davet bağlantısı kopyalandı." : ""}</span>
    </div>
  );
}
