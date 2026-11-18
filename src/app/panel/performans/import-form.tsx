"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Button, inputClass, selectClass } from "@/components/ui";
import { FIELD_LABEL, PERF_FIELDS, REQUIRED_FIELDS, type Mapping } from "@/lib/performance/report";
import { importReportAction, inspectReportAction, type ImportState, type InspectState } from "./actions";

const today = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export function ImportForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspectState, inspect, inspecting] = useActionState<InspectState, FormData>(inspectReportAction, { error: null });
  const [importState, doImport, importing] = useActionState<ImportState, FormData>(importReportAction, { error: null });
  const [mapping, setMapping] = useState<Mapping>({});
  const insp = inspectState.inspection;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt the server's guess once per inspected file
    if (insp) setMapping(insp.mapping);
  }, [insp]);

  useEffect(() => {
    if (importState.id) router.replace(`/panel/performans?rapor=${importState.id}${importState.note ? `&not=${encodeURIComponent(importState.note)}` : ""}#rapor`);
  }, [importState.id, importState.note, router]);

  const pick = (f: File | null) => {
    setFile(f);
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    startTransition(() => inspect(fd));
  };
  const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);

  return (
    <div className="grid gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="grid gap-1.5">
        <label htmlFor="perf-file" className="text-sm font-semibold text-ink">Reklam Yöneticisi dışa aktarımı (CSV ya da XLSX)</label>
        <input
          ref={fileRef}
          id="perf-file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="block w-full text-small file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-paper"
        />
        <p className="text-meta text-muted">En fazla 5 MB ve 20.000 satır. Dosya saklanmaz; yalnızca reklam başına toplamlar kaydedilir. Formül hücreleri hesaplanmaz, metin olarak okunur.</p>
      </div>
      {inspecting ? <p className="text-small text-ink-soft">Dosya okunuyor…</p> : null}
      {inspectState.error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{inspectState.error}</p> : null}

      {insp && file ? (
        <form
          action={(fd) => {
            fd.set("file", file);
            fd.set("mapping", JSON.stringify(mapping));
            doImport(fd);
          }}
          className="grid gap-4"
        >
          <p className="text-small text-ink-soft">
            {insp.dataRows.toLocaleString("tr-TR")} satır okundu{insp.truncated ? " (ilk 20.000 satır kullanılacak)" : ""}. Sütunları kontrol et; bulamadıklarımızı sen seç.
          </p>
          {missing.length ? <p className="rounded-xl bg-amber-tint px-4 py-3 text-small text-ink">Eşleşmeyen zorunlu sütun: {missing.map((f) => FIELD_LABEL[f]).join(", ")}. Aşağıdan dosyadaki karşılığını seç.</p> : null}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Sütun eşleştirme</legend>
            {PERF_FIELDS.map((f) => (
              <div key={f} className="grid gap-1">
                <label htmlFor={`map-${f}`} className="text-small font-semibold text-ink">
                  {FIELD_LABEL[f]}
                  {REQUIRED_FIELDS.includes(f) ? <span className="text-coral-deep"> (zorunlu)</span> : null}
                </label>
                <select
                  id={`map-${f}`}
                  value={mapping[f] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  className={selectClass}
                >
                  <option value="">Dosyada yok</option>
                  {insp.headers.map((h, i) => <option key={i} value={i}>{h || `${i + 1}. sütun`}</option>)}
                </select>
              </div>
            ))}
          </fieldset>
          <div className="grid gap-1.5">
            <label htmlFor="perf-label" className="text-sm font-semibold text-ink">Rapor adı</label>
            <input id="perf-label" name="label" maxLength={120} defaultValue={`Reklam Yöneticisi · ${today.format(new Date())}`} className={inputClass} />
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-small text-ink">
            <input type="checkbox" name="share" className="mt-0.5 size-5 shrink-0 accent-ink" />
            <span>
              <span className="block font-semibold">Anonim toplamlarla skor ağırlıklarının iyileştirilmesine katkı ver (isteğe bağlı)</span>
              <span className="block text-meta text-muted">Varsayılan kapalı. Açarsan yalnızca risk düzeyi ve tıklama, dönüşüm oranları gibi toplamlar, reklam adı ve hesap bilgisi olmadan kullanılabilir. İstediğin zaman kapatabilirsin.</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="accent" disabled={importing || missing.length > 0}>{importing ? "İçe aktarılıyor…" : "Raporu içe aktar"}</Button>
            <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="min-h-11 rounded-xl px-3 text-small font-semibold text-ink-soft hover:text-ink">Vazgeç</button>
          </div>
          {importState.error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{importState.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
