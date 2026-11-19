"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveTextField } from "@/components/live-check";
import { Disclaimer, inputClass, selectClass } from "@/components/ui";
import { contrastRatio, type BrandFontId } from "@/lib/brand/kit";
import { applyToAllSizes, colorUnder, EDITOR_LIMITS, LAYER_TYPE_LABEL, layerLabel, pillPad, type EditorDoc, type EditorLayer, type LayerType } from "@/lib/creative/editor";
import { CREATIVE_SIZE_IDS, CREATIVE_SIZES, STORY_UNSAFE, type CreativeSizeId } from "@/lib/creative/sizes";

type Warning = { kind: string; message: string };
type Hist = { past: EditorDoc[]; present: EditorDoc; future: EditorDoc[]; tag: string | null; version: number };
type Drag = { id: string; mode: "move" | "resize"; px: number; py: number; start: EditorLayer; k: number; tag: string };

const HISTORY = 60;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (n: number) => Math.round(n * 10) / 10;
const aspectLocked = (l: EditorLayer) => l.type === "logo" || (l.type === "shape" && l.shape === "circle");
const textual = (l: EditorLayer) => l.type === "text" || l.type === "badge" || l.type === "cta";

async function post(body: Record<string, unknown>, signal?: AbortSignal) {
  const res = await fetch("/api/creative/editor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok && data.ok === true, data };
}

/** Product photos are resized in the browser (longest side 1600 px) and kept as PNG or JPEG. */
async function readImage(file: File): Promise<string | null> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) return null;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.88) : c.toDataURL("image/png");
    return url.length <= EDITOR_LIMITS.assetChars ? url : c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

function newLayer(type: LayerType, size: CreativeSizeId, doc: EditorDoc, opts: { font: BrandFontId; swatches: string[]; asset?: string }): EditorLayer {
  const { w: W, h: H } = CREATIVE_SIZES[size];
  const S = Math.min(W, H);
  const n = doc.frames[size].layers.filter((l) => l.type === type).length + 1;
  const id = `${type}-${n}-${Math.random().toString(36).slice(2, 6)}`;
  const top = size === "hikaye" ? STORY_UNSAFE.top + S * 0.05 : S * 0.08;
  const [primary, secondary] = opts.swatches;
  switch (type) {
    case "text":
      return { id, type, role: "body", x: S * 0.08, y: top, w: W - S * 0.16, h: S * 0.12, text: "Yeni metin", font: opts.font, weight: 400, size: S * 0.045, align: "left", lineHeight: 1.25 };
    case "badge":
      return { id, type, role: "tagline", x: S * 0.08, y: top, w: S * 0.34, h: S * 0.07, text: "Yeni", font: opts.font, weight: 800, size: S * 0.03, fill: secondary ?? primary };
    case "cta":
      return { id, type, role: "cta", x: S * 0.08, y: H - S * 0.2 - (size === "hikaye" ? STORY_UNSAFE.bottom : 0), w: S * 0.38, h: S * 0.1, text: "Hemen incele", font: opts.font, weight: 800, size: S * 0.036, fill: primary };
    case "logo":
      return { id, type, x: S * 0.08, y: top, w: S * 0.1, h: S * 0.1 };
    case "image":
      return { id, type, x: W * 0.5, y: H * 0.3, w: W * 0.42, h: H * 0.42, asset: opts.asset, fit: "contain" };
    case "shape":
      return { id, type, shape: "rect", x: 0, y: H * 0.8, w: W, h: H * 0.2, fill: primary };
  }
}

function ColorPicker({ id, label, value, swatches, onChange, contrastWith, large }: { id: string; label: string; value: string; swatches: string[]; onChange: (v: string) => void; contrastWith?: string; large?: boolean }) {
  const ratio = contrastWith ? contrastRatio(value, contrastWith) : null;
  const low = ratio !== null && ratio < (large ? 3 : 4.5);
  return (
    <fieldset className="grid gap-2">
      <legend className="text-small font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-pressed={value === c} aria-label={`Marka kiti rengi ${c}`} className="grid size-11 place-items-center rounded-lg border border-line-strong aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-ink">
            <span className="size-7 rounded-md border border-line" style={{ background: c }} aria-hidden />
          </button>
        ))}
        <label htmlFor={id} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-2 text-meta font-semibold">
          Serbest renk
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} className="h-8 w-10 cursor-pointer border-0 bg-transparent" />
        </label>
      </div>
      {ratio !== null ? (
        <p className={`text-meta ${low ? "text-coral-deep" : "text-muted"}`} role={low ? "status" : undefined}>
          {low ? `Kontrast düşük (${ratio.toFixed(1)}:1). Bu yazı zor okunabilir; daha koyu ya da açık bir renk seç.` : `Kontrast ${ratio.toFixed(1)}:1.`}
        </p>
      ) : null}
    </fieldset>
  );
}

function Num({ id, label, value, onChange, step = 1 }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-meta font-semibold text-ink-soft">{label}</label>
      <input id={id} type="number" inputMode="decimal" step={step} value={Math.round(value)} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)} className={inputClass} />
    </div>
  );
}

export function CreativeEditor(props: {
  initialDoc: EditorDoc;
  initialSize: CreativeSizeId;
  label: string;
  fonts: { id: BrandFontId; label: string }[];
  swatches: string[];
  hasLogo: boolean;
  brandName: string | null;
  balance: number;
  notes: string[];
}) {
  const { fonts, swatches, hasLogo, balance } = props;
  const [hist, setHist] = useState<Hist>({ past: [], present: props.initialDoc, future: [], tag: null, version: 0 });
  const doc = hist.present;
  const [size, setSize] = useState<CreativeSizeId>(props.initialSize);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ image: string; doc: EditorDoc; size: CreativeSizeId; warnings: Warning[]; notes: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [download, setDownload] = useState<{ pending: boolean; href?: string; error?: string }>({ pending: false });
  const [tplName, setTplName] = useState("");
  const [tplState, setTplState] = useState<{ pending: boolean; message?: string; error?: string }>({ pending: false });
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const ids = useRef(new Map<string, string>());
  const fileFor = useRef<HTMLInputElement>(null);
  const [fileTarget, setFileTarget] = useState<"new" | "replace" | "background">("new");

  const { w: W, h: H } = CREATIVE_SIZES[size];
  const frame = doc.frames[size];
  const layer = frame.layers.find((l) => l.id === selected) ?? null;
  const layerIndex = layer ? frame.layers.indexOf(layer) : -1;

  /** Applies a change; changes with the same tag (one drag, typing in one field) form a single undo step. */
  const update = useCallback((fn: (d: EditorDoc) => EditorDoc, tag: string | null = null) => {
    setHist((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      if (tag && tag === h.tag) return { ...h, present: next, version: h.version + 1 };
      return { past: [...h.past, h.present].slice(-HISTORY), present: next, future: [], tag, version: h.version + 1 };
    });
  }, []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], tag: null, version: h.version + 1 } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), tag: null, version: h.version + 1 } : h)), []);

  const patchLayer = useCallback(
    (id: string, patch: Partial<EditorLayer>, tag: string | null = null) =>
      update((d) => ({ ...d, frames: { ...d.frames, [size]: { ...d.frames[size], layers: d.frames[size].layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) } } }), tag),
    [size, update],
  );
  const setLayers = useCallback((fn: (ls: EditorLayer[]) => EditorLayer[]) => update((d) => ({ ...d, frames: { ...d.frames, [size]: { ...d.frames[size], layers: fn(d.frames[size].layers) } } })), [size, update]);

  // Server preview (the same drawing as the download), 250 ms after the last change.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const { ok, data } = await post({ op: "preview", size, doc }, ctrl.signal);
        if (ok) {
          setPreview({ image: String(data.image), doc, size, warnings: (data.warnings as Warning[]) ?? [], notes: (data.notes as string[]) ?? [] });
          setError(null);
        } else setError(String(data.message ?? "Önizleme hazırlanamadı."));
      } catch {
        if (!ctrl.signal.aborted) setError("Önizleme hazırlanamadı. Bağlantını kontrol edip yeniden dene.");
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [doc, size]);

  useEffect(() => {
    if (download.href) link.current?.click();
  }, [download.href]);

  const onKeyDownRoot = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, select")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    }
  };

  const onLayerKey = (e: React.KeyboardEvent, l: EditorLayer) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const step = e.shiftKey ? 40 : 5;
    if (e.altKey) {
      const w = Math.max(8, l.w + d[0] * step);
      const h = aspectLocked(l) ? w : Math.max(8, l.h + d[1] * step);
      patchLayer(l.id, { w: r1(w), h: r1(h) }, `key-size-${l.id}`);
      setStatus(`${layerLabel(l)}: ${Math.round(w)} × ${Math.round(h)} piksel.`);
    } else {
      const x = r1(l.x + d[0] * step);
      const y = r1(l.y + d[1] * step);
      patchLayer(l.id, { x, y }, `key-move-${l.id}`);
      setStatus(`${layerLabel(l)}: x ${Math.round(x)}, y ${Math.round(y)}.`);
    }
  };

  const startDrag = (e: React.PointerEvent, l: EditorLayer, mode: Drag["mode"]) => {
    if (e.button !== 0 || !canvas.current) return;
    e.stopPropagation();
    setSelected(l.id);
    const rect = canvas.current.getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id: l.id, mode, px: e.clientX, py: e.clientY, start: l, k: W / rect.width, tag: `drag-${l.id}-${e.timeStamp}` };
  };
  const moveDrag = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dx = (e.clientX - g.px) * g.k;
    const dy = (e.clientY - g.py) * g.k;
    if (g.mode === "move") patchLayer(g.id, { x: r1(g.start.x + dx), y: r1(g.start.y + dy) }, g.tag);
    else {
      const w = Math.max(8, g.start.w + dx);
      const h = aspectLocked(g.start) ? w * (g.start.h / g.start.w) : Math.max(8, g.start.h + dy);
      patchLayer(g.id, { w: r1(w), h: r1(h) }, g.tag);
    }
  };
  const endDrag = () => {
    const g = drag.current;
    drag.current = null;
    if (g) {
      const l = doc.frames[size].layers.find((x) => x.id === g.id);
      if (l) setStatus(`${layerLabel(l)} taşındı: x ${Math.round(l.x)}, y ${Math.round(l.y)}, ${Math.round(l.w)} × ${Math.round(l.h)}.`);
    }
  };

  const move = (id: string, dir: 1 | -1) =>
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const out = [...ls];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  const addLayer = (type: LayerType, asset?: string) => {
    if (frame.layers.length >= EDITOR_LIMITS.layers) {
      setStatus(`Bir boyutta en fazla ${EDITOR_LIMITS.layers} katman olabilir.`);
      return;
    }
    const l = newLayer(type, size, doc, { font: fonts[0].id, swatches, asset });
    setLayers((ls) => [...ls, l]);
    setSelected(l.id);
    setStatus(`${LAYER_TYPE_LABEL[type]} eklendi.`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const url = await readImage(file);
    if (!url) {
      setStatus("Görsel okunamadı. PNG, JPEG ya da WebP biçiminde, 8 MB'tan küçük bir dosya seç.");
      return;
    }
    const target = fileTarget;
    const assetId = target === "background" ? "zemin" : target === "replace" && layer?.asset ? layer.asset : `urun-${Object.keys(doc.assets).filter((k) => k.startsWith("urun")).length + 1}`;
    if (!(assetId in doc.assets) && Object.keys(doc.assets).length >= EDITOR_LIMITS.assets) {
      setStatus(`En fazla ${EDITOR_LIMITS.assets} görsel yüklenebilir; önce birini kaldır.`);
      return;
    }
    if (target === "background") {
      update((d) => ({ ...d, assets: { ...d.assets, [assetId]: url }, frames: Object.fromEntries(CREATIVE_SIZE_IDS.map((s) => [s, { ...d.frames[s], background: { ...d.frames[s].background, asset: assetId } }])) as EditorDoc["frames"] }));
      setStatus("Zemin görseli eklendi; dört boyutta da kullanılır.");
    } else if (target === "replace" && layer) {
      update((d) => ({ ...d, assets: { ...d.assets, [assetId]: url } }));
      if (!layer.asset) patchLayer(layer.id, { asset: assetId });
      setStatus("Ürün görseli değiştirildi.");
    } else {
      update((d) => ({ ...d, assets: { ...d.assets, [assetId]: url } }));
      addLayer("image", assetId);
    }
  };
  const pickFile = (target: typeof fileTarget) => {
    setFileTarget(target);
    fileFor.current?.click();
  };

  const requestId = (key: string) => {
    const k = `${hist.version}:${key}`;
    let id = ids.current.get(k);
    if (!id) {
      id = crypto.randomUUID();
      ids.current.set(k, id);
    }
    return id;
  };
  const runDownload = async (which: CreativeSizeId | "hepsi") => {
    setDownload({ pending: true });
    try {
      const { ok, data } = await post({ op: "export", requestId: requestId(which), size: which, label: props.label, doc });
      setDownload(ok ? { pending: false, href: String(data.href) } : { pending: false, error: String(data.message ?? "İndirme hazırlanamadı.") });
      if (ok && Number(data.charged)) setStatus("1 kredi düştü. Aynı tasarımı yeniden indirmek ücretsizdir.");
    } catch {
      setDownload({ pending: false, error: "İndirme hazırlanamadı. Biraz sonra yeniden dene; kredin düşmedi." });
    }
  };
  const saveTemplate = async () => {
    setTplState({ pending: true });
    try {
      const { ok, data } = await post({ op: "template", name: tplName, doc });
      setTplState(ok ? { pending: false, message: `"${String(data.name)}" şablonu kaydedildi. Görsel sekmesinde bu markanın şablonları arasında çıkar.` } : { pending: false, error: String(data.message ?? "Şablon kaydedilemedi.") });
    } catch {
      setTplState({ pending: false, error: "Şablon kaydedilemedi. Biraz sonra yeniden dene." });
    }
  };

  const shown = preview && preview.size === size ? preview : null;
  const ordered = useMemo(() => [...frame.layers].reverse(), [frame.layers]);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const textBg = layer && textual(layer) ? (layer.type === "text" ? colorUnder(frame, layerIndex, layer.x + layer.w / 2, layer.y + Math.min(layer.h, layer.size ?? 40) / 2) : (layer.fill ?? frame.background.color)) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-rows-[auto_1fr]" onKeyDown={onKeyDownRoot}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Boyut">
          {CREATIVE_SIZE_IDS.map((s) => (
            <button key={s} type="button" aria-pressed={s === size} onClick={() => { setSize(s); setSelected(null); }} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-card px-3 text-small font-semibold text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
              {CREATIVE_SIZES[s].label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={undo} disabled={!hist.past.length} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-card px-3 text-small font-semibold disabled:opacity-50" aria-keyshortcuts="Control+Z">Geri al</button>
          <button type="button" onClick={redo} disabled={!hist.future.length} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-card px-3 text-small font-semibold disabled:opacity-50" aria-keyshortcuts="Control+Shift+Z">Yinele</button>
          <button
            type="button"
            onClick={() => {
              update((d) => applyToAllSizes(d, size));
              setStatus(`${CREATIVE_SIZES[size].label} düzeni diğer üç boyuta orantılı taşındı.`);
            }}
            className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-small font-semibold text-paper hover:bg-navy-700"
          >
            Tüm boyutlara uygula
          </button>
          <span className="text-meta text-muted" aria-hidden>{busy ? "Önizleme güncelleniyor…" : ""}</span>
        </div>

        <div
          ref={canvas}
          className="relative mt-4 w-full overflow-hidden rounded-xl border border-line bg-paper-2 shadow-card"
          style={{ aspectRatio: `${W} / ${H}`, maxWidth: size === "hikaye" ? "26rem" : size === "dikey" ? "34rem" : size === "kare" ? "38rem" : "100%" }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={() => setSelected(null)}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.image} alt={`${props.label}, ${CREATIVE_SIZES[size].label} önizleme`} className="absolute inset-0 h-full w-full select-none" draggable={false} />
          ) : (
            <div className="skeleton absolute inset-0" aria-hidden />
          )}
          {size === "hikaye" ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-coral/70 bg-coral/5" style={{ height: pct(STORY_UNSAFE.top, H) }} aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-coral/70 bg-coral/5" style={{ height: pct(STORY_UNSAFE.bottom, H) }} aria-hidden />
            </>
          ) : null}
          {frame.layers.map((l) => {
            if (l.hidden) return null;
            const was = shown?.doc.frames[size].layers.find((x) => x.id === l.id);
            const moved = was && !was.hidden && (was.x !== l.x || was.y !== l.y) && was.w === l.w && was.h === l.h;
            const isSel = l.id === selected;
            return (
              <button
                key={l.id}
                type="button"
                aria-label={`${layerLabel(l)} katmanı`}
                aria-pressed={isSel}
                onClick={(e) => { e.stopPropagation(); setSelected(l.id); }}
                onPointerDown={(e) => startDrag(e, l, "move")}
                onKeyDown={(e) => onLayerKey(e, l)}
                data-layer={l.id}
                className={`absolute touch-none rounded-sm outline-offset-0 ${isSel ? "z-10 outline outline-2 outline-blue" : "outline outline-1 outline-transparent hover:outline-blue/60"} focus-visible:outline-2 focus-visible:outline-coral`}
                style={{
                  left: pct(l.x, W),
                  top: pct(l.y, H),
                  width: pct(l.w, W),
                  height: pct(l.h, H),
                  cursor: "move",
                  ...(moved && shown
                    ? { backgroundImage: `url(${shown.image})`, backgroundSize: `${(W / l.w) * 100}% ${(H / l.h) * 100}%`, backgroundPosition: `${(was!.x / (W - l.w || 1)) * 100}% ${(was!.y / (H - l.h || 1)) * 100}%`, opacity: 0.85 }
                    : {}),
                }}
              >
                {isSel ? <span aria-hidden onPointerDown={(e) => startDrag(e, l, "resize")} className="absolute -bottom-2 -right-2 size-5 cursor-nwse-resize rounded-sm border-2 border-paper bg-blue" /> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-meta text-muted">
          Klavye: katmana odaklan, ok tuşlarıyla 5 piksel (Shift ile 40) taşı, Alt ile boyutlandır. Ctrl+Z geri alır, Ctrl+Shift+Z yineler.
          {size === "hikaye" ? " Kesik çizgili bantlar 9:16 güvenli alanın dışıdır." : ""}
        </p>
        <p className="sr-only" aria-live="polite">{status}</p>
        {status ? <p className="mt-2 text-small text-ink-soft" aria-hidden>{status}</p> : null}
        {error ? <p role="alert" className="mt-2 text-small font-medium text-coral-deep">{error}</p> : null}

        <section aria-labelledby="ed-uyarilar" className="mt-4">
          <h2 id="ed-uyarilar" className="text-lg font-bold">Denetim</h2>
          {shown ? (
            shown.warnings.length ? (
              <ul className="mt-2 grid gap-1.5">
                {shown.warnings.map((w, i) => <li key={i} className="rounded-lg bg-amber-tint px-3 py-2 text-meta text-ink">{w.message}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-meta text-green">Bu boyutta taşma, güvenli alan ve kontrast sorunu yok.</p>
            )
          ) : (
            <p className="mt-2 text-meta text-muted">Önizleme hazırlanıyor…</p>
          )}
          {[...props.notes, ...(shown?.notes ?? [])].map((n) => <p key={n} className="mt-2 rounded-xl bg-info-tint px-4 py-3 text-small text-info">{n}</p>)}
        </section>

      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <section aria-labelledby="ed-katmanlar" className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <h2 id="ed-katmanlar" className="text-lg font-bold">Katmanlar</h2>
          <p className="text-meta text-muted">Üstteki katman önde çizilir.</p>
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {ordered.map((l) => {
              const i = frame.layers.indexOf(l);
              return (
                <li key={l.id} className={`flex items-center gap-1 rounded-lg border px-1 ${l.id === selected ? "border-blue bg-blue-tint/40" : "border-line"}`}>
                  <button type="button" onClick={() => setSelected(l.id)} aria-pressed={l.id === selected} className={`min-h-11 min-w-0 flex-1 truncate px-2 text-left text-small font-semibold ${l.hidden ? "text-muted line-through" : "text-ink"}`}>
                    {layerLabel(l)}
                    {textual(l) && l.text ? <span className="font-normal text-muted"> · {l.text.slice(0, 28)}</span> : null}
                  </button>
                  <button type="button" onClick={() => patchLayer(l.id, { hidden: !l.hidden })} aria-pressed={Boolean(l.hidden)} aria-label={`${layerLabel(l)}: gizle`} className="grid h-11 min-w-11 shrink-0 place-items-center rounded-md px-1.5 text-meta font-bold text-ink-soft hover:bg-paper-2">
                    {l.hidden ? "Göster" : "Gizle"}
                  </button>
                  <button type="button" onClick={() => move(l.id, 1)} disabled={i === frame.layers.length - 1} aria-label={`${layerLabel(l)}: öne al`} className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-paper-2 disabled:opacity-40">↑</button>
                  <button type="button" onClick={() => move(l.id, -1)} disabled={i === 0} aria-label={`${layerLabel(l)}: arkaya al`} className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-paper-2 disabled:opacity-40">↓</button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["text", "badge", "cta", "shape"] as const).map((t) => (
              <button key={t} type="button" onClick={() => addLayer(t)} className="inline-flex min-h-10 items-center rounded-lg border border-line-strong px-3 text-meta font-semibold hover:border-ink">+ {LAYER_TYPE_LABEL[t]}</button>
            ))}
            {hasLogo ? <button type="button" onClick={() => addLayer("logo")} className="inline-flex min-h-10 items-center rounded-lg border border-line-strong px-3 text-meta font-semibold hover:border-ink">+ Logo</button> : null}
            <button type="button" onClick={() => pickFile("new")} className="inline-flex min-h-10 items-center rounded-lg border border-line-strong px-3 text-meta font-semibold hover:border-ink">+ Ürün görseli</button>
          </div>
          <input ref={fileFor} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Görsel dosyası seç" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </section>

        {layer ? (
          <section aria-labelledby="ed-ozellik" className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="ed-ozellik" className="text-lg font-bold">{layerLabel(layer)}</h2>
              <button type="button" onClick={() => { setLayers((ls) => ls.filter((l) => l.id !== layer.id)); setSelected(null); }} className="inline-flex min-h-10 items-center rounded-lg px-3 text-meta font-semibold text-coral-deep hover:bg-coral-tint">Katmanı kaldır</button>
            </div>
            {textual(layer) ? (
              <div className="grid gap-1.5">
                <label htmlFor="ed-metin" className="text-small font-semibold text-ink">Metin</label>
                <LiveTextField id="ed-metin" multiline rows={3} label="Katman metni" value={layer.text ?? ""} maxLength={EDITOR_LIMITS.text} sector={doc.sector} platform={doc.platform} onChange={(v) => patchLayer(layer.id, { text: v }, `text-${layer.id}`)} />
              </div>
            ) : null}
            {textual(layer) ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor="ed-font" className="text-meta font-semibold text-ink-soft">Yazı tipi (marka kitinden)</label>
                  <select id="ed-font" value={layer.font ?? fonts[0].id} onChange={(e) => patchLayer(layer.id, { font: e.target.value as BrandFontId })} className={selectClass}>
                    {fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ed-kalinlik" className="text-meta font-semibold text-ink-soft">Kalınlık</label>
                  <select id="ed-kalinlik" value={layer.weight ?? 800} onChange={(e) => patchLayer(layer.id, { weight: Number(e.target.value) === 400 ? 400 : 800 })} className={selectClass}>
                    <option value={400}>Normal</option>
                    <option value={800}>Kalın</option>
                  </select>
                </div>
                <Num id="ed-boyut" label="Yazı boyutu (px)" value={layer.size ?? 40} onChange={(v) => patchLayer(layer.id, { size: clamp(v, 8, 400) }, `size-${layer.id}`)} />
                {layer.type === "text" ? (
                  <div className="col-span-2 flex flex-col gap-1">
                    <label htmlFor="ed-hiza" className="text-meta font-semibold text-ink-soft">Hizalama</label>
                    <select id="ed-hiza" value={layer.align ?? "left"} onChange={(e) => patchLayer(layer.id, { align: e.target.value === "center" ? "center" : "left" })} className={selectClass}>
                      <option value="left">Sola</option>
                      <option value="center">Ortaya</option>
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
            {textual(layer) ? (
              <ColorPicker id="ed-renk" label="Yazı rengi" value={layer.color ?? "#0b1b3f"} swatches={swatches} onChange={(c) => patchLayer(layer.id, { color: c })} contrastWith={textBg ?? undefined} large={(layer.size ?? 40) >= W * 0.045 || ((layer.weight ?? 800) === 800 && (layer.size ?? 40) >= W * 0.035)} />
            ) : null}
            {layer.type === "badge" || layer.type === "cta" || layer.type === "shape" ? (
              <ColorPicker id="ed-zemin" label={layer.type === "shape" ? "Şekil rengi" : "Düğme rengi"} value={layer.fill ?? "#0b1b3f"} swatches={swatches} onChange={(c) => patchLayer(layer.id, { fill: c })} />
            ) : null}
            {layer.type === "image" ? (
              <div className="grid gap-2">
                <button type="button" onClick={() => pickFile("replace")} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-3 text-small font-semibold hover:border-ink">Görseli değiştir</button>
                <label htmlFor="ed-sigdir" className="text-meta font-semibold text-ink-soft">Yerleşim</label>
                <select id="ed-sigdir" value={layer.fit ?? "contain"} onChange={(e) => patchLayer(layer.id, { fit: e.target.value === "cover" ? "cover" : "contain" })} className={selectClass}>
                  <option value="contain">Kutuya sığdır</option>
                  <option value="cover">Kutuyu doldur (kırp)</option>
                </select>
                {!layer.asset || !doc.assets[layer.asset] ? <p className="text-meta text-muted">Bu katmanın görseli yok; görsel seçmezsen boş kalır.</p> : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Num id="ed-x" label="X" value={layer.x} onChange={(v) => patchLayer(layer.id, { x: clamp(v, -2000, 4000) }, `x-${layer.id}`)} />
              <Num id="ed-y" label="Y" value={layer.y} onChange={(v) => patchLayer(layer.id, { y: clamp(v, -2000, 4000) }, `y-${layer.id}`)} />
              <Num id="ed-g" label="Genişlik" value={layer.w} onChange={(v) => patchLayer(layer.id, aspectLocked(layer) ? { w: clamp(v, 8, 4000), h: clamp(v, 8, 4000) } : { w: clamp(v, 8, 4000) }, `w-${layer.id}`)} />
              <Num id="ed-h" label="Yükseklik" value={layer.h} onChange={(v) => patchLayer(layer.id, aspectLocked(layer) ? { w: clamp(v, 8, 4000), h: clamp(v, 8, 4000) } : { h: clamp(v, 8, 4000) }, `h-${layer.id}`)} />
            </div>
            {layer.type === "badge" || layer.type === "cta" ? <p className="text-meta text-muted">Yazı düğmenin içine sığmazsa küçülür, yine sığmazsa kısaltılır (iç boşluk {Math.round(pillPad(layer))} px).</p> : null}
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong bg-card px-4 py-6 text-center text-small text-ink-soft">Düzenlemek için tuvalde ya da listede bir katman seç.</p>
        )}

        <section aria-labelledby="ed-arka" className="grid gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
          <h2 id="ed-arka" className="text-lg font-bold">Arka plan</h2>
          <ColorPicker id="ed-arka-renk" label="Arka plan rengi" value={frame.background.color} swatches={swatches} onChange={(c) => update((d) => ({ ...d, frames: { ...d.frames, [size]: { ...d.frames[size], background: { ...d.frames[size].background, color: c } } } }))} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => pickFile("background")} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-3 text-small font-semibold hover:border-ink">Zemin görseli seç</button>
            {frame.background.asset ? (
              <button type="button" onClick={() => update((d) => ({ ...d, frames: { ...d.frames, [size]: { ...d.frames[size], background: { color: d.frames[size].background.color, asset: null } } } }))} className="inline-flex min-h-11 items-center rounded-xl px-3 text-small font-semibold text-coral-deep hover:bg-coral-tint">Zemin görselini kaldır</button>
            ) : null}
          </div>
        </section>
      </div>
      {/* Download and template come after the layer panels on small screens. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start">
        <section aria-labelledby="ed-indir" className="grid gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
          <h2 id="ed-indir" className="text-lg font-bold">İndir</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={balance < 1 || download.pending} onClick={() => runDownload(size)} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-card px-4 text-small font-semibold text-ink hover:border-ink disabled:opacity-50">
              PNG indir ({CREATIVE_SIZES[size].label})
            </button>
            <button type="button" disabled={balance < 1 || download.pending} onClick={() => runDownload("hepsi")} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-card px-4 text-small font-semibold text-ink hover:border-ink disabled:opacity-50">
              Tüm boyutlar (ZIP)
            </button>
          </div>
          <p className="text-meta text-muted">
            {download.pending ? "Hazırlanıyor…" : "Her indirme 1 kredi. Tasarımı değiştirmeden aynı düğmeye yeniden basmak ücretlendirmez."}
            {balance < 1 ? <> İndirme için kredin yok; <Link href="/panel/krediler">Krediler</Link> sayfasından alabilirsin.</> : null}
          </p>
          {download.href ? (
            <a ref={link} href={download.href} download className="text-small font-semibold text-blue">Dosya hazır, indirme başlamadıysa buraya dokun</a>
          ) : null}
          {download.error ? <p role="alert" className="text-small font-medium text-coral-deep">{download.error}</p> : null}
        </section>

        <section aria-labelledby="ed-sablon" className="mt-4 grid gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
          <h2 id="ed-sablon" className="text-lg font-bold">Şablon olarak kaydet</h2>
          {doc.brandId ? (
            <>
              <p className="text-meta text-muted">Katman düzeni {props.brandName ? `"${props.brandName}"` : "bu"} markasına kaydedilir; yeni metinler şablona yerleşir. Yüklenen görseller şablona kaydedilmez, yalnızca yerleri saklanır. Marka başına en fazla {EDITOR_LIMITS.templatesPerBrand} şablon.</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label htmlFor="ed-sablon-ad" className="text-small font-semibold text-ink">Şablon adı</label>
                  <input id="ed-sablon-ad" value={tplName} maxLength={EDITOR_LIMITS.templateName} onChange={(e) => setTplName(e.target.value)} className={inputClass} placeholder="ör. Kampanya duyurusu" />
                </div>
                <button type="button" disabled={tplName.trim().length < 2 || tplState.pending} onClick={saveTemplate} className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-small font-semibold text-paper hover:bg-navy-700 disabled:opacity-50">
                  Şablonu kaydet
                </button>
              </div>
              {tplState.message ? <p role="status" className="text-small text-green">{tplState.message}</p> : null}
              {tplState.error ? <p role="alert" className="text-small font-medium text-coral-deep">{tplState.error}</p> : null}
            </>
          ) : (
            <p className="text-meta text-muted">Şablonlar bir markaya kaydedilir. Görsel sekmesinde bir marka kiti seçip düzenleyiciyi yeniden aç.</p>
          )}
        </section>
        <Disclaimer className="mt-6" />
      </div>
    </div>
  );
}
