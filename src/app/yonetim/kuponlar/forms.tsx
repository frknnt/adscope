"use client";

import { useActionState } from "react";
import { inputClass, selectClass } from "@/components/ui";
import { createCouponAction, grantPartnerAction, type GrowthState } from "../actions";

function Msg({ state }: { state: GrowthState }) {
  if (state.error) return <p role="alert" className="text-small font-medium text-coral-deep sm:col-span-2">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-small font-medium text-green sm:col-span-2">{state.ok}</p>;
  return null;
}

function F({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-small font-semibold">{label}</label>
      {children}
      {hint ? <p id={`${id}-hint`} className="text-meta text-muted">{hint}</p> : null}
    </div>
  );
}

export function CouponCreateForm({ packages }: { packages: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<GrowthState, FormData>(createCouponAction, { error: null });
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <F id="c-code" label="Kod" hint="4-24 karakter: harf, rakam, tire. Büyük harfe çevrilir.">
        <input id="c-code" name="code" required maxLength={24} className={`${inputClass} uppercase`} aria-describedby="c-code-hint" />
      </F>
      <F id="c-kind" label="Tür" hint="Shopier sabit ödeme bağlantısı kullandığı için yalnızca ek kredi kuponları kullanılabilir.">
        <select id="c-kind" name="kind" className={selectClass} defaultValue="bonus_credits" aria-describedby="c-kind-hint">
          <option value="bonus_credits">Ek kredi</option>
          <option value="percent">Yüzde indirim (şimdilik uygulanamaz)</option>
          <option value="fixed">Sabit indirim, kuruş (şimdilik uygulanamaz)</option>
        </select>
      </F>
      <F id="c-value" label="Değer" hint="Ek kredi adedi, yüzde ya da kuruş.">
        <input id="c-value" name="value" inputMode="numeric" required className={inputClass} aria-describedby="c-value-hint" />
      </F>
      <F id="c-label" label="Kampanya adı (isteğe bağlı)" hint="Doluysa kupon aktifken fiyatlandırma sayfasında şerit olarak görünür.">
        <input id="c-label" name="campaignLabel" maxLength={120} className={inputClass} aria-describedby="c-label-hint" />
      </F>
      <F id="c-start" label="Başlangıç (YYYY-AA-GG, boşsa hemen)">
        <input id="c-start" name="startsAt" type="date" className={inputClass} />
      </F>
      <F id="c-end" label="Bitiş (YYYY-AA-GG, boşsa süresiz)">
        <input id="c-end" name="expiresAt" type="date" className={inputClass} />
      </F>
      <F id="c-max" label="Toplam kullanım sınırı (boşsa sınırsız)">
        <input id="c-max" name="maxRedemptions" inputMode="numeric" className={inputClass} />
      </F>
      <F id="c-per" label="Kişi başı kullanım">
        <input id="c-per" name="perUserLimit" inputMode="numeric" defaultValue="1" className={inputClass} />
      </F>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="text-small font-semibold">Paket kısıtı (hiçbiri seçilmezse tüm paketler)</legend>
        <div className="flex flex-wrap gap-4">
          {packages.map((p) => (
            <label key={p.id} className="flex min-h-11 items-center gap-2 text-body">
              <input type="checkbox" name="packageIds" value={p.id} className="size-5 accent-[var(--color-blue)]" /> {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-ink px-5 text-small font-semibold text-paper disabled:opacity-50">{pending ? "Kaydediliyor…" : "Kupon oluştur"}</button>
      </div>
      <Msg state={state} />
    </form>
  );
}

export function PartnerForm() {
  const [state, action, pending] = useActionState<GrowthState, FormData>(grantPartnerAction, { error: null });
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <F id="p-email" label="Kullanıcının e-postası">
        <input id="p-email" name="email" type="email" required className={inputClass} />
      </F>
      <F id="p-pct" label="Komisyon (%)" hint="Varsayılan %20. Yalnızca kayıt tutulur; ödeme elle yapılır.">
        <input id="p-pct" name="percent" inputMode="decimal" defaultValue="20" required className={inputClass} aria-describedby="p-pct-hint" />
      </F>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-ink px-5 text-small font-semibold text-paper disabled:opacity-50">{pending ? "Kaydediliyor…" : "Ortaklık kodu ver"}</button>
      </div>
      <Msg state={state} />
    </form>
  );
}
