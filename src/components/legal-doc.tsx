import type { ReactNode } from "react";
import { COMPANY } from "@/lib/legal";

/** Long-form legal page. Content is a pre-production draft and says so. */
export function LegalDoc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Son güncelleme: {updated}</p>
      <p className="mt-6 rounded-xl border border-amber/30 bg-amber-tint px-4 py-3 text-body leading-relaxed text-ink" role="note">
        <strong>Taslak metin, avukata kontrol ettirilecek.</strong> Bu metin ürünün işleyişini anlatan bir ön taslaktır ve hukuki görüş değildir. Yayına almadan önce köşeli parantez içindeki şirket bilgileri doldurulmalı ve metin bir avukat tarafından gözden geçirilmelidir.
      </p>
      <div className="legal mt-10 space-y-5 leading-relaxed text-ink-soft [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}

export { CONTROLLER } from "@/lib/legal";

/** Seller / controller identity block, the same on every legal page. */
export function CompanyDetails({ heading = "Satıcı ve veri sorumlusu" }: { heading?: string }) {
  const rows: [string, string][] = [
    ["Unvan", COMPANY.name],
    ["Adres", COMPANY.address],
    ["Vergi dairesi ve numarası", `${COMPANY.taxOffice} / ${COMPANY.taxNo}`],
    ["E-posta", COMPANY.email],
    ["KEP", COMPANY.kep],
  ];
  return (
    <>
      <h2>{heading}</h2>
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[12rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold text-ink">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
