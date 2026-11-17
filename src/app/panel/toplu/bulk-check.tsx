"use client";

import { useActionState, useState } from "react";
import { LevelPill } from "@/components/risk";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { toCsv } from "@/lib/export/csv";
import { PLATFORM_IDS, PLATFORM_INFO, PLATFORM_SHORT } from "@/lib/platforms";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { bulkCheckAction, type BulkState } from "./actions";
import { CopyButton } from "../forms";

const initial: BulkState = { status: "idle" };
const DISCLAIMER = "Risk değerlendirmesidir, hukuki görüş değildir. Reklamın onaylanacağını garanti etmez.";

export function BulkCheck({ brands, defaultSector }: { brands: { id: string; name: string }[]; defaultSector: string }) {
  const [state, action, pending] = useActionState(bulkCheckAction, initial);
  const [v, setV] = useState({ platform: "meta", sector: defaultSector, brandId: "", texts: "" });
  const bind = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value })) });
  const count = v.texts.split(/\n\s*(?:-{3,}\s*)?\n/).map((t) => t.trim()).filter((t) => t.length >= 10).length;

  function download() {
    if (state.status !== "done") return;
    const rows = [
      ["Sıra", "Reklam metni", `${PLATFORM_SHORT[state.platform]} ret riski`, "Mevzuat riski", "Kırmızı", "Sarı", "Bilgi", "Öne çıkan bulgular", "Güvenli metin", "Not"],
      ...state.rows.map((r) => [r.n, r.text, r.platformScore, r.legalLevel, r.red, r.yellow, r.info, r.top.map((t) => (t.matched ? `"${t.matched}": ${t.title}` : t.title)).join(" | "), r.safeText, DISCLAIMER]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adscope-toplu-kontrol-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-8">
      <form action={action} className="grid gap-5 rounded-2xl border border-line bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Platform" htmlFor="b-platform">
            <select id="b-platform" name="platform" {...bind("platform")} className={selectClass}>
              {PLATFORM_IDS.map((p) => <option key={p} value={p}>{PLATFORM_INFO[p].label}</option>)}
            </select>
          </Field>
          <Field label="Marka (isteğe bağlı)" htmlFor="b-brand" hint="Seçilirse markanın sektörü ve yasaklı kelimeleri kullanılır.">
            <select id="b-brand" name="brandId" {...bind("brandId")} className={selectClass}>
              <option value="">Marka seçme</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Sektör" htmlFor="b-sector">
            <select id="b-sector" name="sector" {...bind("sector")} disabled={Boolean(v.brandId)} className={selectClass}>
              {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Reklam metinleri" htmlFor="b-texts" hint={`Her reklamı boş bir satırla (veya --- satırıyla) ayır. En fazla 20 reklam. Şu an: ${count}`}>
          <textarea id="b-texts" name="texts" {...bind("texts")} rows={12} required className={inputClass} placeholder={"Yazın en hafif desteği! 7 günde fark gör.\n\nSon gün %50 indirim, kaçırma.\n\nCildine doğal bakım, dermatolog önerisi."} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="accent" disabled={pending}>{pending ? "Kontrol ediliyor…" : `${count || ""} reklamı kontrol et`.trim()}</Button>
          <p className="text-meta text-muted">Kredi harcamaz. Yalnızca metin kontrol edilir; metinler kaydedilmez.</p>
        </div>
      </form>

      <div aria-live="polite">
        {state.status === "error" ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 font-medium text-coral-deep">{state.message}</p> : null}
        {state.status === "done" ? (
          <section aria-labelledby="toplu-sonuc">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="toplu-sonuc" className="font-display text-2xl font-semibold">
                {state.rows.length} reklam · {state.rows.filter((r) => r.red).length} kırmızı bayraklı
              </h2>
              <button type="button" onClick={download} className="rounded-full border border-line-strong px-4 py-2 text-small font-semibold hover:bg-paper-2">Tabloyu indir (CSV)</button>
            </div>
            <ol className="mt-4 grid gap-3">
              {[...state.rows].sort((a, b) => b.red - a.red || b.yellow - a.yellow || a.n - b.n).map((r) => (
                <li key={r.n} className={`rounded-2xl border bg-card p-4 ${r.red ? "border-coral/45" : r.yellow ? "border-caution/60" : "border-line"}`}>
                  <div className="flex flex-wrap items-center gap-2 text-meta">
                    <span className="font-bold tabular">#{r.n}</span>
                    <span className="text-muted">{PLATFORM_SHORT[state.platform]} ret riski</span>
                    <span className="font-semibold tabular">{r.platformScore}</span>
                    <LevelPill level={r.platformLevel} />
                    <span className="ml-2 text-muted">Mevzuat</span>
                    <LevelPill level={r.legalLevel} />
                    <span className="ml-auto text-muted tabular">{r.red} kırmızı · {r.yellow} sarı · {r.info} bilgi</span>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-body">{r.text}</p>
                  {r.top.length ? (
                    <ul className="mt-2 grid gap-1 text-small text-ink-soft">
                      {r.top.map((t, i) => <li key={i}>{t.matched ? <strong className="text-ink">“{t.matched}”</strong> : null} {t.title}{t.ruleId ? <span className="text-muted"> · {t.ruleId}</span> : null}</li>)}
                    </ul>
                  ) : <p className="mt-2 text-small text-muted">Kural kartlarıyla eşleşen ifade yok.</p>}
                  {r.red || r.yellow ? (
                    <details className="mt-3 rounded-xl bg-paper px-3 py-2 text-small">
                      <summary className="cursor-pointer font-semibold">Güvenli metin önerisi</summary>
                      <p className="mt-2">{r.safeText}</p>
                      <div className="mt-2"><CopyButton text={r.safeText} /></div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-meta text-muted">{DISCLAIMER} Görsel, video ve açılış sayfası kontrolü için tek tek analiz başlat.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
