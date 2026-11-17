"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { Dialog } from "@/components/interactive";
import type { Brand, FindingFeedback } from "@/lib/data/types";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import type { ActionState } from "./actions";
import { createApiKeyAction, createReviewShareAction, findingFeedbackAction, inviteMemberAction, saveBrandAction, sendReportEmailAction, suggestBrandFromSiteAction, type SiteSuggestionState } from "./agency-actions";
import { BRAND_FONTS, contrastNote, normalizeHex } from "@/lib/brand/kit";
import { ActionMessage, CopyButton } from "./forms";

const initial: ActionState = { error: null };

/** A secret (invite link, review link, API key) that is shown exactly once. */
function OneTimeSecret({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-2 rounded-xl border border-ink/20 bg-field p-3">
      <span className="text-meta font-semibold text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-paper px-3 py-2 text-meta">{value}</code>
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
      <p className="no-print mt-3 text-meta text-muted" role="status">
        {state.ok ?? (verdict === "helpful" ? "Bu uyarıyı yararlı olarak işaretledin." : verdict === "unclear" ? "Bu uyarıyı anlaşılmadı olarak bildirdin." : "Bu uyarıyı yanlış olarak bildirdin. Teşekkürler.")}
      </p>
    );
  }
  return (
    <div className="no-print mt-3 border-t border-dashed border-line pt-3">
      <form action={action} className="flex flex-wrap items-center gap-2 text-meta">
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
          <fieldset className="grid gap-1.5 text-small">
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
            <Button type="submit" variant="ghost" disabled={pending} className="h-9 px-4 text-small">{pending ? "Gönderiliyor…" : "Bildir"}</Button>
            <ActionMessage state={state} />
          </div>
        </form>
      ) : state.error ? <div className="mt-2"><ActionMessage state={state} /></div> : null}
    </div>
  );
}

function ColorField({ id, name, label, value, onChange }: { id: string; name: string; label: string; value: string; onChange: (v: string) => void }) {
  const hex = normalizeHex(value);
  const note = hex ? contrastNote(hex) : null;
  return (
    <div>
      <label htmlFor={id} className="block text-small font-semibold text-ink">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input type="color" aria-label={`${label}: renk seçici`} value={hex ?? "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-line bg-card p-1" />
        <input id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} maxLength={9} placeholder="#1a2b3c" className={inputClass} aria-describedby={`${id}-note`} />
      </div>
      <p id={`${id}-note`} className={`mt-1.5 text-meta ${note && !note.ok ? "text-coral-deep" : "text-muted"}`}>
        {value && !hex ? "Renk #1a2b3c biçiminde olmalı." : (note?.message ?? "Boş bırakılabilir.")}
      </p>
    </div>
  );
}

export function BrandForm({ brand }: { brand?: Brand }) {
  const [state, action, pending] = useActionState(saveBrandAction, initial);
  const p = brand?.id ?? "new";
  const [name, setName] = useState(brand?.name ?? "");
  const [tagline, setTagline] = useState(brand?.tagline ?? "");
  const [primary, setPrimary] = useState(brand?.primaryColor ?? "");
  const [secondary, setSecondary] = useState(brand?.secondaryColor ?? "");
  const [website, setWebsite] = useState(brand?.website ?? "");
  const [logoUrl, setLogoUrl] = useState("");
  const [site, setSite] = useState<SiteSuggestionState | null>(null);
  const [reading, startReading] = useTransition();
  const sug = site?.suggestion;

  function readSite() {
    startReading(async () => setSite(await suggestBrandFromSiteAction(website)));
  }
  function applySuggestion() {
    if (!sug) return;
    if (sug.name && !name.trim()) setName(sug.name);
    if (sug.tagline) setTagline(sug.tagline);
    if (sug.themeColor) setPrimary(sug.themeColor);
    if (sug.logoUrl) setLogoUrl(sug.logoUrl);
    setWebsite(sug.website);
    setSite({ error: null });
  }

  return (
    <form action={action} className="grid gap-5">
      {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
      <input type="hidden" name="logoUrl" value={logoUrl} />

      <section aria-labelledby={`kit-site-${p}`} className="grid gap-2 rounded-xl bg-paper-2 p-4">
        <h3 id={`kit-site-${p}`} className="text-small font-bold text-ink">Web sitesi</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor={`website-${p}`} className="sr-only">Web sitesi adresi</label>
          <input id={`website-${p}`} name="website" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} inputMode="url" placeholder="https://markan.com" className={`${inputClass} min-w-[14rem] flex-1`} />
          <Button type="button" variant="ghost" className="h-12 px-4" disabled={reading || !website.trim()} onClick={readSite}>
            {reading ? "Okunuyor…" : "Web sitesinden doldur"}
          </Button>
        </div>
        <p className="text-meta text-muted">Sitenin başlığı, açıklaması, tema rengi ve logosu öneri olarak getirilir. Sen onaylayıp kaydetmeden hiçbir şey değişmez.</p>
        {site?.error ? <p role="alert" className="text-small font-medium text-coral-deep">{site.error}</p> : null}
        {sug ? (
          <div role="status" className="grid gap-2 rounded-xl border border-line bg-card p-3 text-small">
            <p className="font-semibold text-ink">Sitede bulunanlar</p>
            <dl className="grid gap-1 sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted">Ad</dt><dd>{sug.name ?? "bulunamadı"}</dd>
              <dt className="text-muted">Slogan</dt><dd>{sug.tagline ?? "bulunamadı"}</dd>
              <dt className="text-muted">Tema rengi</dt>
              <dd className="flex items-center gap-2">{sug.themeColor ? <><span className="inline-block size-4 rounded border border-line" style={{ background: sug.themeColor }} aria-hidden />{sug.themeColor}</> : "bulunamadı"}</dd>
              <dt className="text-muted">Logo</dt><dd className="break-all">{sug.logoUrl ? new URL(sug.logoUrl).pathname.split("/").pop() || sug.logoUrl : "bulunamadı"}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" className="h-10 px-4" onClick={applySuggestion}>Önerileri forma aktar</Button>
              <Button type="button" variant="quiet" className="h-10 px-4" onClick={() => setSite(null)}>Vazgeç</Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marka adı" htmlFor={`name-${p}`}>
          <input id={`name-${p}`} name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sektör" htmlFor={`sector-${p}`}>
          <select id={`sector-${p}`} name="sector" defaultValue={brand?.sector ?? "genel"} className={selectClass}>
            {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
          </select>
        </Field>
        <Field label="Ton" htmlFor={`tone-${p}`}>
          <select id={`tone-${p}`} name="tone" defaultValue={brand?.tone ?? "samimi"} className={selectClass}>
            <option value="samimi">Samimi</option>
            <option value="kurumsal">Kurumsal</option>
            <option value="genc">Genç</option>
          </select>
        </Field>
      </div>

      <fieldset className="grid gap-4">
        <legend className="text-small font-bold text-ink">Görsel kimlik</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField id={`primary-${p}`} name="primaryColor" label="Ana renk" value={primary} onChange={setPrimary} />
          <ColorField id={`secondary-${p}`} name="secondaryColor" label="İkincil renk" value={secondary} onChange={setSecondary} />
          <Field label="Yazı tipi" htmlFor={`font-${p}`} hint="Açık lisanslı (SIL OFL) yazı tipleri; Türkçe karakterleri destekler.">
            <select id={`font-${p}`} name="font" defaultValue={brand?.font ?? ""} className={selectClass}>
              <option value="">Seçilmedi</option>
              {BRAND_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Logo (PNG veya JPG, en fazla 1 MB)" htmlFor={`logo-${p}`} hint={logoUrl ? "Siteden önerilen logo kaydedince indirilecek. Başka bir dosya seçersen o kullanılır." : "PDF raporun, inceleme sayfasının ve üretilen görsellerin başlığında kullanılır."}>
          <input id={`logo-${p}`} name="logo" type="file" accept="image/png,image/jpeg" className="text-body" />
        </Field>
        {logoUrl ? (
          <label className="flex items-center gap-2 text-small"><input type="checkbox" checked onChange={() => setLogoUrl("")} className="accent-ink" /> Siteden önerilen logoyu kullan</label>
        ) : null}
        {brand?.hasLogo ? (
          <label className="flex items-center gap-2 text-small"><input type="checkbox" name="removeLogo" className="accent-ink" /> Mevcut logoyu kaldır</label>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="text-small font-bold text-ink">Dil ve metin</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slogan" htmlFor={`tagline-${p}`}>
            <input id={`tagline-${p}`} name="tagline" maxLength={120} value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputClass} placeholder="ör. Her gün biraz daha iyi" />
          </Field>
          <Field label="Tercih edilen çağrı cümlesi" htmlFor={`cta-${p}`} hint="Güvenli metin ve kısa varyantta sektör cümlesi yerine kullanılır.">
            <input id={`cta-${p}`} name="preferredCta" maxLength={140} defaultValue={brand?.preferredCta ?? ""} className={inputClass} placeholder="ör. Mağazamızı ziyaret edin." />
          </Field>
          <Field label="Marka sesi notu" htmlFor={`voice-${p}`} hint="Ekip için hatırlatma; raporda gösterilir.">
            <input id={`voice-${p}`} name="voiceNotes" maxLength={600} defaultValue={brand?.voiceNotes ?? ""} className={inputClass} placeholder="ör. Sen dili, emoji yok, ünlem en fazla bir." />
          </Field>
          <Field label="Hedef kitle notu" htmlFor={`audience-${p}`} hint="Metin üretiminde kullanılır. Sağlık, din, köken gibi hassas özellik yazma.">
            <input id={`audience-${p}`} name="audienceNote" maxLength={400} defaultValue={brand?.audienceNote ?? ""} className={inputClass} placeholder="ör. 25-40 yaş, ilk evini kuranlar" />
          </Field>
        </div>
        <Field label="Zorunlu ibareler" htmlFor={`required-${p}`} hint="Her satıra bir ibare, en fazla 10. Reklamda yoksa sarı bayrak olarak işaretlenir ve güvenli metne eklenir.">
          <textarea id={`required-${p}`} name="requiredPhrases" rows={2} maxLength={2000} defaultValue={brand?.requiredPhrases.join("\n")} className={inputClass} placeholder="ör. Kampanya stokla sınırlıdır." />
        </Field>
        <Field label="Yasaklı kelimeler" htmlFor={`banned-${p}`} hint="Virgülle ayır. Reklamda geçerse sarı bayrak olarak işaretlenir ve önerilerden çıkarılır. En fazla 50 kelime.">
          <textarea id={`banned-${p}`} name="bannedWords" rows={2} maxLength={2000} defaultValue={brand?.bannedWords.join(", ")} className={inputClass} placeholder="ör. ucuz, bedava, süper fırsat" />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={brand ? "ghost" : "accent"} disabled={pending}>{pending ? "Kaydediliyor…" : brand ? "Kaydet" : "Marka ekle"}</Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

/** Opens the brand form in a dialog ("Yeni marka" or "Düzenle"). */
export function BrandDialogButton({ brand }: { brand?: Brand }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={brand ? "ghost" : "accent"} className={brand ? "h-10 px-4" : "h-11 px-5"} onClick={() => setOpen(true)}>
        {brand ? <>Düzenle<span className="sr-only">: {brand.name}</span></> : "Yeni marka"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={brand ? `${brand.name}: düzenle` : "Yeni marka"} wide>
        <div className="max-h-[70dvh] overflow-y-auto pr-1 text-ink">{open ? <BrandForm brand={brand} /> : null}</div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Kapat</Button>
        </div>
      </Dialog>
    </>
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
          <select id="share-days" name="days" defaultValue="7" className={selectClass}>
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
  const [seen, setSeen] = useState<string | null>(null);
  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Anahtar adı" htmlFor="key-name" hint="ör. CRM entegrasyonu" className="min-w-[14rem] flex-1">
          <input id="key-name" name="name" required maxLength={60} className={inputClass} />
        </Field>
        <Button type="submit" variant="accent" disabled={pending}>{pending ? "Oluşturuluyor…" : "Anahtar oluştur"}</Button>
      </div>
      <ActionMessage state={state} />
      <Dialog open={!!state.link && seen !== state.link} onClose={() => setSeen(state.link ?? null)} title="Yeni API anahtarın" wide>
        <p>Anahtarı şimdi kopyala ve güvenli bir yerde sakla. Bu pencere kapandıktan sonra bir daha gösterilmez; kaybedersen iptal edip yenisini oluştur.</p>
        {state.link ? <div className="mt-4 text-ink"><OneTimeSecret value={state.link} label="API anahtarı (bir daha gösterilmez)" /></div> : null}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="primary" onClick={() => setSeen(state.link ?? null)}>Kopyaladım, kapat</Button>
        </div>
      </Dialog>
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
