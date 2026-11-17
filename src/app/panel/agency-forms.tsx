"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import type { Brand, FindingFeedback } from "@/lib/data/types";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import type { ActionState } from "./actions";
import { createApiKeyAction, createReviewShareAction, findingFeedbackAction, inviteMemberAction, saveBrandAction, sendReportEmailAction } from "./agency-actions";
import { ActionMessage, CopyButton } from "./forms";

const initial: ActionState = { error: null };

/** A secret (invite link, review link, API key) that is shown exactly once. */
function OneTimeSecret({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-2 rounded-xl border border-ink/20 bg-white p-3">
      <span className="text-[0.78rem] font-semibold text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-paper px-3 py-2 text-[0.82rem]">{value}</code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

const REASONS = [
  { value: "not_in_ad", label: "İşaretlenen ifade reklamda bu anlamda geçmiyor" },
  { value: "context_ok", label: "Bağlamda sorun yok (ör. olumsuz cümle, alıntı)" },
  { value: "rule_outdated", label: "Kural güncel değil veya kaynak yanlış" },
  { value: "other", label: "Başka bir neden" },
] as const;

export function FindingFeedbackForm({ analysisId, findingId, current }: { analysisId: string; findingId: string; current: FindingFeedback | null }) {
  const [state, action, pending] = useActionState(findingFeedbackAction, initial);
  const [mode, setMode] = useState<"closed" | "wrong">("closed");
  const saved = state.ok ? true : null;
  if (saved || current) {
    const verdict = current?.verdict;
    return (
      <p className="no-print mt-3 text-[0.8rem] text-muted" role="status">
        {state.ok ?? (verdict === "helpful" ? "Bu uyarıyı yararlı olarak işaretledin." : verdict === "unclear" ? "Bu uyarıyı anlaşılmadı olarak bildirdin." : "Bu uyarıyı yanlış olarak bildirdin. Teşekkürler.")}
      </p>
    );
  }
  return (
    <div className="no-print mt-3 border-t border-dashed border-line pt-3">
      <form action={action} className="flex flex-wrap items-center gap-2 text-[0.8rem]">
        <input type="hidden" name="analysisId" value={analysisId} />
        <input type="hidden" name="findingId" value={findingId} />
        <span className="text-muted">Bu uyarı doğru mu?</span>
        <button type="submit" name="verdict" value="helpful" disabled={pending} className="rounded-full border border-line-strong px-3 py-1 font-semibold hover:bg-paper-2">Yararlı</button>
        <button type="submit" name="verdict" value="unclear" disabled={pending} className="rounded-full border border-line-strong px-3 py-1 font-semibold hover:bg-paper-2">Anlaşılmadı</button>
        <button type="button" onClick={() => setMode(mode === "wrong" ? "closed" : "wrong")} aria-expanded={mode === "wrong"} className="rounded-full border border-line-strong px-3 py-1 font-semibold text-coral-deep hover:bg-paper-2">
          Yanlış uyarı
        </button>
      </form>
      {mode === "wrong" ? (
        <form action={action} className="mt-3 grid gap-3 rounded-xl bg-paper p-3">
          <input type="hidden" name="analysisId" value={analysisId} />
          <input type="hidden" name="findingId" value={findingId} />
          <input type="hidden" name="verdict" value="wrong" />
          <fieldset className="grid gap-1.5 text-[0.85rem]">
            <legend className="mb-1 font-semibold">Neden yanlış?</legend>
            {REASONS.map((r, i) => (
              <label key={r.value} className="flex items-start gap-2">
                <input type="radio" name="reason" value={r.value} defaultChecked={i === 0} className="mt-1 accent-ink" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <Field label="Not (isteğe bağlı)" htmlFor={`note-${findingId}`} hint="Kişisel veri yazma. En fazla 500 karakter.">
            <textarea id={`note-${findingId}`} name="note" rows={2} maxLength={500} className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="ghost" disabled={pending} className="h-9 px-4 text-[0.85rem]">{pending ? "Gönderiliyor…" : "Bildir"}</Button>
            <ActionMessage state={state} />
          </div>
        </form>
      ) : state.error ? <div className="mt-2"><ActionMessage state={state} /></div> : null}
    </div>
  );
}

export function BrandForm({ brand }: { brand?: Brand }) {
  const [state, action, pending] = useActionState(saveBrandAction, initial);
  const p = brand?.id ?? "new";
  return (
    <form action={action} className="grid gap-4">
      {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marka adı" htmlFor={`name-${p}`}>
          <input id={`name-${p}`} name="name" required maxLength={80} defaultValue={brand?.name} className={inputClass} />
        </Field>
        <Field label="Sektör" htmlFor={`sector-${p}`}>
          <select id={`sector-${p}`} name="sector" defaultValue={brand?.sector ?? "genel"} className={inputClass}>
            {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
          </select>
        </Field>
        <Field label="Ton" htmlFor={`tone-${p}`}>
          <select id={`tone-${p}`} name="tone" defaultValue={brand?.tone ?? "samimi"} className={inputClass}>
            <option value="samimi">Samimi</option>
            <option value="kurumsal">Kurumsal</option>
            <option value="genc">Genç</option>
          </select>
        </Field>
      </div>
      <Field label="Yasaklı kelimeler" htmlFor={`banned-${p}`} hint="Virgülle ayır. Reklamda geçerse sarı bayrak olarak işaretlenir ve önerilerden çıkarılır. En fazla 50 kelime.">
        <textarea id={`banned-${p}`} name="bannedWords" rows={2} maxLength={2000} defaultValue={brand?.bannedWords.join(", ")} className={inputClass} placeholder="ör. ucuz, bedava, süper fırsat" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tercih edilen çağrı cümlesi" htmlFor={`cta-${p}`} hint="Güvenli metin ve kısa varyantta sektör cümlesi yerine kullanılır.">
          <input id={`cta-${p}`} name="preferredCta" maxLength={140} defaultValue={brand?.preferredCta ?? ""} className={inputClass} placeholder="ör. Mağazamızı ziyaret edin." />
        </Field>
        <Field label="Marka sesi notu" htmlFor={`voice-${p}`} hint="Ekip için hatırlatma; raporda gösterilir.">
          <input id={`voice-${p}`} name="voiceNotes" maxLength={600} defaultValue={brand?.voiceNotes ?? ""} className={inputClass} placeholder="ör. Sen dili, emoji yok, ünlem en fazla bir." />
        </Field>
      </div>
      <Field label="Logo (PNG veya JPG, en fazla 1 MB)" htmlFor={`logo-${p}`} hint="PDF raporun ve avukat inceleme sayfasının başlığında kullanılır.">
        <input id={`logo-${p}`} name="logo" type="file" accept="image/png,image/jpeg" className="text-[0.9rem]" />
      </Field>
      {brand?.hasLogo ? (
        <label className="flex items-center gap-2 text-[0.88rem]"><input type="checkbox" name="removeLogo" className="accent-ink" /> Mevcut logoyu kaldır</label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={brand ? "ghost" : "accent"} disabled={pending}>{pending ? "Kaydediliyor…" : brand ? "Kaydet" : "Marka ekle"}</Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Ekip arkadaşının e-postası" htmlFor="invite-email" className="min-w-[16rem] flex-1">
          <input id="invite-email" name="email" type="email" required maxLength={320} autoComplete="off" className={inputClass} />
        </Field>
        <Button type="submit" variant="accent" disabled={pending}>{pending ? "Oluşturuluyor…" : "Davet et"}</Button>
      </div>
      <ActionMessage state={state} />
      {state.link ? <OneTimeSecret value={state.link} label="Davet bağlantısı (7 gün geçerli, yalnızca bu e-posta ile kabul edilir)" /> : null}
    </form>
  );
}

export function ReviewShareForm({ analysisId }: { analysisId: string }) {
  const [state, action, pending] = useActionState(createReviewShareAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="analysisId" value={analysisId} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Geçerlilik" htmlFor="share-days">
          <select id="share-days" name="days" defaultValue="7" className={inputClass}>
            <option value="3">3 gün</option>
            <option value="7">7 gün</option>
            <option value="14">14 gün</option>
            <option value="30">30 gün</option>
          </select>
        </Field>
        <Field label="Avukata not (isteğe bağlı)" htmlFor="share-note" hint="Kişisel veri yazma. En fazla 500 karakter.">
          <input id="share-note" name="note" maxLength={500} className={inputClass} placeholder="ör. Yayın tarihi 1 Aralık; özellikle indirim ifadesine bakabilir misiniz?" />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Hazırlanıyor…" : "İnceleme bağlantısı oluştur"}</Button>
      </div>
      <ActionMessage state={state} />
      {state.link ? <OneTimeSecret value={state.link} label="Salt okunur inceleme bağlantısı" /> : null}
    </form>
  );
}

export function ApiKeyForm() {
  const [state, action, pending] = useActionState(createApiKeyAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Anahtar adı" htmlFor="key-name" hint="ör. CRM entegrasyonu" className="min-w-[14rem] flex-1">
          <input id="key-name" name="name" required maxLength={60} className={inputClass} />
        </Field>
        <Button type="submit" variant="accent" disabled={pending}>{pending ? "Oluşturuluyor…" : "Anahtar oluştur"}</Button>
      </div>
      <ActionMessage state={state} />
      {state.link ? <OneTimeSecret value={state.link} label="API anahtarı (bir daha gösterilmez)" /> : null}
    </form>
  );
}

export function ReportEmailForm({ analysisId }: { analysisId: string }) {
  const [state, action, pending] = useActionState(sendReportEmailAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="analysisId" value={analysisId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Alıcının e-postası" htmlFor="mail-to">
          <input id="mail-to" name="to" type="email" required maxLength={320} autoComplete="email" className={inputClass} placeholder="musteri@ornek.com" />
        </Field>
        <Field label="Not (isteğe bağlı)" htmlFor="mail-note">
          <input id="mail-note" name="note" maxLength={300} className={inputClass} placeholder="ör. Yayından önce son kontrol" />
        </Field>
        <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Gönderiliyor…" : "PDF'i gönder"}</Button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
