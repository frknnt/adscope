"use client";

import { unzipSync, zipSync } from "fflate";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RiskBadge } from "@/components/panel-ui";
import { buttonClass, Disclaimer, Field, inputClass, selectClass, Stepper } from "@/components/ui";
import type { CampaignProduct, PreviewCheck } from "@/lib/campaign/service";
import type { CampaignVariant, VariantText } from "@/lib/campaign/variants";
import { LAYOUTS, type LayoutId } from "@/lib/creative/layouts";
import { creativeQueryString, type CreativeQuery } from "@/lib/creative/request";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES } from "@/lib/creative/sizes";
import { PLATFORM_IDS, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { drawFrame, type FrameImage } from "@/lib/video-maker/draw";
import { buildTimeline } from "@/lib/video-maker/timeline";
import { campaignDraftAction, campaignExportAction, campaignPreviewAction, campaignReadAction } from "./campaign-actions";

type BrandOpt = { id: string; name: string; sector: Sector; website: string | null; primaryColor: string | null; secondaryColor: string | null };
type AudienceOpt = { id: string; brandId: string; name: string };

const STEPS = ["Ürün", "10 metin", "Görseller", "Video", "Paket"];
const RISK_TEXT = { ok: "Eşleşen kural yok", yellow: "Sarı bayrak", red: "Kırmızı bayrak" } as const;
const RISK_BORDER = { ok: "border-line", yellow: "border-caution/60", red: "border-coral/45" } as const;
const VIDEO_SECONDS = 9;
const MIMES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
const pickMime = () => (typeof MediaRecorder === "undefined" ? null : (MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null));

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function CampaignPackage({
  brands,
  audiences,
  defaultSector,
  balance,
  aiOn,
  cost,
  pick,
  initial,
}: {
  brands: BrandOpt[];
  audiences: AudienceOpt[];
  defaultSector: Sector;
  balance: number;
  aiOn: boolean;
  cost: number;
  pick: number;
  initial: { url: string; brandId: string; auto: boolean };
}) {
  const [form, setForm] = useState({ url: initial.url, productName: "", description: "", brandId: brands.some((b) => b.id === initial.brandId) ? initial.brandId : "", audienceId: "", platform: "meta" as Platform, sector: defaultSector });
  const brand = brands.find((b) => b.id === form.brandId) ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<{ value: CampaignProduct; fromPage: boolean } | null>(null);
  const [draft, setDraft] = useState<{ variants: CampaignVariant[]; source: "ai" | "template"; aiFailed: boolean; sector: Sector; platform: Platform; brandId: string } | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [layout, setLayout] = useState<LayoutId>("manset");
  const [preview, setPreview] = useState<{ key: string; items: PreviewCheck[] } | null>(null);
  const [withVideo, setWithVideo] = useState(false);
  const [done, setDone] = useState<{ key: string; href: string; charged: number; video: boolean } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const started = useRef(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const pickedTexts: VariantText[] = useMemo(() => (draft ? picked.map((i) => draft.variants[i]).map((v) => ({ headline: v.headline, primaryText: v.primaryText, cta: v.cta })) : []), [draft, picked]);
  const key = draft ? JSON.stringify([draft.variants.map((v) => v.headline), picked, layout]) : "";
  // One request id per package content: a second click is not charged again, a changed package is new.
  const requestId = useMemo(() => (key ? crypto.randomUUID() : ""), [key]);

  const start = useCallback(
    async (f: typeof form) => {
      setError(null);
      setDraft(null);
      setPreview(null);
      setDone(null);
      setPicked([]);
      setBusy("Sayfa okunuyor (1/2)…");
      const read = await campaignReadAction({ url: f.url, productName: f.productName, description: f.description });
      if (!read.ok) {
        setBusy(null);
        return setError(read.error);
      }
      setProduct({ value: read.product, fromPage: read.fromPage });
      setBusy("Metinler hazırlanıyor ve kural motorundan geçiyor (2/2)…");
      const res = await campaignDraftAction({ product: read.product, brandId: f.brandId, audienceId: f.audienceId, platform: f.platform, sector: f.sector });
      setBusy(null);
      if (!res.ok) return setError(res.error);
      setDraft({ variants: res.variants, source: res.source, aiFailed: res.aiFailed, sector: res.sector, platform: f.platform, brandId: f.brandId });
      const rank = { ok: 0, yellow: 1, red: 2 } as const;
      setPicked(
        res.variants
          .map((v, i) => ({ i, r: rank[v.risk], s: v.metaScore }))
          .sort((a, b) => a.r - b.r || a.s - b.s || a.i - b.i)
          .slice(0, pick)
          .map((x) => x.i)
          .sort((a, b) => a - b),
      );
    },
    [pick],
  );

  useEffect(() => {
    if (initial.auto && initial.url && !started.current) {
      started.current = true;
      void start(form);
    }
  }, [initial.auto, initial.url, start, form]);

  async function showPreviews() {
    if (!draft || picked.length !== pick) return;
    setError(null);
    setBusy("Önizlemeler hazırlanıyor…");
    const res = await campaignPreviewAction({ brandId: draft.brandId, platform: draft.platform, sector: draft.sector, layout, variants: pickedTexts });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setPreview({ key, items: res.items });
  }

  async function recordVideo(zip: Record<string, Uint8Array>): Promise<{ bytes: Uint8Array; ext: string } | null> {
    const mime = pickMime();
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!mime || !el || !ctx || typeof el.captureStream !== "function") return null;
    const images: FrameImage[] = [];
    for (let k = 1; k <= pick; k++) {
      const png = zip[`gorseller/metin-${k}-1080x1920.png`];
      if (!png) return null;
      const bmp = await createImageBitmap(new Blob([png as BlobPart], { type: "image/png" }));
      images.push({ source: bmp, width: bmp.width, height: bmp.height });
    }
    const timeline = buildTimeline({ imageCount: images.length, durationSec: VIDEO_SECONDS, brand: "", offer: "", captions: [], cta: pickedTexts[0]?.cta ?? "", transition: "gecis" });
    const style = { font: getComputedStyle(document.body).fontFamily || "sans-serif", accent: brand?.secondaryColor ?? "#ff6a4d", accentText: "#0b1b3f", panel: brand?.primaryColor ?? "#0b1b3f" };
    drawFrame(ctx, timeline, 0, images, style);
    const rec = new MediaRecorder(el.captureStream(30), { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => void (e.data.size && chunks.push(e.data));
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.start(250);
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        drawFrame(ctx, timeline, Math.min(t, timeline.duration - 0.001), images, style);
        setProgress(Math.min(1, t / timeline.duration));
        if (t >= timeline.duration) resolve();
        else setTimeout(tick, 1000 / 30);
      };
      tick();
    });
    rec.stop();
    await stopped;
    setProgress(null);
    return { bytes: new Uint8Array(await new Blob(chunks).arrayBuffer()), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  }

  async function download() {
    if (!draft || !product || picked.length !== pick) return;
    setError(null);
    setBusy("Paket hazırlanıyor…");
    const res = await campaignExportAction({
      requestId,
      brandId: draft.brandId,
      platform: draft.platform,
      sector: draft.sector,
      layout,
      productName: product.value.name.slice(0, 80),
      variants: draft.variants.map((v) => ({ headline: v.headline, primaryText: v.primaryText, cta: v.cta })),
      picked,
    });
    if (!res.ok) {
      setBusy(null);
      return setError(res.error);
    }
    let video = false;
    try {
      const file = await fetch(res.href);
      if (!file.ok) throw new Error("fetch");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (withVideo) {
        setBusy("Video tarayıcında hazırlanıyor. Bu sekmeyi açık tut…");
        const zip: Record<string, Uint8Array> = unzipSync(bytes);
        const clip = await recordVideo(zip);
        if (clip) {
          zip[`video/adscope-video.${clip.ext}`] = clip.bytes;
          video = true;
          saveBlob(new Blob([zipSync(Object.fromEntries(Object.entries(zip).map(([n, b]) => [n, [b, { level: 0 }]]))) as BlobPart], { type: "application/zip" }), "adscope-kampanya-paketi.zip");
        } else {
          setError("Bu tarayıcıda video hazırlanamadı; paket videosuz indirildi. Güncel Chrome, Edge ya da Safari ile videolu paketi aynı ücretle yeniden indirebilirsin.");
          saveBlob(new Blob([bytes as BlobPart], { type: "application/zip" }), "adscope-kampanya-paketi.zip");
        }
      } else {
        saveBlob(new Blob([bytes as BlobPart], { type: "application/zip" }), "adscope-kampanya-paketi.zip");
      }
    } catch {
      setError("Paket hazır ama indirme başlamadı. Aşağıdaki bağlantıyı kullan; yeniden ücretlendirilmez.");
    }
    setBusy(null);
    setDone({ key, href: res.href, charged: res.charged, video });
  }

  const step = done?.key === key ? 4 : preview?.key === key ? 3 : draft ? (picked.length === pick ? 2 : 1) : 0;
  const brandAudiences = audiences.filter((a) => a.brandId === form.brandId);
  const q = (v: VariantText): CreativeQuery => ({ marka: draft?.brandId || null, platform: draft?.platform ?? "meta", sektor: draft?.sector ?? "genel", baslik: v.headline.slice(0, 90), metin: v.primaryText.slice(0, 220), cta: v.cta.slice(0, 30), boyut: "kare", yerlesim: layout });

  return (
    <div className="grid gap-6">
      <Stepper steps={STEPS} current={step} label="Kampanya paketi adımları" />
      <p aria-live="polite" className="sr-only">{busy ?? ""}</p>

      <form
        className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void start(form);
        }}
        aria-labelledby="paket-urun"
      >
        <h2 id="paket-urun" className="text-xl font-bold">1. Ürün</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Ürün sayfası adresi" htmlFor="pk-url" hint="Sayfayı güvenli tarayıcımızla bir kez okuruz; sayfadaki yazılar talimat sayılmaz.">
            <input id="pk-url" type="url" inputMode="url" value={form.url} onChange={(e) => set("url", e.target.value)} maxLength={2048} placeholder="https://" className={inputClass} />
          </Field>
          <Field label="Ya da kısa açıklama" htmlFor="pk-desc" hint="Adres yoksa ürünü bir iki cümleyle anlat.">
            <textarea id="pk-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={600} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Ürün adı (isteğe bağlı)" htmlFor="pk-name">
            <input id="pk-name" value={form.productName} onChange={(e) => set("productName", e.target.value)} maxLength={80} className={inputClass} />
          </Field>
          <Field label="Marka" htmlFor="pk-brand">
            <select id="pk-brand" value={form.brandId} onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value, audienceId: "" }))} className={selectClass}>
              <option value="">Markasız</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Hedef kitle" htmlFor="pk-aud" hint={form.brandId ? undefined : "Marka seçince profiller listelenir."}>
            <select id="pk-aud" value={form.audienceId} onChange={(e) => set("audienceId", e.target.value)} disabled={!form.brandId} className={selectClass}>
              <option value="">Genel</option>
              {brandAudiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Sektör" htmlFor="pk-sector" hint={brand ? "Markanın sektörü kullanılır." : undefined}>
            <select id="pk-sector" value={brand?.sector ?? form.sector} onChange={(e) => set("sector", e.target.value as Sector)} disabled={Boolean(brand)} className={selectClass}>
              {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
            </select>
          </Field>
        </div>
        <fieldset>
          <legend className="text-small font-semibold text-ink">Platform</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORM_IDS.map((p) => (
              <label key={p} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-small font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                <input type="radio" name="pk-platform" value={p} checked={form.platform === p} onChange={() => set("platform", p)} className="accent-ink" />
                {PLATFORM_SHORT[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={Boolean(busy)} className={buttonClass("accent")}>{draft ? "Yeniden hazırla" : "Paketi hazırla"}</button>
          <p className="text-meta text-muted">
            {aiOn ? "Metinler yapay zekâyla yazılır." : "Yapay zekâ bu ortamda kapalı; metinler şablondan hazırlanır."} Önizlemeler ücretsiz; paketi indirmek {cost} kredi.
          </p>
        </div>
        {busy ? <p className="rounded-xl bg-blue-tint px-4 py-3 text-small font-semibold text-ink">{busy}</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-small font-medium text-coral-deep">{error}</p> : null}
      </form>

      {draft && product ? (
        <section aria-labelledby="paket-metinler" className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-6">
          <div>
            <h2 id="paket-metinler" className="text-xl font-bold">2. Metinler</h2>
            <p className="mt-1 text-small text-ink-soft">
              {product.fromPage ? "Sayfadan okunan ürün" : "Ürün"}: <strong className="text-ink">{product.value.name || "adsız ürün"}</strong>
              {product.value.summary ? ` · ${product.value.summary}` : ""}
            </p>
            <p className="mt-1 text-meta text-muted">
              {draft.source === "ai" ? "Yapay zekâ önerileri." : draft.aiFailed ? "Yapay zekâ yanıt vermedi; şablon öneriler gösteriliyor." : "Şablon öneriler (yapay zekâ kapalı)."} Her metin kural motorundan geçti. Görsele dönüştürmek için {pick} metin seç ({picked.length}/{pick}).
            </p>
          </div>
          <ol className="grid gap-3 lg:grid-cols-2">
            {draft.variants.map((v, i) => {
              const on = picked.includes(i);
              return (
                <li key={v.n} className={`grid gap-2 rounded-xl border p-3 ${on ? "border-ink bg-paper-2" : RISK_BORDER[v.risk]}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-small font-semibold">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && picked.length >= pick}
                        onChange={() => setPicked((p) => (on ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)))}
                        className="size-5 accent-ink"
                      />
                      {v.n}. metni görsele dönüştür
                    </label>
                    <RiskBadge level={v.metaLevel} score={v.metaScore} label={`${v.n}. metin kural puanı`} className="ml-auto" />
                  </div>
                  <p className="font-bold text-ink">{v.headline}</p>
                  {v.primaryText ? <p className="text-small text-ink-soft">{v.primaryText}</p> : null}
                  <p className="text-meta text-muted">
                    Çağrı: {v.cta || "—"} · {RISK_TEXT[v.risk]}
                    {v.issues.length ? `: ${v.issues.join(" · ")}` : ""}
                    {v.safeApplied ? " · Riskli ifade güvenli sürümüyle değiştirildi." : ""}
                  </p>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Görsel yerleşimi" htmlFor="pk-layout">
              <select id="pk-layout" value={layout} onChange={(e) => setLayout(e.target.value as LayoutId)} className={selectClass}>
                {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Field>
            <button type="button" onClick={() => void showPreviews()} disabled={Boolean(busy) || picked.length !== pick} className={buttonClass("primary")}>
              Önizlemeleri göster
            </button>
          </div>
        </section>
      ) : null}

      {draft && preview?.key === key ? (
        <section aria-labelledby="paket-gorseller" className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-6">
          <div>
            <h2 id="paket-gorseller" className="text-xl font-bold">3. Görseller</h2>
            <p className="mt-1 text-meta text-muted">Önizlemeler küçültülmüş ve ücretsizdir. Pakette her biri tam boyutlu PNG olarak yer alır.</p>
          </div>
          <ul className="grid gap-5">
            {pickedTexts.map((v, k) => {
              const item = preview.items[k];
              return (
                <li key={k} className="grid gap-3 rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 flex-1 font-bold">{picked[k] + 1}. metin: {v.headline}</h3>
                    <RiskBadge level={item.check.metaLevel} score={item.check.metaScore} label="Görseldeki sözcüklerin kural puanı" />
                  </div>
                  <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {CREATIVE_SIZE_IDS.map((s) => (
                      <li key={s} className="grid content-start gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/creative/preview?${creativeQueryString(q(v), { boyut: s })}`}
                          alt={`${picked[k] + 1}. metin, ${CREATIVE_SIZES[s].label} önizleme`}
                          width={Math.round(CREATIVE_SIZES[s].w * 0.4)}
                          height={Math.round(CREATIVE_SIZES[s].h * 0.4)}
                          loading="lazy"
                          className="h-auto w-full rounded-lg border border-line bg-paper-2"
                        />
                        <span className="text-meta font-semibold text-ink">{CREATIVE_SIZES[s].label}</span>
                        {item.warnings[s].length ? (
                          <ul className="grid gap-1">{item.warnings[s].map((w) => <li key={w} className="rounded-md bg-amber-tint px-2 py-1 text-meta text-ink">{w}</li>)}</ul>
                        ) : (
                          <span className="text-meta text-green">Uyarı yok</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {item.check.issues.length ? <p className="text-meta text-ink-soft">Dikkat: {item.check.issues.join(" · ")}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {draft && preview?.key === key ? (
        <section aria-labelledby="paket-indir" className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-6">
          <h2 id="paket-video" className="text-xl font-bold">4. Video (isteğe bağlı)</h2>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-small">
            <input type="checkbox" checked={withVideo} disabled={Boolean(busy)} onChange={(e) => setWithVideo(e.target.checked)} className="mt-0.5 size-5 accent-ink" />
            <span>
              <strong className="text-ink">Pakete {VIDEO_SECONDS} saniyelik dikey video ekle.</strong> Üç görselin hikâye boyutundan tarayıcında hazırlanır, ek ücret yok. Hazırlanırken bu sekmeyi açık tut.
            </span>
          </label>
          {progress !== null ? (
            <div className="grid gap-2">
              <progress value={progress} max={1} className="w-full" aria-label="Video hazırlanıyor" />
            </div>
          ) : null}
          <canvas ref={canvas} width={1080} height={1920} className={progress !== null ? "w-32 rounded-lg border border-line" : "hidden"} aria-hidden />

          <h2 id="paket-indir" className="text-xl font-bold">5. Paketi indir</h2>
          <ul className="grid gap-1 text-small text-ink-soft">
            <li>{pick * CREATIVE_SIZE_IDS.length} PNG: {pick} metin, her biri 4 boyutta</li>
            <li>Varyant tablosu (CSV): {draft.variants.length} metin, risk düzeyi ve güvenli sürüm</li>
            <li>PDF kontrol raporu</li>
            {withVideo ? <li>Dikey video ({VIDEO_SECONDS} sn)</li> : null}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void download()} disabled={Boolean(busy) || balance < cost} className={buttonClass("accent")}>
              Paketi indir ({cost} kredi)
            </button>
            <p className="text-meta text-muted">Kredi tek seferde ve yalnızca paket başarıyla yazılınca düşer. Aynı paketi yeniden indirmek ücretlendirilmez.</p>
          </div>
          {balance < cost && done?.key !== key ? (
            <p className="text-small text-coral-deep">
              Paket için {cost} kredi gerekiyor, bakiyen {balance}. <Link href="/panel/krediler">Krediler</Link> sayfasından paket alabilirsin; önizlemeler ücretsiz.
            </p>
          ) : null}
          {done?.key === key ? (
            <p role="status" className="rounded-xl bg-green-tint px-4 py-3 text-small text-green">
              Paket hazır{done.video ? " (video dahil)" : ""}. {done.charged ? `${done.charged} kredi düştü.` : "Bu paket için yeniden ücret alınmadı."}{" "}
              <a href={done.href} download className="font-semibold text-green underline">
                Paketi yeniden indir{done.video ? " (videosuz kopya)" : ""}
              </a>
            </p>
          ) : null}
          <Disclaimer />
        </section>
      ) : null}
    </div>
  );
}
