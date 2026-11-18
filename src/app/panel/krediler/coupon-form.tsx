"use client";

import { useActionState } from "react";
import { inputClass, selectClass } from "@/components/ui";
import { reserveCouponAction, type CouponState } from "./coupon-actions";

export function CouponForm({ packages }: { packages: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<CouponState, FormData>(reserveCouponAction, { error: null });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] sm:items-end">
      <div className="grid gap-1.5">
        <label htmlFor="kupon-kod" className="text-small font-semibold">Kupon kodu</label>
        <input id="kupon-kod" name="code" key={`c-${state.code ?? ""}`} defaultValue={state.code} required autoComplete="off" maxLength={24} className={`${inputClass} uppercase`} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="kupon-paket" className="text-small font-semibold">Paket</label>
        <select id="kupon-paket" name="packageId" key={`p-${state.packageId ?? ""}`} className={selectClass} defaultValue={state.packageId ?? packages[0]?.id}>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-ink px-5 text-small font-semibold text-paper disabled:opacity-50">
        {pending ? "Kontrol ediliyor…" : "Kuponu uygula"}
      </button>
      {state.error ? <p role="alert" className="text-small font-medium text-coral-deep sm:col-span-3">{state.error}</p> : null}
      {state.ok ? <p role="status" className="text-small font-medium text-green sm:col-span-3">{state.ok}</p> : null}
    </form>
  );
}
