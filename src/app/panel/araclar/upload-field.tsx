"use client";

import { useEffect, useState } from "react";
import { IconUpload } from "@/components/icons";

export const ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_BYTES = 5 * 1024 * 1024;

/** Large, thumb-friendly file picker with a preview of the chosen photo. */
export function UploadField({ id, label, file, onFile, hint }: { id: string; label: string; file: File | null; onFile: (f: File | null, error: string | null) => void; hint?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL tied to the selected file
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-card px-4 py-5 text-center hover:border-ink focus-within:border-ink focus-within:ring-2 focus-within:ring-coral/40">
        <IconUpload className="size-6 text-ink-soft" aria-hidden />
        <span className="font-semibold text-ink">{file ? "Başka fotoğraf seç" : label}</span>
        <span className="text-meta text-muted">{hint ?? "JPG, PNG ya da WebP, en fazla 5 MB."}</span>
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (!f) return onFile(null, null);
            if (!ACCEPT.split(",").includes(f.type)) return onFile(null, "Yalnızca JPG, PNG ya da WebP seçebilirsin.");
            if (f.size > MAX_BYTES) return onFile(null, "Dosya 5 MB sınırını aşıyor.");
            onFile(f, null);
          }}
        />
      </label>
      {file && url ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Seçilen fotoğraf" className="size-16 rounded-lg object-contain bg-paper-2" />
          <span className="min-w-0 truncate text-small text-ink-soft">{file.name}</span>
        </div>
      ) : null}
    </div>
  );
}
