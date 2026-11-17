import type { ReactNode } from "react";

/** Long-form legal page. Content is a pre-production draft and says so. */
export function LegalDoc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Son güncelleme: {updated}</p>
      <p className="mt-6 rounded-xl border border-amber/30 bg-amber-tint px-4 py-3 text-body leading-relaxed text-ink" role="note">
        <strong>Taslak metin.</strong> Bu metin ürünün işleyişini anlatan bir ön taslaktır; yayına almadan önce veri sorumlusu bilgileri doldurulmalı ve bir hukukçu tarafından gözden geçirilmelidir.
      </p>
      <div className="legal mt-10 space-y-5 leading-relaxed text-ink-soft [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}

export const CONTROLLER = "[Veri sorumlusunun unvanı, adresi ve iletişim e-postası yayına almadan önce eklenecek]";
