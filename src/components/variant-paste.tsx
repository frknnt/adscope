"use client";

import { useActionState, useEffect, useState } from "react";
import { RiskBadge } from "@/components/panel-ui";
import { LevelPill } from "@/components/risk";
import { Button, DataTable, Field, inputClass, selectClass } from "@/components/ui";
import { PLATFORM_IDS, PLATFORM_INFO, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { parseVariantLines, safestVariants, type VariantRow } from "@/lib/variants/paste";

export type VariantPasteState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; platform: Platform; rows: VariantRow[] };

const NOTE = "Risk değerlendirmesidir, hukuki görüş değildir. Platformun reklamı onaylayacağını garanti etmez.";

/**
 * Paste the variants a platform's own AI tool wrote, one per line, and see which ones carry risky
 * wording for Turkish ad rules. Used in the panel (20 lines, optional brand) and on the public page (5 lines).
 */
export function VariantPaste({
  action,
  max,
  defaultSector = "genel",
  brands,
  publicMode = false,
  readHash = false,
}: {
  action: (prev: VariantPasteState, form: FormData) => Promise<VariantPasteState>;
  max: number;
  defaultSector?: string;
  brands?: { id: string; name: string }[];
  publicMode?: boolean;
  readHash?: boolean;
}) {
  const [state, run, pending] = useActionState(action, { status: "idle" });
  const [texts, setTexts] = useState("");
  const [brandId, setBrandId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const count = parseVariantLines(texts).length;
  const id = publicMode ? "qv" : "pv";

  // The browser extension sends selected text in the URL fragment, which never reaches the server.
  useEffect(() => {
    if (!readHash) return;
    const h = new URLSearchParams(window.location.hash.slice(1));
    const t = h.get("metin");
    if (t) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTexts(t.slice(0, max * 620));
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [readHash, max]);

  async function copySafest() {
    if (state.status !== "done") return;
    const lines = safestVariants(state.rows, 3);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(`En güvenli ${lines.length} varyant panoya kopyalandı.`);
    } catch {
      setCopied("Kopyalanamadı. Metinleri tablodan seçip kopyalayabilirsin.");
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:items-start">
      <form action={run} onSubmit={() => setCopied(null)} className="grid gap-5 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
        <div className={`grid gap-4 ${publicMode ? "sm:grid-cols-2 xl:grid-cols-1" : "sm:grid-cols-3 xl:grid-cols-1"}`}>
          <Field label="Varyantları üreten platform" htmlFor={`${id}-platform`}>
            <select id={`${id}-platform`} name="platform" defaultValue="meta" className={selectClass}>
              {PLATFORM_IDS.map((p) => <option key={p} value={p}>{PLATFORM_INFO[p].label}</option>)}
            </select>
          </Field>
          {brands ? (
            <Field label="Marka (isteğe bağlı)" htmlFor={`${id}-brand`} hint="Seçilirse markanın sektörü ve yasaklı kelimeleri kullanılır.">
              <select id={`${id}-brand`} name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectClass}>
                <option value="">Marka seçme</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Faaliyet alanı" htmlFor={`${id}-sector`} hint="Sektör paketi ilgili kural kartlarını ekler.">
            <select id={`${id}-sector`} name="sector" defaultValue={defaultSector} disabled={Boolean(brandId)} className={selectClass}>
              {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Platformun ürettiği varyantlar" htmlFor={`${id}-texts`} hint={`Her satır bir varyant. En fazla ${max}. Şu an: ${count}`}>
          <textarea
            id={`${id}-texts`}
            name="texts"
            value={texts}
            onChange={(e) => setTexts(e.target.value)}
            rows={publicMode ? 6 : 10}
            required
            className={inputClass}
            placeholder={"Yazın en hafif desteği burada\n7 günde fark gör, garantili sonuç\nCildine doğal bakım"}
          />
        </Field>
        {publicMode ? (
          <div className="hidden" aria-hidden>
            <label htmlFor={`${id}-website`}>Web sitesi</label>
            <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="accent" disabled={pending}>{pending ? "Kontrol ediliyor…" : count ? `${count} varyantı kontrol et` : "Varyantları kontrol et"}</Button>
          <p className="text-meta text-muted">Kredi harcamaz, yapay zekâ kullanmaz. Metinler kaydedilmez.</p>
        </div>
      </form>

      <div aria-live="polite" className="min-w-0">
        {state.status === "idle" ? (
          <div className="hidden rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center xl:block">
            <p className="font-display text-xl font-semibold">Sonuçlar burada listelenir.</p>
            <p className="mt-2 text-ink-soft">Her varyantın riski, en kritik bulgusu ve güvenli sürümü tek tabloda.</p>
          </div>
        ) : null}
        {state.status === "error" ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 font-medium text-coral-deep">{state.message}</p> : null}
        {state.status === "done" ? (
          <section aria-labelledby={`${id}-sonuc`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${id}-sonuc`} className="font-display text-2xl font-semibold">
                {state.rows.length} varyant · {state.rows.filter((r) => r.red).length} kırmızı, {state.rows.filter((r) => !r.red && r.yellow).length} sarı bayraklı
              </h2>
              <button type="button" onClick={() => void copySafest()} className="min-h-11 rounded-full border border-line-strong px-4 text-small font-semibold hover:bg-paper-2">
                En güvenli 3&apos;ü kopyala
              </button>
            </div>
            {copied ? <p role="status" className="mt-2 text-small text-green">{copied}</p> : null}
            <DataTable label="Varyant sonuçları" className="mt-4">
              <table className="w-full min-w-[40rem] text-left text-small">
                <thead className="border-b border-line bg-paper-2 text-meta text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3">#</th>
                    <th scope="col" className="px-5 py-3">Varyant</th>
                    <th scope="col" className="px-5 py-3">Risk</th>
                    <th scope="col" className="px-5 py-3">En kritik bulgu</th>
                    <th scope="col" className="px-5 py-3">Güvenli sürüm</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((r) => (
                    <tr key={r.n} className="border-b border-line align-top last:border-0">
                      <td className="px-5 py-3 font-bold tabular">{r.n}</td>
                      <td className="px-5 py-3 text-ink">{r.text}</td>
                      <td className="px-5 py-3">
                        <span className="grid justify-items-start gap-1.5">
                          <RiskBadge level={r.platformLevel} score={r.platformScore} label={`${PLATFORM_SHORT[state.platform]} ret riski`} />
                          <span className="inline-flex items-center gap-1 text-meta text-muted">Mevzuat <LevelPill level={r.legalLevel} /></span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {r.top ? (
                          <>
                            {r.top.matched ? <strong className="text-ink">“{r.top.matched}” </strong> : null}
                            {r.top.title}
                            {r.top.verified ? null : <span className="block text-meta text-muted">Kural kartı doğrulanmadı; bilgi amaçlı.</span>}
                          </>
                        ) : (
                          "Eşleşen kural yok"
                        )}
                      </td>
                      <td className="px-5 py-3">{r.red || r.yellow ? r.safeText : <span className="text-muted">Değişiklik gerekmedi</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
            <p className="mt-4 text-meta text-muted">{NOTE} AdScope reklam platformlarıyla bağlantılı değildir; platform adları yalnızca varyantların kaynağını belirtmek için kullanılır.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
