"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, inputClass, selectClass } from "@/components/ui";
import { addWatchAction, type WatchState } from "./actions";

export function WatchForm({ countries, disabled }: { countries: [string, string][]; disabled: boolean }) {
  const [state, action, pending] = useActionState<WatchState, FormData>(addWatchAction, { error: null });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3 rounded-2xl border border-line bg-card p-5 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
      <div className="grid gap-1.5">
        <label htmlFor="watch-term" className="text-sm font-semibold text-ink">Sayfa adı ya da anahtar kelime</label>
        <input id="watch-term" name="term" required minLength={2} maxLength={100} className={inputClass} placeholder="ör. rakip marka adı ya da ürün türü" disabled={disabled} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="watch-country" className="text-sm font-semibold text-ink">Ülke (AB)</label>
        <select id="watch-country" name="country" defaultValue="DE" className={selectClass} disabled={disabled}>
          {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      <Button type="submit" variant="primary" disabled={pending || disabled}>{pending ? "Ekleniyor…" : "İzlemeye al"}</Button>
      {state.error ? <p role="alert" className="text-small font-medium text-coral-deep sm:col-span-3">{state.error}</p> : null}
    </form>
  );
}
