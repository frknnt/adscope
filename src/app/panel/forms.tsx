"use client";

import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { useActionState, useRef, useState } from "react";
import { Dialog } from "@/components/interactive";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import type { Brand, Profile } from "@/lib/data/types";
import {
  appealAction,
  completeOnboardingAction,
  deleteAccountAction,
  demoPurchaseAction,
  saveSettingsAction,
  type ActionState,
} from "./actions";

const initial: ActionState = { error: null };

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-xl bg-green-tint px-4 py-3 text-body font-medium text-green">{state.ok}</p>;
  return null;
}

export const SECTOR_OPTIONS = SECTOR_IDS.map((s) => ({ value: s, label: SECTOR_INFO[s].long }));

export function OnboardingForm({ profile }: { profile: Profile | null }) {
  const [state, action, pending] = useActionState(completeOnboardingAction, initial);
  return (
    <form action={action} className="mt-8 grid gap-6">
      <ActionMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Adın (isteğe bağlı)" htmlFor="displayName">
          <input id="displayName" name="displayName" maxLength={80} defaultValue={profile?.displayName ?? ""} className={inputClass} autoComplete="name" />
        </Field>
        <Field label="Şirket / ajans (isteğe bağlı)" htmlFor="companyName">
          <input id="companyName" name="companyName" maxLength={120} defaultValue={profile?.companyName ?? ""} className={inputClass} autoComplete="organization" />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Hangi sektörde reklam veriyorsun?</legend>
        <p className="mt-1 text-meta text-muted">Sektör paketi ilgili kural kartlarını ekler. Her analizde değiştirebilirsin.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SECTOR_OPTIONS.map((s, i) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-field/60 px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-field has-[:checked]:shadow-[0_0_0_1px_var(--ink)]">
              <input type="radio" name="sector" value={s.value} defaultChecked={(profile?.defaultSector ?? "genel") === s.value || (!profile?.defaultSector && i === 0)} className="accent-ink" />
              <span className="text-body font-semibold">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Marka adı (isteğe bağlı)" htmlFor="brandName" hint="Varyantlarda ve itiraz taslağında kullanılır.">
          <input id="brandName" name="brandName" maxLength={80} className={inputClass} />
        </Field>
        <Field label="Marka tonu" htmlFor="tone">
          <select id="tone" name="tone" className={selectClass} defaultValue="samimi">
            <option value="samimi">Samimi</option>
            <option value="kurumsal">Kurumsal</option>
            <option value="genc">Genç</option>
          </select>
        </Field>
      </div>
      <div>
        <Button type="submit" variant="accent" disabled={pending} className="h-12 px-6">
          {pending ? "Kaydediliyor…" : "Kaydet ve ilk analize geç"}
        </Button>
      </div>
    </form>
  );
}

export function SettingsForm({ profile, retentionDefault, emailEnabled }: { profile: Profile | null; retentionDefault: number; emailEnabled: boolean }) {
  const [state, action, pending] = useActionState(saveSettingsAction, initial);
  return (
    <form action={action} className="grid gap-5">
      <ActionMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad" htmlFor="displayName">
          <input id="displayName" name="displayName" maxLength={80} defaultValue={profile?.displayName ?? ""} className={inputClass} autoComplete="name" />
        </Field>
        <Field label="Şirket / ajans" htmlFor="companyName">
          <input id="companyName" name="companyName" maxLength={120} defaultValue={profile?.companyName ?? ""} className={inputClass} autoComplete="organization" />
        </Field>
        <Field label="Varsayılan sektör" htmlFor="sector">
          <select id="sector" name="sector" defaultValue={profile?.defaultSector ?? "genel"} className={selectClass}>
            {SECTOR_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Saklama süresi (gün)" htmlFor="retentionDays" hint={`Analizler ve görseller bu süre sonunda otomatik silinir. 7–365 gün; varsayılan ${retentionDefault}.`}>
          <input id="retentionDays" name="retentionDays" type="number" min={7} max={365} required defaultValue={profile?.retentionDays ?? retentionDefault} className={`${inputClass} tabular`} />
        </Field>
      </div>
      <label className="flex cursor-pointer gap-3 rounded-xl border border-line-strong bg-field/60 px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-field">
        <input type="checkbox" name="seasonReminders" defaultChecked={profile?.seasonReminders ?? false} className="mt-1 accent-ink" />
        <span>
          <span className="block text-body font-semibold">Sezon hatırlatma e-postaları</span>
          <span className="block text-small text-ink-soft">
            Varsayılan sektörüne uyan özel günlerden önce, hazırlık zamanı geldiğinde bir e-posta: tarihler, incelemeye gönderme günü ve dönemin uyum hatırlatmaları. Her dönem için en fazla bir e-posta.
            {emailEnabled ? "" : " (Bu kurulumda e-posta gönderimi henüz yapılandırılmadı; tercihin kaydedilir.)"}
          </span>
        </span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : "Ayarları kaydet"}</Button>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>Hesabımı sil…</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Hesap kalıcı olarak silinsin mi?">
        <form action={action} className="grid gap-4 text-ink">
          <p className="text-ink-soft">Tüm analizlerin, görsellerin, markaların ve kalan kredilerin silinir. Bu işlem geri alınamaz.</p>
          <ActionMessage state={state} />
          <Field label="Onaylamak için e-posta adresini yaz" htmlFor="confirm" hint={email}>
            <input id="confirm" name="confirm" type="email" autoComplete="off" className={inputClass} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? "Siliniyor…" : "Hesabımı ve tüm verilerimi sil"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function DemoPurchaseButton({ packageId, label }: { packageId: string; label: string }) {
  const [state, action, pending] = useActionState(demoPurchaseAction, initial);
  // One event id per click; a replayed submission of the same click carries the same id and is ignored by the ledger.
  const eventId = useRef<string | null>(null);
  return (
    <form
      action={async (fd) => {
        eventId.current ??= crypto.randomUUID();
        fd.set("eventId", eventId.current);
        await action(fd);
        eventId.current = null;
      }}
      className="grid gap-3"
    >
      <input type="hidden" name="packageId" value={packageId} />
      <Button type="submit" variant="ghost" disabled={pending} className="w-full">
        {pending ? "Ekleniyor…" : label}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

export function AppealForm({ analyses, defaultId }: { analyses: { id: string; label: string }[]; defaultId?: string }) {
  const [state, action, pending] = useActionState(appealAction, initial);
  return (
    <form action={action} className="grid gap-5">
      <ActionMessage state={state} />
      <Field label="Hangi reklam reddedildi?" htmlFor="analysisId" hint="Taslak, bu analizin bulgularına göre hazırlanır. Ek kredi düşmez.">
        <select id="analysisId" name="analysisId" defaultValue={defaultId} className={selectClass} required>
          {analyses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </Field>
      <Field label="Meta'nın ret mesajı" htmlFor="rejectionMessage" hint="Reklam Yöneticisi'ndeki ret gerekçesini olduğu gibi yapıştır. Türkçe veya İngilizce olabilir.">
        <textarea id="rejectionMessage" name="rejectionMessage" rows={5} maxLength={3000} required className={inputClass} placeholder="Ör. Your ad wasn't approved because it doesn't follow our Advertising Standards on unrealistic outcomes…" />
      </Field>
      <div>
        <Button type="submit" variant="accent" disabled={pending}>{pending ? "Hazırlanıyor…" : "İtiraz taslağını hazırla"}</Button>
      </div>
    </form>
  );
}

/** Small client helpers used on result pages. */
export function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
      className="no-print inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-meta font-semibold text-ink hover:bg-paper-2"
    >
      <span aria-live="polite">{done ? "Kopyalandı" : label}</span>
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-body font-semibold text-paper hover:bg-ink-2">
      PDF olarak kaydet / yazdır
    </button>
  );
}

export type { Brand };
