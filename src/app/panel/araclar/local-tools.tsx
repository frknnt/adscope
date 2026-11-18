"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass, selectClass } from "@/components/ui";
import { ASPECTS, cropRect, fitRect, markRect, MARK_POSITIONS, MAX_OUTPUT, MIN_OUTPUT, outputSize, type AspectId, type MarkPosition } from "@/lib/image/local";
import { UploadField } from "./upload-field";

type Output = { url: string; name: string; w: number; h: number };

async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  await img.decode();
  return img;
}

function toBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), type, 0.92));
}

function useOutput() {
  const [out, setOut] = useState<Output | null>(null);
  useEffect(() => () => (out ? URL.revokeObjectURL(out.url) : undefined), [out]);
  return [out, setOut] as const;
}

function Result({ out }: { out: Output }) {
  return (
    <section aria-labelledby="yerel-sonuc" className="grid gap-3">
      <h3 id="yerel-sonuc" className="text-lg font-bold">Sonuç</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={out.url} alt={`Hazırlanan görsel, ${out.w}×${out.h}`} className="max-h-[60dvh] w-full rounded-2xl border border-line bg-paper-2 object-contain" />
      <a href={out.url} download={out.name} className={`${buttonClass("primary")} w-full sm:w-auto`}>
        İndir ({out.w}×{out.h})
      </a>
    </section>
  );
}

function Choice<T extends string>({ legend, name, options, value, onChange, cols = 2 }: { legend: string; name: string; options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void; cols?: 2 | 3 }) {
  return (
    <fieldset>
      <legend className="text-small font-semibold text-ink">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
        {options.map((o) => (
          <label key={o.id} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-small font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="accent-ink" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Free resize and crop, done entirely in the browser; the photo never leaves the device. */
export function ResizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aspect, setAspect] = useState<AspectId>("kare");
  const [mode, setMode] = useState<"kirp" | "sigdir">("kirp");
  // Kept as text so the field can be cleared and retyped; the number is clamped when the image is made.
  const [widthText, setWidthText] = useState("1080");
  const width = Number(widthText) || 1080;
  const [bg, setBg] = useState("#ffffff");
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [out, setOut] = useOutput();

  async function run() {
    if (!file) return setError("Önce bir fotoğraf seç.");
    try {
      const img = await loadImage(file);
      const ratio = ASPECTS.find((a) => a.id === aspect)!.ratio;
      const { w, h } = outputSize(img.naturalWidth, img.naturalHeight, ratio, width);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d")!;
      g.imageSmoothingQuality = "high";
      if (mode === "kirp" || !ratio) {
        const c = cropRect(img.naturalWidth, img.naturalHeight, ratio);
        g.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, w, h);
      } else {
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
        const r = fitRect(img.naturalWidth, img.naturalHeight, w, h);
        g.drawImage(img, r.x, r.y, r.w, r.h);
      }
      if (format === "jpeg" && mode === "kirp") {
        // JPEG has no transparency: paint transparent pixels white.
        g.globalCompositeOperation = "destination-over";
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, w, h);
      }
      const blob = await toBlob(canvas, format === "png" ? "image/png" : "image/jpeg");
      setError(null);
      setOut({ url: URL.createObjectURL(blob), name: `adscope-${w}x${h}.${format === "png" ? "png" : "jpg"}`, w, h });
    } catch {
      setError("Görsel işlenemedi. Başka bir dosyayla dene.");
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      <form
        className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <UploadField id="yukle-boyut" label="Fotoğraf seç" file={file} onFile={(f, err) => (setFile(f), setError(err), setOut(null))} hint="JPG, PNG ya da WebP. Fotoğraf cihazından çıkmaz." />
        <Choice legend="Oran" name="oran" options={ASPECTS} value={aspect} onChange={setAspect} cols={3} />
        <Choice legend="Oran farklıysa" name="kip" options={[{ id: "kirp", label: "Ortadan kırp" }, { id: "sigdir", label: "Sığdır, kenarı doldur" }] as const} value={mode} onChange={setMode} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="boyut-genislik" className="text-sm font-semibold text-ink">Genişlik (piksel)</label>
            <input id="boyut-genislik" type="text" inputMode="numeric" autoComplete="off" value={widthText} onChange={(e) => setWidthText(e.target.value.replace(/\D/g, "").slice(0, 5))} className={inputClass} />
            <p className="text-meta text-muted">{MIN_OUTPUT}–{MAX_OUTPUT} piksel; aralık dışındaki değer en yakın sınıra çekilir.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="boyut-bicim" className="text-sm font-semibold text-ink">Biçim</label>
            <select id="boyut-bicim" value={format} onChange={(e) => setFormat(e.target.value as "png" | "jpeg")} className={selectClass}>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </div>
        </div>
        {mode === "sigdir" ? (
          <div className="flex items-center gap-3">
            <input id="boyut-zemin" type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line-strong bg-card" />
            <label htmlFor="boyut-zemin" className="text-sm font-semibold text-ink">Kenar rengi</label>
          </div>
        ) : null}
        <button type="submit" disabled={!file} className={`${buttonClass("accent")} w-full sm:w-auto`}>Görseli hazırla · ücretsiz</button>
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{error}</p> : null}
      </form>
      {out ? <Result out={out} /> : null}
    </div>
  );
}

/** Free text or logo watermark, drawn in the browser. */
export function WatermarkTool({ brands }: { brands: { id: string; name: string }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"metin" | "logo">(brands.length ? "logo" : "metin");
  const [text, setText] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [pos, setPos] = useState<MarkPosition>("sag-alt");
  const [scale, setScale] = useState(20);
  const [opacity, setOpacity] = useState(80);
  const [out, setOut] = useOutput();

  async function run() {
    if (!file) return setError("Önce bir fotoğraf seç.");
    try {
      const img = await loadImage(file);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d")!;
      g.drawImage(img, 0, 0);
      g.globalAlpha = opacity / 100;
      if (kind === "metin") {
        const label = text.trim();
        if (!label) return setError("Filigran metnini yaz.");
        const probe = 100;
        g.font = `800 ${probe}px Manrope, system-ui, sans-serif`;
        const tw = g.measureText(label).width;
        const r = markRect(w, h, tw, probe * 1.2, pos, scale / 100);
        const size = (r.w / tw) * probe;
        g.font = `800 ${size}px Manrope, system-ui, sans-serif`;
        g.textBaseline = "middle";
        g.lineWidth = Math.max(1, size * 0.08);
        g.strokeStyle = "rgba(11,27,63,0.55)";
        g.fillStyle = "#ffffff";
        g.strokeText(label, r.x, r.y + r.h / 2);
        g.fillText(label, r.x, r.y + r.h / 2);
      } else {
        const source = logoFile ?? (brandId ? `/api/brands/${brandId}/logo` : null);
        if (!source) return setError("Bir marka logosu seç ya da logo yükle.");
        const logo = await loadImage(source);
        const r = markRect(w, h, logo.naturalWidth, logo.naturalHeight, pos, scale / 100);
        g.drawImage(logo, r.x, r.y, r.w, r.h);
      }
      g.globalAlpha = 1;
      const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      const blob = await toBlob(canvas, type);
      setError(null);
      setOut({ url: URL.createObjectURL(blob), name: `adscope-filigranli.${type === "image/png" ? "png" : "jpg"}`, w, h });
    } catch {
      setError("Görsel işlenemedi. Başka bir dosyayla dene.");
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      <form
        className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <UploadField id="yukle-filigran" label="Fotoğraf seç" file={file} onFile={(f, err) => (setFile(f), setError(err), setOut(null))} hint="JPG, PNG ya da WebP. Fotoğraf cihazından çıkmaz." />
        <Choice legend="Filigran" name="tur" options={[{ id: "logo", label: "Logo" }, { id: "metin", label: "Metin" }] as const} value={kind} onChange={setKind} />
        {kind === "metin" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filigran-metin" className="text-sm font-semibold text-ink">Filigran metni</label>
            <input id="filigran-metin" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} className={inputClass} placeholder="ör. @markan" />
          </div>
        ) : (
          <div className="grid gap-3">
            {brands.length ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filigran-marka" className="text-sm font-semibold text-ink">Marka logosu</label>
                <select id="filigran-marka" value={brandId} onChange={(e) => (setBrandId(e.target.value), setLogoFile(null))} className={selectClass}>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  <option value="">Yüklediğim logo</option>
                </select>
              </div>
            ) : null}
            {!brands.length || !brandId ? <UploadField id="yukle-logo" label="Logo seç" file={logoFile} onFile={(f, err) => (setLogoFile(f), setError(err))} hint="Saydam PNG en iyi sonucu verir." /> : null}
          </div>
        )}
        <Choice legend="Konum" name="konum" options={MARK_POSITIONS} value={pos} onChange={setPos} cols={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filigran-boyut" className="text-sm font-semibold text-ink">Genişlik: %{scale}</label>
            <input id="filigran-boyut" type="range" min={5} max={60} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="h-11 accent-ink" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filigran-saydamlik" className="text-sm font-semibold text-ink">Görünürlük: %{opacity}</label>
            <input id="filigran-saydamlik" type="range" min={10} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="h-11 accent-ink" />
          </div>
        </div>
        <button type="submit" disabled={!file} className={`${buttonClass("accent")} w-full sm:w-auto`}>Filigranı ekle · ücretsiz</button>
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{error}</p> : null}
      </form>
      {out ? <Result out={out} /> : null}
    </div>
  );
}
