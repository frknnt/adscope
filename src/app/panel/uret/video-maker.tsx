"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buttonClass, inputClass, selectClass } from "@/components/ui";
import { PLATFORM_IDS, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { drawFrame, type DrawStyle, type FrameImage } from "@/lib/video-maker/draw";
import { buildTimeline, MAX_IMAGES, MAX_SECONDS, MIN_SECONDS, TRANSITIONS, VIDEO_H, VIDEO_W, type Transition } from "@/lib/video-maker/timeline";
import type { VideoReviewOut } from "@/lib/video-maker/review";
import { reviewVideoAction } from "./video-actions";

type BrandOpt = { id: string; name: string; sector: Sector; primaryColor: string | null; secondaryColor: string | null; preferredCta: string | null };
type Source = { key: string; label: string; image: FrameImage };

const MIMES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

async function bitmapFrom(blob: Blob): Promise<FrameImage> {
  const bmp = await createImageBitmap(blob);
  return { source: bmp, width: bmp.width, height: bmp.height };
}

const SEVERITY_CLASS = { red: "bg-coral-tint", yellow: "bg-amber-tint", info: "bg-info-tint" } as const;

export function VideoMaker({ brands, creatives, defaultSector }: { brands: BrandOpt[]; creatives: { href: string; label: string }[]; defaultSector: Sector }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [brandId, setBrandId] = useState("");
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const [brandName, setBrandName] = useState("");
  const [offer, setOffer] = useState("");
  const [cta, setCta] = useState("");
  const [seconds, setSeconds] = useState(9);
  const [transition, setTransition] = useState<Transition>("yakinlas");
  const [sector, setSector] = useState<Sector>(defaultSector);
  const [platform, setPlatform] = useState<Platform>("meta");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<{ url: string; mime: string; size: number } | null>(null);
  const [review, setReview] = useState<VideoReviewOut | null>(null);

  const style = useMemo<DrawStyle>(() => {
    const font = typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif";
    return { font, accent: brand?.secondaryColor ?? "#ff6a4d", accentText: "#0b1b3f", panel: brand?.primaryColor ?? "#0b1b3f" };
  }, [brand]);
  const spec = useMemo(
    () => ({ imageCount: Math.max(1, sources.length), durationSec: seconds, brand: brandName, offer, captions, cta, transition }),
    [sources.length, seconds, brandName, offer, captions, cta, transition],
  );
  const timeline = useMemo(() => buildTimeline(spec), [spec]);

  // Live preview of the opening second while the form changes.
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || progress !== null || !sources.length) return;
    drawFrame(ctx, timeline, 1, sources.map((s) => s.image), style);
  }, [timeline, sources, style, progress]);

  useEffect(() => () => (video ? URL.revokeObjectURL(video.url) : undefined), [video]);

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const picked = [...files].filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (picked.length < files.length) setError("Yalnızca 5 MB'a kadar JPG, PNG ya da WebP görseller eklenebilir.");
    const added: Source[] = [];
    for (const f of picked) {
      try {
        added.push({ key: `${f.name}-${f.size}-${Math.random()}`, label: f.name, image: await bitmapFrom(f) });
      } catch {
        setError("Bir görsel okunamadı.");
      }
    }
    setSources((s) => [...s, ...added].slice(0, MAX_IMAGES));
  }, []);

  async function addCreative(href: string, label: string) {
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error("fetch");
      const img = await bitmapFrom(await res.blob());
      setSources((s) => [...s, { key: `${href}-${Math.random()}`, label, image: img }].slice(0, MAX_IMAGES));
    } catch {
      setError("Görsel yüklenemedi.");
    }
  }

  async function render() {
    const mime = pickMime();
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!mime || !el || !ctx || typeof el.captureStream !== "function") return setError("Bu tarayıcı video kaydını desteklemiyor. Güncel Chrome, Edge ya da Safari ile dene.");
    if (!sources.length) return setError("En az bir görsel ekle.");
    if (!offer.trim()) return setError("İlk 3 saniyede görünecek teklif yazısını gir.");
    setError(null);
    setReview(null);
    setVideo(null);
    setProgress(0);
    const images = sources.map((s) => s.image);
    drawFrame(ctx, timeline, 0, images, style);
    const rec = new MediaRecorder(el.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
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
    const type = mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
    const blob = new Blob(chunks, { type });
    setVideo({ url: URL.createObjectURL(blob), mime: type, size: blob.size });
    setProgress(null);
    const res = await reviewVideoAction({ spec, mime: type, sizeBytes: Math.max(1, blob.size), sector: brand?.sector ?? sector, platform });
    if (res.ok) setReview(res.review);
    else setError(res.error);
  }

  const busy = progress !== null;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <form
        className="grid content-start gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void render();
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="text-small font-semibold text-ink">Görseller ({sources.length}/{MAX_IMAGES})</legend>
          <label htmlFor="video-gorsel" className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line-strong px-4 text-center font-semibold hover:border-ink focus-within:border-ink">
            Görsel ekle
            <input id="video-gorsel" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={sources.length >= MAX_IMAGES} onChange={(e) => void addFiles(e.target.files)} />
          </label>
          {creatives.length ? (
            <div className="flex flex-wrap gap-2">
              {creatives.map((c) => (
                <button key={c.href} type="button" disabled={sources.length >= MAX_IMAGES} onClick={() => void addCreative(c.href, c.label)} className="min-h-10 rounded-lg border border-line px-3 text-meta font-semibold hover:border-ink">
                  + {c.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-meta text-muted">Görsel sekmesinde indirdiğin PNG&apos;ler burada da listelenir.</p>
          )}
          {sources.map((s, i) => (
            <div key={s.key} className="grid gap-1.5 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-meta font-semibold">{i + 1}. {s.label}</span>
                <button type="button" onClick={() => (setSources((x) => x.filter((y) => y.key !== s.key)), setCaptions((c) => c.filter((_, j) => j !== i)))} className="min-h-9 text-meta font-semibold text-coral-deep">
                  Çıkar<span className="sr-only">: görsel {i + 1}</span>
                </button>
              </div>
              <label htmlFor={`video-alt-${i}`} className="text-meta text-ink-soft">Altyazı {i + 1} (isteğe bağlı)</label>
              <input id={`video-alt-${i}`} maxLength={90} value={captions[i] ?? ""} onChange={(e) => setCaptions((c) => Object.assign([...c], { [i]: e.target.value }))} className={inputClass} />
            </div>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="video-marka" className="text-sm font-semibold text-ink">Marka</label>
          <select id="video-marka" value={brandId} onChange={(e) => {
            const b = brands.find((x) => x.id === e.target.value);
            setBrandId(e.target.value);
            if (b) (setBrandName(b.name), setCta((c) => c || b.preferredCta || ""));
          }} className={selectClass}>
            <option value="">Markasız</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="video-marka-adi" className="text-sm font-semibold text-ink">Ekranda görünecek marka adı</label>
          <input id="video-marka-adi" maxLength={40} value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="video-teklif" className="text-sm font-semibold text-ink">Teklif (ilk 3 saniye)</label>
          <input id="video-teklif" required maxLength={90} value={offer} onChange={(e) => setOffer(e.target.value)} className={inputClass} placeholder="ör. Yeni sezon setleri sitede" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="video-cta" className="text-sm font-semibold text-ink">Kapanış çağrısı (isteğe bağlı)</label>
          <input id="video-cta" maxLength={30} value={cta} onChange={(e) => setCta(e.target.value)} className={inputClass} placeholder="ör. Hemen incele" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="video-sure" className="text-sm font-semibold text-ink">Süre: {seconds} saniye</label>
          <input id="video-sure" type="range" min={MIN_SECONDS} max={MAX_SECONDS} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="h-11 accent-ink" />
        </div>
        <fieldset>
          <legend className="text-small font-semibold text-ink">Geçiş</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TRANSITIONS.map((t) => (
              <label key={t.id} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-2 text-center text-meta font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                <input type="radio" name="gecis" value={t.id} checked={transition === t.id} onChange={() => setTransition(t.id)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="video-platform" className="text-sm font-semibold text-ink">Platform</label>
            <select id="video-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={selectClass}>
              {PLATFORM_IDS.map((p) => <option key={p} value={p}>{PLATFORM_SHORT[p]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="video-sektor" className="text-sm font-semibold text-ink">Sektör</label>
            <select id="video-sektor" value={brand?.sector ?? sector} disabled={Boolean(brand)} onChange={(e) => setSector(e.target.value as Sector)} className={selectClass}>
              {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={busy || !sources.length} className={`${buttonClass("accent")} w-full sm:w-auto`}>
          {busy ? `Video kaydediliyor… %${Math.round((progress ?? 0) * 100)}` : "Videoyu oluştur · ücretsiz"}
        </button>
        <p className="text-meta text-muted">Video bu cihazda, gerçek zamanlı kaydedilir; görseller sunucuya gönderilmez. Kayıt bitene kadar sekmeyi açık tut.</p>
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{error}</p> : null}
      </form>

      <section aria-labelledby="video-onizleme" className="grid content-start gap-4">
        <h2 id="video-onizleme" className="text-2xl font-bold">Önizleme</h2>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <canvas ref={canvas} width={VIDEO_W} height={VIDEO_H} aria-label="Video önizlemesi, 1080×1920" role="img" className="aspect-[9/16] w-full max-w-72 rounded-2xl border border-line bg-paper-2" />
          <div className="grid content-start gap-3">
            {!sources.length ? <p className="text-ink-soft">Görsel ekle; önizleme açılış saniyesini gösterir. Üst ve alttaki gri alanlar uygulama arayüzünün altında kalır, yazılar bu alanların dışında tutulur.</p> : null}
            {video ? (
              <>
                {/* Silent video: no captions track is needed, all text is burnt in. */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={video.url} controls playsInline aria-label="Oluşturulan video" className="aspect-[9/16] w-full max-w-72 rounded-2xl bg-ink" />
                <a href={video.url} download={`adscope-video-${timeline.duration}sn.${video.mime === "video/mp4" ? "mp4" : "webm"}`} className={`${buttonClass("primary")} w-full sm:w-auto`}>
                  Videoyu indir ({video.mime === "video/mp4" ? "MP4" : "WebM"})
                </a>
                {video.mime === "video/webm" ? <p className="text-meta text-muted">Bu tarayıcı MP4 kaydedemiyor; video WebM olarak hazırlandı. Meta WebM kabul eder; TikTok için MP4&apos;e dönüştürmen gerekebilir.</p> : null}
              </>
            ) : null}
          </div>
        </div>
        {review ? (
          <div className="grid gap-3" aria-label="Video kontrolü">
            <h3 className="text-lg font-bold">Video kontrolü</h3>
            <p className={`rounded-xl px-4 py-3 text-small text-ink ${review.hookStrong ? "bg-green-tint" : "bg-amber-tint"}`}>
              <strong>Kanca notu:</strong> {review.hookNote}
            </p>
            {review.issues.length ? <p className="rounded-xl bg-amber-tint px-4 py-3 text-small text-ink">Ekrandaki yazılarda dikkat: {review.issues.join(" · ")}. Tam analizle ayrıntıları görebilirsin.</p> : <p className="text-small text-ink-soft">Ekrandaki yazılarda kural kartlarıyla eşleşme yok.</p>}
            <ul className="grid gap-2">
              {review.notes.map((n) => (
                <li key={n.title} className={`rounded-xl px-4 py-3 text-small text-ink ${SEVERITY_CLASS[n.severity]}`}>
                  <strong>{n.title}.</strong> {n.explanation} {n.suggestion}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {review.scores.map((s) => (
                <div key={s.label} className="rounded-xl bg-paper-2 px-2 py-2.5">
                  <dt className="text-fine text-muted">{s.label}</dt>
                  <dd className="text-small font-bold tabular">{s.score}/{s.max}</dd>
                </div>
              ))}
            </dl>
            <p className="text-meta text-muted">Risk değerlendirmesidir, hukuki görüş değildir.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
