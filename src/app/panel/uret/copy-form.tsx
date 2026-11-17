"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { PLATFORM_IDS, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import type { Sector } from "@/lib/rules/catalog";
import { generateCopyAction, type CopyActionState } from "./actions";

type BrandOpt = { id: string; name: string; sector: Sector; website: string | null };
type AudienceOpt = { id: string; brandId: string; name: string };

export function CopyForm({ brands, audiences, defaultSector, aiOn, balance }: { brands: BrandOpt[]; audiences: AudienceOpt[]; defaultSector: Sector; aiOn: boolean; balance: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CopyActionState, FormData>(generateCopyAction, { error: null });
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [brandId, setBrandId] = useState("");
  const [platform, setPlatform] = useState<Platform>("meta");
  const [url, setUrl] = useState("");
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const brandAudiences = useMemo(() => audiences.filter((a) => a.brandId === brandId), [audiences, brandId]);

  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!state.id || handled.current === state.id) return;
    handled.current = state.id;
    // A new request id for the next run; the finished one stays idempotent on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset after a completed server action
    setRequestId(crypto.randomUUID());
    router.replace(`/panel/uret?sonuc=${state.id}#sonuc`);
  }, [state.id, router]);

  const noCredit = aiOn && balance < 1;
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
      <input type="hidden" name="requestId" value={requestId} />
      <Field label="Ürün ya da hizmet sayfası" htmlFor="copy-url" hint="Sayfa sunucumuzdan bir kez okunur; metni saklanmaz.">
        <input id="copy-url" name="url" inputMode="url" maxLength={2048} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={brand?.website ?? "https://markan.com/urun"} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ürün adı (isteğe bağlı)" htmlFor="copy-name">
          <input id="copy-name" name="productName" maxLength={80} className={inputClass} placeholder="ör. Filtre kahve seti" />
        </Field>
        <Field label="Kısa açıklama (adres yoksa gerekli)" htmlFor="copy-desc">
          <input id="copy-desc" name="description" maxLength={600} className={inputClass} placeholder="ör. Taze çekilmiş, üç farklı kavrum" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marka" htmlFor="copy-brand">
          <select id="copy-brand" name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectClass}>
            <option value="">Markasız</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Hedef kitle" htmlFor="copy-audience" hint={brandId && !brandAudiences.length ? "Bu marka için profil yok; Markalar sayfasından ekleyebilirsin." : undefined}>
          <select id="copy-audience" name="audienceId" defaultValue="" key={brandId} disabled={!brandAudiences.length} className={selectClass}>
            <option value="">Seçilmedi</option>
            {brandAudiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Sektör" htmlFor="copy-sector" hint={brand ? "Markanın sektörü kullanılır." : undefined}>
          <select id="copy-sector" name="sector" defaultValue={brand?.sector ?? defaultSector} key={brand?.sector ?? "none"} disabled={Boolean(brand)} className={selectClass}>
            {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
          </select>
          {brand ? <input type="hidden" name="sector" value={brand.sector} /> : null}
        </Field>
      </div>
      <fieldset>
        <legend className="text-small font-semibold text-ink">Platform</legend>
        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-paper-2 p-1">
          {PLATFORM_IDS.map((p) => (
            <label key={p} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-small font-semibold ${platform === p ? "bg-card text-ink shadow-card" : "text-ink-soft"}`}>
              <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} className="sr-only" />
              {PLATFORM_SHORT[p]}
            </label>
          ))}
        </div>
      </fieldset>
      {!aiOn ? (
        <p className="rounded-xl bg-info-tint px-4 py-3 text-small text-info">
          Yapay zekâ bu ortamda kapalı. Sayfadaki bilgilerden şablonla öneri üretilir; kredi düşmez.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending || noCredit}>{pending ? "Üretiliyor…" : "Metinleri üret"}</Button>
        <span className="text-small text-muted">{aiOn ? "1 kredi, yalnızca üretim başarıyla biterse düşer." : "Kredisiz"}</span>
      </div>
      {noCredit ? <p className="text-small text-coral-deep">Kredin kalmadı. Krediler sayfasından paket alabilirsin.</p> : null}
      {state.error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{state.error}</p> : null}
    </form>
  );
}
