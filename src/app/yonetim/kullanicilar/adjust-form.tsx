"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/ui";
import { adjustCreditsAction, type AdjustState } from "../actions";

export function AdjustForm({ userId, email }: { userId: string; email: string }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<AdjustState, FormData>(adjustCreditsAction, { error: null });
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-1">
        <label htmlFor={`d-${userId}`} className="text-meta font-semibold">Kredi (±)</label>
        <input id={`d-${userId}`} name="delta" inputMode="numeric" required className={`${inputClass} h-10`} />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`r-${userId}`} className="text-meta font-semibold">Gerekçe (zorunlu)</label>
        <input id={`r-${userId}`} name="reason" required minLength={5} maxLength={300} className={`${inputClass} h-10`} />
      </div>
      <button type="submit" disabled={pending || Boolean(state.ok)} className="min-h-10 rounded-xl bg-ink px-4 text-small font-semibold text-paper disabled:opacity-50" aria-label={`${email} için krediyi düzelt`}>
        {pending ? "Yazılıyor…" : "Deftere yaz"}
      </button>
      {state.error ? <p role="alert" className="text-meta font-medium text-coral-deep sm:col-span-3">{state.error}</p> : null}
      {state.ok ? <p role="status" className="text-meta font-medium text-green sm:col-span-3">{state.ok} Yeni bir düzeltme için sayfayı yenile.</p> : null}
    </form>
  );
}
