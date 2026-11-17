"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { IconExternal, IconInfo } from "@/components/icons";
import { LevelPill, SEVERITY_LABEL } from "@/components/risk";
import { Button, buttonClass, Field, inputClass, selectClass } from "@/components/ui";
import { PLATFORM_IDS, PLATFORM_INFO, PLATFORM_SHORT } from "@/lib/platforms";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { quickCheckAction, type QuickCheckState } from "./actions";

const initial: QuickCheckState = { status: "idle" };
const SEV = {
  red: "border-coral/45 [&_.sev]:bg-coral-tint [&_.sev]:text-coral-deep",
  yellow: "border-caution/60 [&_.sev]:bg-amber-tint [&_.sev]:text-amber",
  info: "border-info/30 [&_.sev]:bg-info-tint [&_.sev]:text-info",
} as const;

export function QuickCheck() {
  const [state, action, pending] = useActionState(quickCheckAction, initial);
  // Controlled fields: React resets uncontrolled forms after an action, which would make the
  // result look like it belongs to the default sector.
  const [v, setV] = useState({ platform: "meta", sector: "genel", headline: "", primaryText: "" });
  const bind = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value })) });
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <form action={action} className="grid gap-5 rounded-2xl border border-line bg-card p-5 sm:p-6" aria-describedby="hizli-not">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Platform" htmlFor="q-platform">
            <select id="q-platform" name="platform" {...bind("platform")} className={selectClass}>
              {PLATFORM_IDS.map((p) => <option key={p} value={p}>{PLATFORM_INFO[p].label}</option>)}
            </select>
          </Field>
          <Field label="Sektör" htmlFor="q-sector">
            <select id="q-sector" name="sector" {...bind("sector")} className={selectClass}>
              {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Başlık (isteğe bağlı)" htmlFor="q-headline">
          <input id="q-headline" name="headline" {...bind("headline")} maxLength={255} className={inputClass} />
        </Field>
        <Field label="Reklam metni" htmlFor="q-text" hint="En fazla 2200 karakter. Kişisel veri yazma.">
          <textarea id="q-text" name="primaryText" {...bind("primaryText")} rows={7} required minLength={10} maxLength={2200} className={inputClass} placeholder="ör. 7 günde 5 kilo verdiren detoks çayı! %70 indirim, garantili sonuç." />
        </Field>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="q-website">Web sitesi</label>
          <input id="q-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Button type="submit" variant="accent" disabled={pending} className="h-12">{pending ? "Kontrol ediliyor…" : "Ücretsiz kontrol et"}</Button>
        <p id="hizli-not" className="text-meta leading-relaxed text-muted">
          Üyelik gerekmez. Metnin kaydedilmez ve kayıtlara yazılmaz; yalnızca bu sayfada sonucu görürsün. Görsel, video ve açılış sayfası kontrolü hesapla yapılır.
        </p>
      </form>

      <div aria-live="polite" className="min-w-0">
        {state.status === "idle" ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-ink-soft">
            <p className="font-display text-2xl font-semibold text-ink">Sonuç burada görünecek.</p>
            <p className="mt-2 max-w-md">Metni yapıştır, platformu ve sektörü seç. Riskli ifadeleri kaynak kural kartıyla birlikte gösteririz.</p>
          </div>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 font-medium text-coral-deep">{state.message}</p>
        ) : null}
        {state.status === "done" ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-card p-5">
                <p className="text-meta font-semibold text-muted">{PLATFORM_SHORT[state.platform]} ret riski (metin)</p>
                <p className="mt-1 flex items-baseline gap-3"><span className="font-display text-5xl font-semibold tabular">{state.platformScore}</span><LevelPill level={state.platformLevel} /></p>
              </div>
              <div className="rounded-2xl border border-line bg-card p-5">
                <p className="text-meta font-semibold text-muted">Türk mevzuatı riski</p>
                <p className="mt-1 flex items-baseline gap-3"><span className="font-display text-5xl font-semibold tabular">{state.legalCount}</span><LevelPill level={state.legalLevel} /></p>
                <p className="mt-1 text-meta text-muted">doğrulanmış kural kartıyla eşleşen bulgu</p>
              </div>
            </div>
            {state.findings.length === 0 ? (
              <p className="rounded-2xl border border-line bg-card px-5 py-4 text-ink-soft">
                Kural kartlarıyla eşleşen bir ifade bulunmadı. Bu, reklamın onaylanacağı anlamına gelmez; görsel, hedefleme ve açılış sayfası ayrıca incelenir.
              </p>
            ) : (
              <ul className="grid gap-3">
                {state.findings.map((f, i) => (
                  <li key={i} className={`rounded-2xl border bg-card p-5 ${SEV[f.severity]}`}>
                    <span className="sev inline-flex rounded-full px-2.5 py-0.5 text-fine font-bold">{SEVERITY_LABEL[f.severity]}</span>
                    <h3 className="mt-2 font-bold leading-snug">{f.matchedText ? <>“{f.matchedText}” · </> : null}{f.title}</h3>
                    <p className="mt-1.5 text-body leading-relaxed text-ink-soft">{f.explanation}</p>
                    <p className="mt-1.5 text-body"><span className="font-semibold">Düzeltme: </span>{f.suggestion}</p>
                    {f.source ? (
                      <p className="mt-2 flex flex-wrap gap-x-3 text-meta text-muted">
                        <Link href={`/kurallar#${f.source.ruleId}`} className="font-semibold text-ink">{f.source.ruleId}</Link>
                        <span>{f.verified ? "Resmî kaynakta doğrulandı" : "Doğrulanmadı, bilgi amaçlı"}</span>
                        <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-coral-deep">{f.source.org} <IconExternal className="size-3" /><span className="sr-only">(yeni sekmede açılır)</span></a>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {state.hiddenCount ? <p className="text-small text-ink-soft">{state.hiddenCount} bulgu daha var; tam raporda görünür.</p> : null}
            <div className="rounded-2xl border border-green/30 bg-green-tint/50 p-5">
              <p className="text-meta font-bold text-green">Güvenli metin önerisi</p>
              <p className="mt-1.5 leading-relaxed">{state.safeText}</p>
            </div>
            <div className="rounded-2xl bg-ink p-6 text-paper">
              <p className="font-display text-2xl font-semibold">Görseliyle birlikte tam rapor</p>
              <p className="mt-2 text-paper/80">Görsel ve video kontrolü, kreatif skoru, beş Türkçe varyant, WhatsApp şablonları ve markalı PDF. Kayıt olana 3 ücretsiz analiz.</p>
              <Link href="/kayit" className={buttonClass("accent", "mt-4")}>Ücretsiz hesap aç</Link>
            </div>
            <p className="flex items-start gap-1.5 text-meta text-muted"><IconInfo className="mt-0.5 size-3.5 shrink-0" /> Risk değerlendirmesidir, hukuki görüş değildir. Reklamın onaylanacağını ya da reddedileceğini garanti etmez.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
