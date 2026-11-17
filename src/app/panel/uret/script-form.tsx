"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { PLATFORM_IDS, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { generateScriptAction, type ScriptActionState } from "./script-actions";

type BrandOpt = { id: string; name: string; sector: Sector };
type AudienceOpt = { id: string; brandId: string; name: string };

const DURATIONS = ["15", "30", "45"] as const;

export function ScriptForm({ brands, audiences, defaultSector, aiOn, balance }: { brands: BrandOpt[]; audiences: AudienceOpt[]; defaultSector: Sector; aiOn: boolean; balance: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ScriptActionState, FormData>(generateScriptAction, { error: null });
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [brandId, setBrandId] = useState("");
  const [platform, setPlatform] = useState<Platform>("meta");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>("15");
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const brandAudiences = useMemo(() => audiences.filter((a) => a.brandId === brandId), [audiences, brandId]);

  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!state.id || handled.current === state.id) return;
    handled.current = state.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset after a completed server action
    setRequestId(crypto.randomUUID());
    router.replace(`/panel/uret?sekme=senaryo&sonuc=${state.id}#senaryo`);
  }, [state.id, router]);

  const noCredit = aiOn && balance < 1;
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
      <input type="hidden" name="requestId" value={requestId} />
      <Field label="Ürün ya da hizmet adı" htmlFor="sc-name">
        <input id="sc-name" name="productName" maxLength={80} className={inputClass} placeholder="ör. Filtre kahve seti" />
      </Field>
      <Field label="Kısa açıklama" htmlFor="sc-desc" hint="Ne olduğunu ve neden işe yaradığını bir iki cümleyle yaz. Uydurma bilgi eklenmez.">
        <textarea id="sc-desc" name="description" rows={3} maxLength={600} className={inputClass} placeholder="ör. Taze çekilmiş çekirdek, üç farklı kavrum, evde demleme için" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
        <Field label="Marka" htmlFor="sc-brand">
          <select id="sc-brand" name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectClass}>
            <option value="">Markasız</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Hedef kitle" htmlFor="sc-audience" hint={brandId && !brandAudiences.length ? "Bu marka için profil yok." : undefined}>
          <select id="sc-audience" name="audienceId" defaultValue="" key={brandId} disabled={!brandAudiences.length} className={selectClass}>
            <option value="">Seçilmedi</option>
            {brandAudiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Sektör" htmlFor="sc-sector" hint={brand ? "Markanın sektörü kullanılır." : undefined}>
          <select id="sc-sector" name="sector" defaultValue={brand?.sector ?? defaultSector} key={brand?.sector ?? "none"} disabled={Boolean(brand)} className={selectClass}>
            {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
          </select>
          {brand ? <input type="hidden" name="sector" value={brand.sector} /> : null}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <fieldset>
          <legend className="text-small font-semibold text-ink">Platform</legend>
          <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-paper-2 p-1">
            {PLATFORM_IDS.map((p) => (
              <label key={p} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-small font-semibold has-[:focus-visible]:outline-2 ${platform === p ? "bg-card text-ink shadow-card" : "text-ink-soft"}`}>
                <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} className="sr-only" />
                {PLATFORM_SHORT[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-small font-semibold text-ink">Süre</legend>
          <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-paper-2 p-1">
            {DURATIONS.map((d) => (
              <label key={d} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-small font-semibold has-[:focus-visible]:outline-2 ${duration === d ? "bg-card text-ink shadow-card" : "text-ink-soft"}`}>
                <input type="radio" name="duration" value={d} checked={duration === d} onChange={() => setDuration(d)} className="sr-only" />
                {d} sn
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-small text-ink">
        <input type="checkbox" name="aiPerson" className="mt-0.5 size-5 shrink-0 accent-ink" />
        <span>
          <span className="block font-semibold">Videoda yapay zekâ ile üretilmiş kişi ya da ses kullanılacak</span>
          <span className="block text-meta text-muted">İşaretlersen senaryonun başına yapay zekâ bildirimi ve platform etiketi notu eklenir.</span>
        </span>
      </label>
      {!aiOn ? <p className="rounded-xl bg-info-tint px-4 py-3 text-small text-info">Yapay zekâ bu ortamda kapalı. Senaryo şablonla üretilir; kredi düşmez.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending || noCredit}>{pending ? "Üretiliyor…" : "Senaryoyu üret"}</Button>
        <span className="text-small text-muted">{aiOn ? "1 kredi, yalnızca üretim başarıyla biterse düşer." : "Kredisiz"}</span>
      </div>
      {noCredit ? <p className="text-small text-coral-deep">Kredin kalmadı. Krediler sayfasından paket alabilirsin.</p> : null}
      {state.error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{state.error}</p> : null}
    </form>
  );
}
