"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass, selectClass } from "@/components/ui";
import { UploadField } from "./upload-field";

type Op = "remove_background" | "upscale" | "product_scene";
type Result = { name: string; href: string };

const ACTION: Record<Op, { button: string; busy: string }> = {
  remove_background: { button: "Arka planı kaldır", busy: "Arka plan kaldırılıyor…" },
  upscale: { button: "Büyüt", busy: "Büyütülüyor…" },
  product_scene: { button: "4 sahne üret", busy: "Sahneler üretiliyor…" },
};

export function ProviderTool(props: { op: Op; cost: number; balance: number; providerName: string; scenes?: { id: string; label: string }[]; sizes?: { id: string; label: string }[]; maxSide?: number }) {
  const { op, cost, balance } = props;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [charged, setCharged] = useState<number | null>(null);
  // A new id for every new input, so a double tap on the same input is not charged twice.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const fresh = () => setRequestId(crypto.randomUUID());
  const noCredit = balance < cost;

  async function submit(form: HTMLFormElement) {
    if (!file) return setError("Önce bir fotoğraf seç.");
    setPending(true);
    setError(null);
    const data = new FormData(form);
    data.set("image", file);
    data.set("op", op);
    data.set("requestId", requestId);
    try {
      const res = await fetch("/api/images", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; files?: Result[]; charged?: number };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "İşlem tamamlanamadı. Biraz sonra yeniden dene.");
        return;
      }
      setResults(body.files ?? []);
      setCharged(body.charged ?? 0);
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantını kontrol edip yeniden dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      {op === "product_scene" ? (
        <p className="rounded-xl bg-amber-tint px-4 py-3 text-small text-ink">
          Yalnızca arka plan değişir. Ürünün rengini, etiketini, şeklini, boyutunu ya da içeriğini değiştiren bir görsel tüketiciyi yanıltabilir; bu, Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği açısından risktir. Sonuçları yayımlamadan önce ürünün gerçeğiyle karşılaştır.
        </p>
      ) : null}
      <form
        className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
        onChange={(e) => {
          if ((e.target as HTMLElement).getAttribute("type") !== "file") fresh();
        }}
      >
        <UploadField
          id={`yukle-${op}`}
          label={op === "product_scene" ? "Ürün fotoğrafı seç" : "Fotoğraf seç"}
          file={file}
          hint={op === "upscale" ? `JPG, PNG ya da WebP, en fazla 5 MB ve ${props.maxSide}×${props.maxSide} piksel.` : undefined}
          onFile={(f, err) => {
            setFile(f);
            setError(err);
            setResults([]);
            fresh();
          }}
        />
        {op === "upscale" ? (
          <fieldset>
            <legend className="text-small font-semibold text-ink">Büyütme oranı</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["2", "4"].map((f) => (
                <label key={f} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line text-base font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                  <input type="radio" name="factor" value={f} defaultChecked={f === "2"} className="accent-ink" />
                  {f}×
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {op === "product_scene" ? (
          <>
            <fieldset>
              <legend className="text-small font-semibold text-ink">Sahne</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {props.scenes!.map((s, i) => (
                  <label key={s.id} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-small font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                    <input type="radio" name="scene" value={s.id} defaultChecked={i === 0} className="accent-ink" />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sahne-detay" className="text-sm font-semibold text-ink">Kısa sahne açıklaması (isteğe bağlı)</label>
              <input id="sahne-detay" name="detail" maxLength={120} className={inputClass} placeholder="ör. yanında taze limon dilimleri" />
              <p className="text-meta text-muted">Yalnızca arka planı tarif et. Kişi adı, telefon ya da adres yazma; bunlar gönderilmeden silinir.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sahne-boyut" className="text-sm font-semibold text-ink">Boyut</label>
              <select id="sahne-boyut" name="size" defaultValue="kare" className={selectClass}>
                {props.sizes!.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </>
        ) : null}
        <p className="text-meta text-muted">
          Fotoğraf, konum gibi dosya bilgileri silinerek {props.providerName} sunucularına (ABD) gönderilir; sağlayıcı API görsellerini saklamadığını belirtir. Fotoğrafta kimseyi tanıtan bilgi olmasın.
        </p>
        <button type="submit" disabled={pending || noCredit || !file} className={`${buttonClass("accent")} w-full sm:w-auto`}>
          {pending ? ACTION[op].busy : `${ACTION[op].button} · ${cost} kredi`}
        </button>
        {noCredit ? (
          <p className="text-small text-coral-deep">
            Bu işlem {cost} kredi; bakiyen {balance}. <Link href="/panel/krediler">Krediler</Link> sayfasından paket alabilirsin.
          </p>
        ) : (
          <p className="text-meta text-muted">Kredi yalnızca sonuçların tamamı hazır olunca düşer.</p>
        )}
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{error}</p> : null}
      </form>

      {results.length ? (
        <section aria-labelledby={`sonuc-${op}`}>
          <h3 id={`sonuc-${op}`} className="text-lg font-bold">Sonuçlar</h3>
          <p className="text-small text-muted">{charged ? `${charged} kredi düştü.` : "Bu istek daha önce işlenmişti; kredi düşmedi."} Dosyalar 90 gün saklanır.</p>
          <ul className={`mt-3 grid gap-4 ${results.length > 1 ? "grid-cols-2" : ""}`}>
            {results.map((r, i) => (
              <li key={r.href} className="overflow-hidden rounded-2xl border border-line bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.href} alt={`Sonuç ${i + 1}`} className="aspect-square w-full bg-[repeating-conic-gradient(var(--color-paper-2)_0_25%,var(--color-card)_0_50%)] bg-[length:24px_24px] object-contain" />
                <a href={r.href} download={r.name} className="flex min-h-11 items-center justify-center border-t border-line text-small font-semibold">
                  İndir<span className="sr-only">: sonuç {i + 1}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
