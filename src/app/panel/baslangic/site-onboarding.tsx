"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass, Disclaimer, Field, inputClass, selectClass } from "@/components/ui";
import type { SiteScan } from "@/lib/onboarding/site";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { saveSiteOnboardingAction, scanSiteAction, type SaveState } from "./actions";

const LEVEL = {
  red: { label: "Kırmızı bayrak", cls: "bg-coral-tint text-coral-deep" },
  yellow: { label: "Sarı bayrak", cls: "bg-amber-tint text-amber" },
  dikkat: { label: "Dikkat (kural kartı doğrulanmadı)", cls: "bg-info-tint text-info" },
} as const;

export function SiteOnboarding({ balance }: { balance: number }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<SiteScan | null>(null);
  const [save, saveAction, saving] = useActionState<SaveState, FormData>(saveSiteOnboardingAction, { error: null });

  async function read(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setScan(null);
    setBusy(true);
    const res = await scanSiteAction(url);
    setBusy(false);
    if (res.ok) setScan(res.scan);
    else setError(res.error);
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={read} className="grid gap-3">
        <Field label="Web sitenin adresi" htmlFor="ob-site" hint="Siteni bir kez okuruz. Onaylamadan hiçbir şey kaydedilmez.">
          <input id="ob-site" type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={300} className={inputClass} autoComplete="url" />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className={buttonClass("accent")}>{busy ? "Siten okunuyor…" : "Sitemi oku"}</button>
          <Link href="/panel/baslangic?site=yok" className="font-semibold text-ink-soft">Sitem yok</Link>
        </div>
        <p aria-live="polite" className="sr-only">{busy ? "Siten okunuyor" : scan ? "Öneriler hazır" : ""}</p>
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-small font-medium text-coral-deep">{error}</p> : null}
      </form>

      {scan ? (
        <form action={saveAction} className="grid gap-5 border-t border-line pt-6" aria-labelledby="ob-oneriler">
          <h2 id="ob-oneriler" className="text-xl font-bold">Sitenden okuduklarımız</h2>
          <input type="hidden" name="website" value={scan.website} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marka adı" htmlFor="ob-name">
              <input id="ob-name" name="name" required maxLength={80} defaultValue={scan.suggestion.name ?? ""} className={inputClass} />
            </Field>
            <Field label="Sektör" htmlFor="ob-sector" hint={scan.sector === "genel" ? "Sitenden sektör çıkaramadık; doğrusunu seç." : scan.sectorConfident ? "Sitendeki ifadelere göre tahmin ettik." : "Zayıf bir tahmin; kontrol et."}>
              <select id="ob-sector" name="sector" defaultValue={scan.sector} className={selectClass}>
                {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
              </select>
            </Field>
            <Field label="Slogan (isteğe bağlı)" htmlFor="ob-tagline">
              <input id="ob-tagline" name="tagline" maxLength={120} defaultValue={scan.suggestion.tagline ?? ""} className={inputClass} />
            </Field>
            <Field label="Ana renk (isteğe bağlı)" htmlFor="ob-color" hint="#1a2b3c biçiminde.">
              <span className="flex items-center gap-2">
                <input id="ob-color" name="primaryColor" maxLength={9} defaultValue={scan.suggestion.themeColor ?? ""} className={inputClass} />
                {scan.suggestion.themeColor ? <span className="size-10 shrink-0 rounded-lg border border-line" style={{ background: scan.suggestion.themeColor }} aria-hidden /> : null}
              </span>
            </Field>
            <Field label="Marka tonu" htmlFor="ob-tone">
              <select id="ob-tone" name="tone" defaultValue="samimi" className={selectClass}>
                <option value="samimi">Samimi</option>
                <option value="kurumsal">Kurumsal</option>
                <option value="genc">Genç</option>
              </select>
            </Field>
            {scan.suggestion.logoUrl ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-small">
                <input type="checkbox" name="logoUrl" value={scan.suggestion.logoUrl} defaultChecked className="size-5 accent-ink" />
                Sitedeki logoyu marka kitine ekle
              </label>
            ) : null}
          </div>

          <section aria-labelledby="ob-riskler" className="grid gap-3 rounded-2xl bg-paper-2 p-4">
            <h3 id="ob-riskler" className="font-bold">Sitende dikkat çeken ifadeler</h3>
            {scan.thin ? <p className="text-small text-ink-soft">Siten içeriğini JavaScript ile çiziyor; okuyabildiğimiz metin az.</p> : null}
            {scan.risks.length ? (
              <ul className="grid gap-2">
                {scan.risks.map((r) => (
                  <li key={r.phrase} className="rounded-xl bg-card p-3 text-small">
                    <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-meta font-bold ${LEVEL[r.level].cls}`}>{LEVEL[r.level].label}</span>
                    <strong className="text-ink">“{r.phrase}”</strong> <span className="text-ink-soft">{r.title}</span>
                    {r.ruleId ? <span className="text-muted"> · <Link href={`/kurallar#${r.ruleId}`}>{r.ruleId}</Link></span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-ink-soft">Bulgu yok: sitende kural kartlarımızla eşleşen riskli bir ifade bulmadık. Bu, reklamının onaylanacağı anlamına gelmez.</p>
            )}
            <p className="text-meta text-muted">Yalnızca sitedeki metin tarandı. Reklamlarında aynı ifadeleri kullanırsan paket ve analizler seni uyarır.</p>
          </section>

          {save.error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-small font-medium text-coral-deep">{save.error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={buttonClass("accent")}>{saving ? "Kaydediliyor…" : "Kaydet ve ilk paketimi hazırla"}</button>
            <p className="text-meta text-muted">Marka kiti kaydedilir, kampanya paketi bu adresle açılır. Önizlemeler ücretsiz; {balance} kredin hazır.</p>
          </div>
          <Disclaimer />
        </form>
      ) : null}
    </div>
  );
}
