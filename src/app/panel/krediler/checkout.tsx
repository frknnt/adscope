"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditExamples } from "@/components/pricing-terms";
import { Button } from "@/components/ui";
import { formatTry, type CreditPackage } from "@/lib/payments/packages";
import { DemoPurchaseButton } from "../forms";

/**
 * Credit packages with the checkout consent. When a payment provider is live, the pre-information form
 * and the distance sales contract are ticked once for the page; every payment form then carries them as
 * hidden fields. The server action checks them again and records the document versions.
 */
export function PackageGrid({
  packages,
  providers,
  demo,
  action,
}: {
  packages: CreditPackage[];
  providers: { id: string; label: string }[];
  demo: boolean;
  action: (form: FormData) => Promise<void>;
}) {
  const [preInfo, setPreInfo] = useState(false);
  const [contract, setContract] = useState(false);
  const ready = preInfo && contract;
  return (
    <>
      {providers.length ? (
        <fieldset className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-card">
          <legend className="sr-only">Ödeme öncesi onaylar</legend>
          <p className="text-small font-semibold text-ink">Ödemeye geçmeden önce</p>
          <label className="mt-3 flex items-start gap-3 text-body text-ink-soft">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-blue)]" checked={preInfo} onChange={(e) => setPreInfo(e.target.checked)} />
            <span>
              <Link href="/on-bilgilendirme-formu" target="_blank" className="font-semibold text-ink">Ön bilgilendirme formunu</Link> okudum.
            </span>
          </label>
          <label className="mt-2 flex items-start gap-3 text-body text-ink-soft">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-blue)]" checked={contract} onChange={(e) => setContract(e.target.checked)} />
            <span>
              <Link href="/mesafeli-satis-sozlesmesi" target="_blank" className="font-semibold text-ink">Mesafeli satış sözleşmesini</Link> kabul ediyorum. Kredilerin ödeme onaylanınca hesabıma anında tanımlanan dijital bir hizmet olduğunu ve bu nedenle cayma hakkım bulunmadığını biliyorum.
            </span>
          </label>
          {ready ? null : <p id="odeme-onay-ipucu" className="mt-3 text-small text-muted">Ödeme düğmeleri iki kutu işaretlenince açılır.</p>}
        </fieldset>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((p) => (
          <div key={p.id} className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold">{p.name}</h3>
              <span className="font-display text-2xl font-semibold tabular">{formatTry(p.priceMinor)}</span>
            </div>
            <p className="mt-1 text-ink-soft">
              <span className="tabular">{p.credits}</span> analiz · {p.description}
            </p>
            <CreditExamples credits={p.credits} className="mt-1 text-muted" />
            <div className="mt-5 grid gap-2">
              {providers.map((pr) => (
                <form key={pr.id} action={action}>
                  <input type="hidden" name="provider" value={pr.id} />
                  <input type="hidden" name="packageId" value={p.id} />
                  {ready ? (
                    <>
                      <input type="hidden" name="onBilgilendirme" value="on" />
                      <input type="hidden" name="mesafeliSatis" value="on" />
                    </>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={!ready} aria-describedby={ready ? undefined : "odeme-onay-ipucu"}>
                    {pr.label} ile öde
                  </Button>
                </form>
              ))}
              {demo ? <DemoPurchaseButton packageId={p.id} label={`Demo: ${p.credits} kredi ekle (ödeme yok)`} /> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
