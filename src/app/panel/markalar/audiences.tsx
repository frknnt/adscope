"use client";

import { useActionState, useState, useTransition } from "react";
import { Dialog } from "@/components/interactive";
import { Button, Field, inputClass } from "@/components/ui";
import { sensitiveHits, sensitiveMessage } from "@/lib/audience/sensitive";
import type { Audience } from "@/lib/data/types";
import type { ActionState } from "../actions";
import { ActionMessage } from "../forms";
import { deleteAudienceAction, saveAudienceAction, suggestAudiencesAction, type AudienceSuggestState } from "./audience-actions";

const initial: ActionState = { error: null };
type Draft = { name: string; ageMin: string; ageMax: string; need: string; objections: string; tone: string };
const EMPTY: Draft = { name: "", ageMin: "25", ageMax: "45", need: "", objections: "", tone: "" };

function AudiencePanel({ brandId, brandName, hasWebsite, aiOn, audiences }: { brandId: string; brandName: string; hasWebsite: boolean; aiOn: boolean; audiences: Audience[] }) {
  const [state, action, pending] = useActionState(saveAudienceAction, initial);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [sug, setSug] = useState<AudienceSuggestState | null>(null);
  const [loading, start] = useTransition();
  const hits = sensitiveHits(draft.name, draft.need, draft.objections, draft.tone);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <div className="grid gap-5 text-ink">
      {audiences.length ? (
        <ul className="grid gap-2">
          {audiences.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card p-3 text-small">
              <span>
                <span className="block font-bold">{a.name} · <span className="tabular">{a.ageMin}-{a.ageMax}</span> yaş</span>
                <span className="block text-ink-soft">İhtiyaç: {a.need}</span>
                {a.objections ? <span className="block text-muted">İtiraz: {a.objections}</span> : null}
                {a.tone ? <span className="block text-muted">Ton: {a.tone}</span> : null}
              </span>
              <form action={deleteAudienceAction}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="inline-flex h-10 items-center text-small font-semibold text-coral-deep">Sil<span className="sr-only">: {a.name}</span></button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-ink-soft">{brandName} için henüz hedef kitle profili yok.</p>
      )}

      {aiOn ? (
        <div className="grid gap-2 rounded-xl bg-paper-2 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ghost" className="h-10 px-4" disabled={loading || !hasWebsite} onClick={() => start(async () => setSug(await suggestAudiencesAction(brandId)))}>
              {loading ? "Öneriler hazırlanıyor…" : "Web sitesinden 3 öneri al"}
            </Button>
            {!hasWebsite ? <span className="text-meta text-muted">Önce marka kitine web sitesi ekle.</span> : null}
          </div>
          {sug?.error ? <p role="alert" className="text-small font-medium text-coral-deep">{sug.error}</p> : null}
          {sug?.items ? (
            <ul className="grid gap-2" role="status">
              {sug.items.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-3 text-small">
                  <span><strong>{s.name}</strong> · {s.ageMin}-{s.ageMax} yaş · {s.need}</span>
                  <Button type="button" variant="quiet" className="h-9 px-3" onClick={() => setDraft({ name: s.name, ageMin: String(s.ageMin), ageMax: String(s.ageMax), need: s.need, objections: s.objections, tone: s.tone })}>
                    Forma aktar
                  </Button>
                </li>
              ))}
              {sug.dropped ? <li className="text-meta text-muted">{sug.dropped} öneri hassas bir kategoriye dokunduğu için gösterilmedi.</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form action={action} className="grid gap-3">
        <input type="hidden" name="brandId" value={brandId} />
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem_6rem]">
          <Field label="Profil adı" htmlFor={`aud-name-${brandId}`}>
            <input id={`aud-name-${brandId}`} name="name" required maxLength={60} value={draft.name} onChange={set("name")} className={inputClass} placeholder="ör. Evde kahve demleyenler" />
          </Field>
          <Field label="En küçük yaş" htmlFor={`aud-min-${brandId}`}>
            <input id={`aud-min-${brandId}`} name="ageMin" type="number" min={18} max={80} required value={draft.ageMin} onChange={set("ageMin")} className={inputClass} />
          </Field>
          <Field label="En büyük yaş" htmlFor={`aud-max-${brandId}`}>
            <input id={`aud-max-${brandId}`} name="ageMax" type="number" min={18} max={80} required value={draft.ageMax} onChange={set("ageMax")} className={inputClass} />
          </Field>
        </div>
        <Field label="İhtiyaç" htmlFor={`aud-need-${brandId}`} hint="Ürünün hangi durumda işe yaradığını yaz; kişinin özelliklerini değil.">
          <input id={`aud-need-${brandId}`} name="need" required maxLength={300} value={draft.need} onChange={set("need")} className={inputClass} placeholder="ör. Sabahları hızlı ve lezzetli kahve" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="İtirazlar (isteğe bağlı)" htmlFor={`aud-obj-${brandId}`}>
            <input id={`aud-obj-${brandId}`} name="objections" maxLength={300} value={draft.objections} onChange={set("objections")} className={inputClass} placeholder="ör. Kapsül makinesi pahalı" />
          </Field>
          <Field label="Dil tonu (isteğe bağlı)" htmlFor={`aud-tone-${brandId}`}>
            <input id={`aud-tone-${brandId}`} name="tone" maxLength={120} value={draft.tone} onChange={set("tone")} className={inputClass} placeholder="ör. Samimi, sen dili" />
          </Field>
        </div>
        {hits.length ? <p role="alert" className="rounded-xl bg-amber-tint px-4 py-3 text-small text-ink">{sensitiveMessage(hits)}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending || hits.length > 0}>{pending ? "Kaydediliyor…" : "Profili kaydet"}</Button>
          <ActionMessage state={state} />
        </div>
      </form>
    </div>
  );
}

export function AudienceDialogButton(props: { brandId: string; brandName: string; hasWebsite: boolean; aiOn: boolean; audiences: Audience[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="quiet" className="h-10 px-3" onClick={() => setOpen(true)}>
        Hedef kitle ({props.audiences.length})<span className="sr-only">: {props.brandName}</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${props.brandName}: hedef kitleler`} wide>
        <div className="max-h-[70dvh] overflow-y-auto pr-1">{open ? <AudiencePanel {...props} /> : null}</div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Kapat</Button>
        </div>
      </Dialog>
    </>
  );
}
