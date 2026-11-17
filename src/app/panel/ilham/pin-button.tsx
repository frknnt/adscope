"use client";

import { useActionState } from "react";
import { savePinAction, type PinState } from "./actions";

const initial: PinState = { status: "idle" };

export function PinButton(props: { adArchiveId: string; pageName: string; title: string; body: string; country: string; deliveryStart: string | null; saved: boolean }) {
  const [state, action, pending] = useActionState(savePinAction, initial);
  const done = props.saved || state.status === "saved" || state.status === "exists";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="adArchiveId" value={props.adArchiveId} />
      <input type="hidden" name="pageName" value={props.pageName} />
      <input type="hidden" name="title" value={props.title} />
      <input type="hidden" name="body" value={props.body} />
      <input type="hidden" name="country" value={props.country} />
      <input type="hidden" name="deliveryStart" value={props.deliveryStart ?? ""} />
      <button
        type="submit"
        disabled={pending || done}
        className="rounded-full border border-line-strong px-3 py-1.5 text-meta font-semibold hover:bg-paper-2 disabled:cursor-default disabled:opacity-70"
      >
        {done ? "Panoda" : pending ? "Kaydediliyor…" : "Panoya kaydet"}
      </button>
      {state.status === "error" ? <span role="alert" className="text-meta text-coral-deep">{state.message}</span> : null}
    </form>
  );
}
