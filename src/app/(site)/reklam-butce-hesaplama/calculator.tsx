"use client";

import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui";
import { calculateBudget, parseNumber, type BudgetInput } from "@/lib/calc/budget";

type Key = keyof BudgetInput;
const FIELDS: { key: Key; label: string; hint?: string; suffix: string; percent?: boolean }[] = [
  { key: "price", label: "Satış fiyatı (KDV dahil)", suffix: "TL" },
  { key: "cost", label: "Ürün maliyeti", suffix: "TL" },
  { key: "shipping", label: "Kargo ve paketleme", suffix: "TL" },
  { key: "feeRate", label: "Ödeme ya da pazaryeri komisyonu", suffix: "%", percent: true },
  { key: "cpc", label: "Beklenen tıklama maliyeti (TBM)", suffix: "TL" },
  { key: "ctr", label: "Beklenen tıklama oranı (TO)", suffix: "%", percent: true },
  { key: "conversionRate", label: "Beklenen dönüşüm oranı", hint: "Tıklayanların yüzde kaçı satın alıyor?", suffix: "%", percent: true },
  { key: "dailyBudget", label: "Günlük reklam bütçesi", suffix: "TL" },
  { key: "targetRoas", label: "Hedef ROAS (isteğe bağlı)", hint: "ör. 3 = harcanan her 1 TL için 3 TL ciro", suffix: "x" },
];

const DEFAULTS: Record<Key, string> = { price: "600", cost: "220", shipping: "45", feeRate: "3", cpc: "4,5", ctr: "1,2", conversionRate: "1,8", dailyBudget: "500", targetRoas: "" };

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const pct = (n: number) => `%${num.format(n * 100)}`;

export function BudgetCalculator() {
  const [values, setValues] = useState(DEFAULTS);
  const input = useMemo(() => {
    const out = {} as BudgetInput;
    for (const f of FIELDS) out[f.key] = parseNumber(values[f.key]) / (f.percent ? 100 : 1);
    return out;
  }, [values]);
  const r = useMemo(() => calculateBudget(input), [input]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form className="grid content-start gap-4 rounded-2xl border border-line bg-card p-5 shadow-card" onSubmit={(e) => e.preventDefault()} aria-label="Hesaplama girdileri">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label htmlFor={`b-${f.key}`} className="text-sm font-semibold text-ink">{f.label}</label>
            <div className="relative">
              <input
                id={`b-${f.key}`}
                inputMode="decimal"
                autoComplete="off"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.slice(0, 16) }))}
                className={`${inputClass} pr-12 tabular`}
                aria-describedby={f.hint ? `b-${f.key}-hint` : undefined}
              />
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-small font-semibold text-muted">{f.suffix}</span>
            </div>
            {f.hint ? <p id={`b-${f.key}-hint`} className="text-meta text-muted">{f.hint}</p> : null}
          </div>
        ))}
        <button type="button" onClick={() => setValues(DEFAULTS)} className="min-h-11 justify-self-start rounded-xl px-2 text-small font-semibold text-blue hover:underline">Örnek değerlere dön</button>
      </form>

      <section aria-labelledby="sonuclar" aria-live="polite" className="grid content-start gap-5">
        <h2 id="sonuclar" className="font-display text-2xl font-semibold">Sonuçlar</h2>
        {r.warnings.map((w) => <p key={w} className="rounded-xl bg-amber-tint px-4 py-3 text-small text-ink">{w}</p>)}
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label="Sipariş başına katkı payı" value={tl.format(r.margin)} note={`Fiyatın ${pct(r.marginRate)}'i; reklam öncesi kalan`} />
          <Stat label="Başa baş ROAS" value={r.breakEvenRoas === null ? "Yok" : `${num.format(r.breakEvenRoas)}x`} note="Bunun altında reklam zarar ettirir" strong />
          <Stat label="En fazla dönüşüm başına maliyet" value={tl.format(r.breakEvenCpa)} note="Bir sipariş için harcayabileceğin üst sınır" />
          <Stat label="Başa baş TBM" value={tl.format(r.breakEvenCpc)} note="Beklenen dönüşüm oranıyla tıklama başına üst sınır" />
          <Stat label="Başa baş BGBM" value={tl.format(r.breakEvenCpm)} note="Beklenen TO ve dönüşümle bin gösterim üst sınırı" />
          <Stat label="Gereken dönüşüm oranı" value={r.requiredConversionRate === null ? "Hesaplanamadı" : pct(r.requiredConversionRate)} note="Beklenen TBM ile başa baş için" />
        </dl>
        {r.target ? (
          <p className="rounded-xl bg-paper-2 px-4 py-3 text-small text-ink">
            Hedef ROAS ile sipariş başına en fazla <strong>{tl.format(r.target.cpa)}</strong> harcayabilirsin; sipariş başına kalan kâr <strong className={r.target.profitPerOrder < 0 ? "text-coral-deep" : ""}>{tl.format(r.target.profitPerOrder)}</strong>.
          </p>
        ) : null}

        <h3 className="mt-2 text-lg font-bold">Aylık senaryolar (30 gün)</h3>
        <div className="overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Aylık senaryolar tablosu">
          <table className="w-full min-w-[34rem] text-left text-small">
            <caption className="sr-only">Dönüşüm oranına göre aylık kâr senaryoları</caption>
            <thead className="bg-paper-2 text-meta text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Senaryo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Dönüşüm</th>
                <th scope="col" className="px-4 py-3 font-semibold">Sipariş</th>
                <th scope="col" className="px-4 py-3 font-semibold">Harcama</th>
                <th scope="col" className="px-4 py-3 font-semibold">ROAS</th>
                <th scope="col" className="px-4 py-3 font-semibold">Kâr</th>
              </tr>
            </thead>
            <tbody>
              {r.scenarios.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">{s.label}</th>
                  <td className="px-4 py-3 tabular">{pct(s.conversionRate)}</td>
                  <td className="px-4 py-3 tabular">{num.format(s.ordersPerMonth)}</td>
                  <td className="px-4 py-3 tabular">{tl.format(s.spendPerMonth)}</td>
                  <td className="px-4 py-3 tabular">{s.roas === null ? "-" : `${num.format(s.roas)}x`}</td>
                  <td className={`px-4 py-3 font-bold tabular ${s.profitPerMonth < 0 ? "text-coral-deep" : "text-green"}`}>{tl.format(s.profitPerMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rounded-xl bg-paper-2 px-4 py-3 text-small leading-relaxed text-ink-soft" role="note">
          <strong className="font-semibold text-ink">Sonuçlar tahmindir.</strong> Hesap girdiğin rakamlara dayanır; iadeler, vergiler, sabit giderler ve gerçek kampanya performansı sonucu değiştirir. Kâr ya da satış garantisi değildir.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, note, strong }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${strong ? "border-ink bg-card" : "border-line bg-card"}`}>
      <dt className="text-meta font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular text-ink">{value}</dd>
      <dd className="mt-1 text-meta text-ink-soft">{note}</dd>
    </div>
  );
}
