"use client";

import { startTransition, useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { APPROVAL_COMMENT_MAX, APPROVAL_DECISIONS, DECISION_ACTION, DECISION_LABEL, REVIEWER_NAME_MAX, type ApprovalItem } from "@/lib/approval";
import type { ApprovalDecision } from "@/lib/data/types";
import { submitApprovalAction, type ApprovalState } from "./actions";

const TONE: Record<ApprovalDecision, string> = {
  approved: "peer-checked:border-green peer-checked:bg-green-tint peer-checked:text-green",
  changes_requested: "peer-checked:border-amber peer-checked:bg-amber-tint peer-checked:text-amber",
  rejected: "peer-checked:border-coral-deep peer-checked:bg-coral-tint peer-checked:text-coral-deep",
};

export interface ApprovalFormItem extends ApprovalItem {
  current: { decision: ApprovalDecision; comment: string | null; reviewerName: string } | null;
  /** Image or frame URLs behind the token. */
  media: { src: string; alt: string }[];
}

/** Per-item decision form. Works without JavaScript too (plain radios and textareas in one form). */
export function ApprovalForm({ token, items, defaultName }: { token: string; items: ApprovalFormItem[]; defaultName: string }) {
  const [state, action, pending] = useActionState(submitApprovalAction.bind(null, token), { status: "idle" } as ApprovalState);
  return (
    <form
      action={action}
      // With JavaScript, submit without React's automatic form reset so a rejected submission keeps the choices.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-6"
    >
      <div aria-hidden className="hidden">
        <label>
          Web sitesi <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Adın" htmlFor="reviewer-name" hint="Kararların bu adla ajansa iletilir. E-posta adresi istemiyoruz.">
        <input id="reviewer-name" name="reviewerName" required maxLength={REVIEWER_NAME_MAX} defaultValue={defaultName} autoComplete="name" className={`${inputClass} max-w-md`} />
      </Field>
      <ol className="grid gap-5">
        {items.map((it, n) => (
          <li key={it.key} className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
            <fieldset>
              <legend className="text-lg font-bold">
                <span className="text-muted tabular">{n + 1}.</span> {it.label}
              </legend>
              {it.current ? (
                <p className="mt-1 text-meta text-muted">
                  Son karar: <strong className="text-ink">{DECISION_LABEL[it.current.decision]}</strong> ({it.current.reviewerName})
                </p>
              ) : null}
              {it.kind === "text" ? (
                <div className="mt-3 rounded-xl bg-paper-2 px-4 py-3 text-body">
                  {it.headline ? <p className="font-bold">{it.headline}</p> : null}
                  <p className="mt-1 whitespace-pre-line">{it.primaryText}</p>
                  {it.description ? <p className="mt-1 text-ink-soft">{it.description}</p> : null}
                </div>
              ) : (
                <div className={`mt-3 grid gap-2 ${it.media.length > 1 ? "grid-cols-2 sm:grid-cols-3" : ""}`}>
                  {it.media.map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.src} src={m.src} alt={m.alt} className="max-h-[28rem] w-full rounded-xl border border-line bg-paper-2 object-contain" />
                  ))}
                  {it.kind === "video" ? <p className="col-span-full text-meta text-muted">Videonun kendisi AdScope&apos;a yüklenmez; burada videodan alınan kareler görünür.</p> : null}
                </div>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={`${it.label} için karar`}>
                {APPROVAL_DECISIONS.map((d) => (
                  <label key={d} className="relative block">
                    <input type="radio" name={`d:${it.key}`} value={d} defaultChecked={it.current?.decision === d} className="peer sr-only" />
                    <span className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line-strong px-3 text-center text-small font-bold text-ink transition peer-focus-visible:ring-2 peer-focus-visible:ring-coral/40 ${TONE[d]}`}>
                      {DECISION_ACTION[d]}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <label htmlFor={`c-${n}`} className="text-sm font-semibold text-ink">Yorum</label>
                <textarea
                  id={`c-${n}`}
                  name={`c:${it.key}`}
                  rows={2}
                  maxLength={APPROVAL_COMMENT_MAX}
                  defaultValue={it.current?.comment ?? ""}
                  className={`${inputClass} mt-1.5`}
                  placeholder="Değişiklik istiyor ya da reddediyorsan neyin değişmesi gerektiğini yaz."
                />
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Gönderiliyor…" : "Kararlarımı gönder"}</Button>
        <p className="text-meta text-muted">Karar vermediğin öğeler boş kalır; sonra yeniden açıp tamamlayabilirsin.</p>
      </div>
      {"message" in state ? (
        <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-body font-medium ${state.ok ? "bg-green-tint text-green" : "bg-coral-tint text-coral-deep"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
