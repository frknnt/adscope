"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { IconAlert, IconImage, IconUpload, IconVideo } from "@/components/icons";
import { Button, Field, inputClass } from "@/components/ui";
import { creditCostFor } from "@/lib/analysis/cost";
import { analyzeAudio, extractVideoFrames, VIDEO_MIME, videoErrorMessage, type AudioInfo, type ExtractedVideo } from "@/lib/video/extract-frames";

import { SECTOR_IDS, SECTOR_INFO, type Sector } from "@/lib/sectors";
import { isPlatform, PLATFORM_IDS, PLATFORM_INFO, type Platform } from "@/lib/platforms";
type BrandOpt = { id: string; name: string; sector: Sector };

const STEPS = ["Kreatif", "Metin", "Sektör", "Beyanlar", "Ret mesajı", "Kontrol"] as const;
const FRAME_COUNT = 6;
/** Seconds of audio sent for speech-to-text (only with consent). */
const SPEECH_SECONDS = 90;
const MAX_VIDEO_SECONDS = 600;
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = ["image/jpeg", "image/png", "image/webp"];

const SECTORS: { value: Sector; label: string; note: string }[] = SECTOR_IDS.map((s) => ({ value: s, label: SECTOR_INFO[s].label, note: SECTOR_INFO[s].note }));

type ImageState = { file: File; url: string; width: number; height: number } | null;
type VideoState = (ExtractedVideo & { name: string; audio: AudioInfo; wav: Blob | null }) | null;
type ShotState = { file: File; url: string } | null;
export type WizardInitial = { headline?: string; primaryText?: string; description?: string; sector?: Sector; templateTitle?: string; platform?: Platform; landingUrl?: string };
type Media = "image" | "video";

/** Accepts "ornek.com/kampanya" as well as full URLs; returns null when it cannot be a public web address. */
function normalizeLandingUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}
type Phase = { kind: "editing" } | { kind: "submitting" } | { kind: "error"; message: string; retryable: boolean; analysisId?: string };

function Counter({ value, soft, max }: { value: string; soft: number; max: number }) {
  const n = [...value].length;
  return (
    <span className={`tabular ${n > soft ? "text-amber" : "text-muted"}`}>
      {n} / {max}
      {n > soft ? ` · ${soft} karakterden sonrası mobilde kesilebilir` : ""}
    </span>
  );
}

function readImageSize(url: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function AnalysisWizard({
  brands,
  defaultSector,
  balance,
  speechEnabled = false,
  initial,
}: {
  brands: BrandOpt[];
  defaultSector: Sector;
  balance: number;
  speechEnabled?: boolean;
  initial?: WizardInitial;
}) {
  const router = useRouter();
  const ids = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const shownStep = useRef(0);

  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<Media>("image");
  const [image, setImage] = useState<ImageState>(null);
  const [video, setVideo] = useState<VideoState>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [landingUrl, setLandingUrl] = useState(initial?.landingUrl ?? "");
  const [landingError, setLandingError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [primaryText, setPrimaryText] = useState(initial?.primaryText ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [textError, setTextError] = useState<string | null>(null);
  const [sector, setSector] = useState<Sector>(initial?.sector ?? defaultSector);
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? "meta");
  const [speechOptIn, setSpeechOptIn] = useState(false);
  const [shot, setShot] = useState<ShotState>(null);
  const [shotError, setShotError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string>("");
  const [flags, setFlags] = useState({ influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false });
  const [rejection, setRejection] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  // One id per attempt: a double click or network retry of the same attempt reuses it (idempotent server side).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  // Prefill from the URL fragment (#metin=…&baslik=…&url=…&platform=…), used by the browser
  // extension and the inspiration board. A fragment never reaches the server, so ad text does not
  // end up in request logs; it is removed from the address bar right after reading.
  const [fromLink, setFromLink] = useState(false);
  useEffect(() => {
    if (initial?.templateTitle || !window.location.hash.startsWith("#")) return;
    const hp = new URLSearchParams(window.location.hash.slice(1));
    const clean = (k: string, max: number) => (hp.get(k) ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
    const text = clean("metin", 2200);
    const head = clean("baslik", 255);
    const url = clean("url", 2048);
    const plat = hp.get("platform");
    if (!text && !head && !url && !isPlatform(plat)) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only state */
    if (text) setPrimaryText(text);
    if (head) setHeadline(head);
    if (/^https?:\/\//i.test(url)) setLandingUrl(url);
    if (isPlatform(plat)) setPlatform(plat);
    setFromLink(Boolean(text || head || url));
    /* eslint-enable react-hooks/set-state-in-effect */
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [initial?.templateTitle]);

  useEffect(() => {
    // Move focus only when the step actually changes (not on mount, not on StrictMode re-runs).
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);
  useEffect(() => () => { video?.frames.forEach((f) => URL.revokeObjectURL(f.url)); }, [video]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  function acceptShot(file: File | undefined) {
    setShotError(null);
    if (!file) return setShot(null);
    if (!MIME.includes(file.type)) return setShotError("Ekran görüntüsü JPG, PNG veya WebP olmalı.");
    if (file.size > MAX_BYTES) return setShotError("Ekran görüntüsü en fazla 5 MB olabilir.");
    setShot({ file, url: URL.createObjectURL(file) });
  }

  async function acceptVideo(file: File | undefined) {
    setImageError(null);
    if (!file) return;
    if (!(VIDEO_MIME as readonly string[]).includes(file.type)) return setImageError("Yalnızca MP4, MOV veya WebM videolar seçilebilir.");
    setVideoBusy(true);
    try {
      // Frames and audio are both read in the browser; the video file itself is never uploaded.
      const [v, sound] = await Promise.all([
        extractVideoFrames(file, { count: FRAME_COUNT, maxSeconds: MAX_VIDEO_SECONDS }),
        analyzeAudio(file, { wavSeconds: speechEnabled ? SPEECH_SECONDS : 0 }),
      ]);
      setVideo({ ...v, name: file.name, audio: sound.info, wav: sound.wav });
    } catch (e) {
      setImageError(videoErrorMessage(e));
    } finally {
      setVideoBusy(false);
    }
  }

  function acceptAny(file: File | undefined) {
    if (!file) return;
    if (file.type.startsWith("video/")) {
      setMedia("video");
      return void acceptVideo(file);
    }
    setMedia("image");
    return void acceptFile(file);
  }
  async function acceptFile(file: File | undefined) {
    setImageError(null);
    if (!file) return;
    if (!MIME.includes(file.type)) return setImageError("Yalnızca JPG, PNG veya WebP görseller yüklenebilir.");
    if (file.size > MAX_BYTES) return setImageError("Görsel en fazla 5 MB olabilir.");
    const url = URL.createObjectURL(file);
    const size = await readImageSize(url);
    if (!size) {
      URL.revokeObjectURL(url);
      return setImageError("Görsel okunamadı. Dosya bozuk olabilir; başka bir dosya deneyin.");
    }
    if (Math.min(size.width, size.height) < 200) {
      URL.revokeObjectURL(url);
      return setImageError("Görsel çok küçük. En kısa kenar en az 200 piksel olmalı.");
    }
    setImage({ file, url, ...size });
  }

  function validate(s: number) {
    if (s === 0 && media === "image" && !image) {
      setImageError("Devam etmek için bir görsel seçin.");
      return false;
    }
    if (s === 0 && media === "video" && !video) {
      setImageError(videoBusy ? "Video kareleri hazırlanıyor, birkaç saniye bekle." : "Devam etmek için bir video seçin.");
      return false;
    }
    if (s === 1) {
      let ok = true;
      if (!primaryText.trim()) {
        setTextError("Reklam ana metni gerekli.");
        ok = false;
      } else setTextError(null);
      if (landingUrl.trim() && !normalizeLandingUrl(landingUrl)) {
        setLandingError("Geçerli bir web adresi gir; örneğin https://ornek.com/kampanya");
        ok = false;
      } else setLandingError(null);
      return ok;
    }
    return true;
  }

  function next() {
    if (!validate(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (phase.kind === "submitting") return;
    if (media === "image" ? !image : !video) return;
    setPhase({ kind: "submitting" });
    const fd = new FormData();
    if (media === "image" && image) fd.set("image", image.file);
    if (media === "video" && video) video.frames.forEach((f, i) => fd.append("frames", f.blob, `kare-${i + 1}.jpg`));
    const sendSpeech = media === "video" && speechEnabled && speechOptIn && !!video?.wav;
    if (sendSpeech && video?.wav) fd.set("audio", video.wav, "ses.wav");
    if (shot) fd.set("landingScreenshot", shot.file);
    fd.set(
      "payload",
      JSON.stringify({
        clientRequestId: requestId,
        brandId: brandId || null,
        sector,
        platform,
        headline,
        primaryText,
        description,
        rejectionMessage: rejection.trim() || null,
        flags,
        mediaType: media,
        video:
          media === "video" && video
            ? { mime: video.mime, durationSec: video.durationSec, width: video.width, height: video.height, sizeBytes: video.sizeBytes, frameTimesMs: video.frames.map((f) => f.timeMs), audio: video.audio }
            : null,
        transcript: media === "video" ? transcript.trim() || null : null,
        landingUrl: normalizeLandingUrl(landingUrl),
        speechToText: sendSpeech,
      }),
    );
    try {
      const res = await fetch("/api/analyses", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; analysisId?: string; code?: string; message?: string } | null;
      if (res.ok && data?.ok && data.analysisId) {
        router.push(`/panel/analiz/${data.analysisId}`);
        router.refresh();
        return;
      }
      // A finished attempt cannot be resubmitted with the same id: next try is a new attempt.
      setRequestId(crypto.randomUUID());
      setPhase({
        kind: "error",
        message: data?.message ?? "Beklenmeyen bir sorun oluştu. Krediniz düşülmedi; lütfen tekrar deneyin.",
        retryable: data?.code !== "insufficient_credits",
        analysisId: data?.analysisId,
      });
    } catch {
      // Network failure: the server may or may not have finished. Keep the same id so a retry is deduplicated.
      setPhase({ kind: "error", message: "Bağlantı kesildi. Krediniz yalnızca rapor tamamlanırsa düşer; tekrar denediğinizde aynı analiz kaldığı yerden döner.", retryable: true });
    }
  }

  if (phase.kind === "submitting") {
    return (
      <div className="sheet mt-8 rounded-2xl border border-line px-6 py-12 text-center" role="status" aria-live="polite">
        <div className="mx-auto size-12 animate-spin rounded-full border-[3px] border-line border-t-coral motion-reduce:animate-none" aria-hidden />
        <p className="mt-6 font-display text-2xl font-semibold">Reklamın inceleniyor…</p>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          {media === "video" ? "Video kareleri doğrulanıyor" : "Görsel doğrulanıyor"}
          {media === "video" && speechEnabled && speechOptIn && video?.wav ? ", konuşma yazıya dökülüyor" : ""}
          {normalizeLandingUrl(landingUrl) || shot ? ", açılış sayfası taranıyor" : ""}, kural kartları uygulanıyor, güvenli metin ve varyantlar hazırlanıyor. Genellikle 10–60 saniye sürer; bu sayfadan ayrılma.
        </p>
      </div>
    );
  }

  const stepTitle = [
    media === "video" ? "Reklam videosunu seç" : "Reklam görselini yükle",
    "Reklam metnini gir",
    "Sektörü ve markayı seç",
    "İçerik beyanları",
    "Daha önce reddedildi mi?",
    "Kontrol et ve başlat",
  ][step];

  return (
    <div className="mt-8">
      {fromLink ? (
        <p className="mb-6 max-w-3xl rounded-xl bg-info-tint px-4 py-3 text-[0.9rem] text-info">
          Metin tarayıcı eklentisinden veya ilham panosundan geldi. Göndermeden önce kontrol et; görseli ilk adımda sen ekleyeceksin.
        </p>
      ) : null}
      <ol className="flex flex-wrap gap-x-1 gap-y-2 text-[0.8rem] font-semibold" aria-label="Adımlar">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span
              aria-current={i === step ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${i === step ? "bg-ink text-paper" : i < step ? "bg-paper-2 text-ink" : "text-muted"}`}
            >
              <span className="tabular">{i + 1}</span> {s}
            </span>
            {i < STEPS.length - 1 ? <span className="text-line-strong" aria-hidden>—</span> : null}
          </li>
        ))}
        <li className="flex items-center gap-1 text-muted"><span className="text-line-strong" aria-hidden>—</span><span className="px-2.5 py-1"><span className="tabular">7</span> Rapor</span></li>
      </ol>

      <section className="mt-6 rounded-2xl border border-line bg-card p-5 sm:p-8" aria-labelledby={`${ids}-h`}>
        <h2 id={`${ids}-h`} ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
          <span className="sr-only">Adım {step + 1} / 7: </span>
          {stepTitle}
        </h2>

        {phase.kind === "error" ? (
          <div role="alert" className="mt-5 flex gap-3 rounded-xl bg-coral-tint px-4 py-3 text-[0.93rem] text-coral-deep">
            <IconAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">{phase.message}</p>
              {phase.analysisId ? <Link href={`/panel/analiz/${phase.analysisId}`} className="font-semibold text-coral-deep">Kaydı görüntüle</Link> : null}
              {!phase.retryable ? <Link href="/panel/krediler" className="ml-3 font-semibold text-coral-deep">Kredi yükle</Link> : null}
            </div>
          </div>
        ) : null}

        {step === 0 ? (
          <div className="mt-5">
            <div role="radiogroup" aria-label="Kreatif türü" className="inline-flex rounded-xl border border-line-strong bg-paper/60 p-1">
              {([
                ["image", "Görsel", IconImage],
                ["video", "Video / Reels", IconVideo],
              ] as const).map(([value, label, Icon]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.92rem] font-semibold text-ink-soft has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral">
                  <input type="radio" name="media" value={value} checked={media === value} onChange={() => { setMedia(value); setImageError(null); }} className="sr-only" />
                  <Icon className="size-4.5" /> {label}
                </label>
              ))}
            </div>

            <label
              htmlFor={`${ids}-file`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptAny(e.dataTransfer.files?.[0]); }}
              className={`mt-4 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragOver ? "border-coral bg-coral-tint/40" : "border-line-strong bg-paper/60 hover:bg-paper-2/60"}`}
            >
              {media === "image" && image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt="Yüklenecek reklam görselinin önizlemesi" className="max-h-72 rounded-lg border border-line object-contain shadow-sm" />
              ) : media === "video" && videoBusy ? (
                <span className="flex flex-col items-center gap-3 text-ink-soft" role="status">
                  <span className="size-8 animate-spin rounded-full border-[3px] border-line border-t-coral motion-reduce:animate-none" aria-hidden />
                  <span className="font-semibold text-ink">Videodan kareler alınıyor…</span>
                </span>
              ) : media === "video" && video ? (
                <span className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {video.frames.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f.url} src={f.url} alt={`Kare ${i + 1}, ${(f.timeMs / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}. saniye`} className="h-40 w-auto shrink-0 rounded-md border border-line object-cover shadow-sm" />
                  ))}
                </span>
              ) : (
                <span className="flex flex-col items-center gap-3 text-ink-soft">
                  {media === "video" ? <IconVideo className="size-8 text-ink" /> : <IconUpload className="size-8 text-ink" />}
                  <span className="font-semibold text-ink">{media === "video" ? "Videoyu sürükle bırak ya da seçmek için tıkla" : "Görseli sürükle bırak ya da seçmek için tıkla"}</span>
                  <span className="text-[0.85rem]">
                    {media === "video" ? "MP4, MOV veya WebM · en fazla 10 dakika · video cihazından çıkmaz" : "JPG, PNG veya WebP · en fazla 5 MB · en kısa kenar en az 200 px"}
                  </span>
                </span>
              )}
            </label>
            <input
              id={`${ids}-file`}
              key={media}
              ref={fileInput}
              type="file"
              accept={media === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"}
              className="sr-only"
              aria-label={media === "video" ? "Reklam videosu" : "Reklam görseli"}
              aria-describedby={imageError ? `${ids}-file-err` : undefined}
              aria-invalid={imageError ? true : undefined}
              onChange={(e) => (media === "video" ? void acceptVideo(e.target.files?.[0]) : void acceptFile(e.target.files?.[0]))}
            />
            {media === "image" && image ? (
              <p className="mt-3 text-[0.88rem] text-ink-soft">
                <span className="font-semibold text-ink">{image.file.name}</span> · <span className="tabular">{image.width}×{image.height}</span> px · <span className="tabular">{(image.file.size / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span> MB{" "}
                <button type="button" className="ml-2 font-semibold text-coral-deep underline-offset-4 hover:underline" onClick={() => fileInput.current?.click()}>Değiştir</button>
              </p>
            ) : null}
            {media === "video" && video && !videoBusy ? (
              <p className="mt-3 text-[0.88rem] text-ink-soft">
                <span className="font-semibold text-ink">{video.name}</span> · <span className="tabular">{video.width}×{video.height}</span> px · <span className="tabular">{video.durationSec.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span> sn · <span className="tabular">{video.frames.length}</span> kare analiz edilecek{" "}
                <button type="button" className="ml-2 font-semibold text-coral-deep underline-offset-4 hover:underline" onClick={() => fileInput.current?.click()}>Değiştir</button>
              </p>
            ) : null}
            {media === "video" ? (
              <p className="mt-3 max-w-2xl text-[0.85rem] text-muted">Video dosyası yüklenmez. Tarayıcın videodan altı kare alır (üçü ilk saniyelerden) ve sesin ne zaman başladığını ölçer; yalnızca bu kareler ve ölçümler gönderilir.{speechEnabled ? " Konuşmanın otomatik yazıya dökülmesini bir sonraki adımda açabilirsin." : " Konuşmayı bir sonraki adımda yazabilirsin."}</p>
            ) : null}
            {imageError ? <p id={`${ids}-file-err`} role="alert" className="mt-3 text-[0.9rem] font-medium text-coral-deep">{imageError}</p> : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-5 grid gap-5">
            <Field label="Ana metin" htmlFor="primaryText" error={textError} hint={<Counter value={primaryText} soft={125} max={2200} />}>
              <textarea id="primaryText" rows={6} maxLength={2200} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} aria-invalid={textError ? true : undefined} className={inputClass} placeholder="Reklamın gönderi metni" />
            </Field>
            <Field label="Başlık (isteğe bağlı)" htmlFor="headline" hint={<Counter value={headline} soft={40} max={255} />}>
              <input id="headline" maxLength={255} value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Açıklama (isteğe bağlı)" htmlFor="description" hint={<Counter value={description} soft={30} max={255} />}>
              <input id="description" maxLength={255} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </Field>
            {media === "video" ? (
              <Field
                label="Videodaki konuşma ve ekran yazıları (isteğe bağlı)"
                htmlFor="transcript"
                hint={<span>Dış ses, altyazı ve ekranda geçen vaatleri yaz; aynı kurallarla taranır. <Counter value={transcript} soft={3000} max={3000} /></span>}
              >
                <textarea id="transcript" rows={5} maxLength={3000} value={transcript} onChange={(e) => setTranscript(e.target.value)} className={inputClass} placeholder="Örn. “İlk 100 kişiye yüzde 50 indirim, hemen kaydır!”" />
              </Field>
            ) : null}
            {media === "video" && speechEnabled ? (
              <label className="flex cursor-pointer gap-3 rounded-xl border border-line-strong bg-white/60 px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-white">
                <input type="checkbox" checked={speechOptIn} onChange={(e) => setSpeechOptIn(e.target.checked)} disabled={!video?.wav} className="mt-1 accent-ink" />
                <span>
                  <span className="block text-[0.95rem] font-semibold">Konuşmayı otomatik yazıya dök</span>
                  <span className="block text-[0.85rem] text-ink-soft">
                    {video?.wav
                      ? `Videonun ilk ${Math.min(SPEECH_SECONDS, Math.round(video.durationSec))} saniyelik sesi bir kez konuşma tanıma hizmetine gönderilir. Ses saklanmaz; çıkan metin raporda gösterilir ve kurallarla taranır.`
                      : "Bu videoda okunabilir bir ses bulunamadı."}
                  </span>
                </span>
              </label>
            ) : null}
            <Field
              label="Açılış sayfası bağlantısı (isteğe bağlı)"
              htmlFor="landingUrl"
              error={landingError}
              hint="Reklamın yönlendirdiği sayfa. Bir kez okunur; fiyat, indirim ve marka tutarlılığı kontrol edilir. Sayfa içeriği saklanmaz."
            >
              <input id="landingUrl" type="url" inputMode="url" autoComplete="url" maxLength={2048} value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} aria-invalid={landingError ? true : undefined} className={inputClass} placeholder="https://ornek.com/kampanya" />
            </Field>
            <Field
              label="Açılış sayfası ekran görüntüsü (isteğe bağlı)"
              htmlFor="landingScreenshot"
              error={shotError}
              hint="Sayfa giriş istiyorsa, bot korumasındaysa ya da içeriği JavaScript ile yükleniyorsa ekran görüntüsünü ekle. Görüntü raporla birlikte saklanır."
            >
              <input
                id="landingScreenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => acceptShot(e.target.files?.[0])}
                aria-invalid={shotError ? true : undefined}
                className="block w-full text-[0.9rem] text-ink-soft file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[0.85rem] file:font-semibold file:text-paper hover:file:bg-ink-soft"
              />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-5 grid gap-6">
            <fieldset>
              <legend className="text-sm font-semibold">Platform</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {PLATFORM_IDS.map((p) => (
                  <label key={p} className="flex cursor-pointer gap-3 rounded-xl border border-line-strong bg-white/60 px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-white has-[:checked]:shadow-[0_0_0_1px_var(--ink)]">
                    <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} className="mt-1 accent-ink" />
                    <span>
                      <span className="block text-[0.95rem] font-semibold">{PLATFORM_INFO[p].label}</span>
                      <span className="block text-[0.82rem] text-muted">{PLATFORM_INFO[p].note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">Sektör</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SECTORS.map((s) => (
                  <label key={s.value} className="flex cursor-pointer gap-3 rounded-xl border border-line-strong bg-white/60 px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-white has-[:checked]:shadow-[0_0_0_1px_var(--ink)]">
                    <input type="radio" name="sector" value={s.value} checked={sector === s.value} onChange={() => setSector(s.value)} className="mt-1 accent-ink" />
                    <span>
                      <span className="block text-[0.95rem] font-semibold">{s.label}</span>
                      <span className="block text-[0.82rem] text-muted">{s.note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {brands.length ? (
              <Field label="Marka (isteğe bağlı)" htmlFor="brand">
                <select id="brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={`${inputClass} max-w-sm`}>
                  <option value="">Marka seçme</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <fieldset className="mt-5">
            <legend className="max-w-2xl text-[0.95rem] text-ink-soft">Bunlar görselden güvenilir biçimde anlaşılamaz, o yüzden senden alıyoruz. İşaretlediğin her madde ilgili kural kartını devreye sokar.</legend>
            <div className="mt-4 grid gap-3">
              {([
                ["influencerPost", "Etkileyici (influencer) iş birliği", "Reklam bir sosyal medya fenomeninin hesabından yayınlanacak ya da ücretli/ürün karşılığı iş birliği içeriyor."],
                ["aiHumanCharacter", "Yapay zekâ ile üretilmiş insan karakteri", "Görselde gerçekte var olmayan, yapay zekâ ile oluşturulmuş bir kişi yer alıyor."],
                ["aiRealPersonCopy", "Gerçek bir kişinin dijital kopyası", "Gerçek bir kişinin görüntüsü veya sesi yapay zekâ ile yeniden üretildi."],
              ] as const).map(([key, title, note]) => (
                <label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-line-strong bg-white/60 px-4 py-3 has-[:checked]:border-ink has-[:checked]:bg-white">
                  <input type="checkbox" checked={flags[key]} onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))} className="mt-1 size-4.5 accent-ink" />
                  <span>
                    <span className="block text-[0.95rem] font-semibold">{title}</span>
                    <span className="block text-[0.85rem] text-ink-soft">{note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 4 ? (
          <div className="mt-5">
            <Field label="Meta ret mesajı (isteğe bağlı)" htmlFor="rejection" hint="Varsa yapıştır; raporla birlikte TR + EN itiraz taslağı da hazırlanır. Yoksa bu adımı boş geç.">
              <textarea id="rejection" rows={5} maxLength={3000} value={rejection} onChange={(e) => setRejection(e.target.value)} className={inputClass} />
            </Field>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-[10rem_1fr]">
            {media === "image" && image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt="Reklam görseli önizlemesi" className="w-40 rounded-lg border border-line object-cover" />
            ) : null}
            {media === "video" && video?.frames[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.frames[0].url} alt="Videonun ilk karesi" className="w-40 rounded-lg border border-line object-cover" />
            ) : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[0.92rem]">
              <dt className="text-muted">Kreatif</dt>
              <dd>
                {media === "video" && video ? (
                  <>Video · <span className="tabular">{video.durationSec.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span> sn · <span className="tabular">{video.frames.length}</span> kare</>
                ) : (
                  "Görsel"
                )}
              </dd>
              <dt className="text-muted">Platform</dt><dd>{PLATFORM_INFO[platform].label}</dd>
              <dt className="text-muted">Sektör</dt><dd>{SECTORS.find((s) => s.value === sector)?.label}</dd>
              <dt className="text-muted">Başlık</dt><dd className="break-words">{headline || "—"}</dd>
              <dt className="text-muted">Ana metin</dt><dd className="line-clamp-4 break-words">{primaryText}</dd>
              <dt className="text-muted">Açıklama</dt><dd className="break-words">{description || "—"}</dd>
              <dt className="text-muted">Beyanlar</dt>
              <dd>{[flags.influencerPost && "Etkileyici", flags.aiHumanCharacter && "YZ karakter", flags.aiRealPersonCopy && "Dijital kopya"].filter(Boolean).join(", ") || "Yok"}</dd>
              {media === "video" ? (<><dt className="text-muted">Video metni</dt><dd>{transcript.trim() ? "Var, taranacak" : "Yok"}</dd></>) : null}
              {media === "video" ? (
                <>
                  <dt className="text-muted">Ses</dt>
                  <dd>
                    {!video?.audio.analyzed ? "Ölçülemedi" : video.audio.present ? `Var, ${(video.audio.firstSoundSec ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn'de başlıyor` : "Ses yok"}
                    {speechEnabled && speechOptIn && video?.wav ? " · yazıya dökülecek" : ""}
                  </dd>
                </>
              ) : null}
              <dt className="text-muted">Açılış sayfası</dt>
              <dd className="break-all">{normalizeLandingUrl(landingUrl) ?? "Yok"}{shot ? " · ekran görüntüsü eklendi" : ""}</dd>
              <dt className="text-muted">Ret mesajı</dt><dd>{rejection.trim() ? "Var, itiraz taslağı hazırlanacak" : "Yok"}</dd>
            </dl>
            <p className="text-[0.88rem] text-ink-soft sm:col-span-2">
              Bu analiz <strong className="text-ink">{creditCostFor(media)} kredi</strong> kullanır{media === "video" ? " (video analizi 2 kredidir)" : ""} (bakiye: <span className="tabular">{balance}</span>). Kredi yalnızca rapor tamamlanınca düşer.
              {balance < creditCostFor(media) ? <span className="mt-1 block font-semibold text-coral-deep">Bakiyen bu analiz için yetmiyor. <Link href="/panel/krediler" className="text-coral-deep">Kredi yükle</Link></span> : null}
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button type="button" variant="quiet" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="px-0">
            Geri
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              {step === 4 && !rejection.trim() ? "Atla" : "Devam"}
            </Button>
          ) : (
            <Button type="button" variant="accent" onClick={submit} disabled={balance < creditCostFor(media)} className="h-12 px-6">
              {phase.kind === "error" && phase.retryable ? "Tekrar dene" : "Analizi başlat"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
