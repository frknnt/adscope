"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { UploadField } from "./upload-field";

type Op = "ai_image" | "ai_video";
type Result = { name: string; href: string; mime: string };

const COPY: Record<Op, { upload: string; uploadHint: string; placeholder: string; busy: string }> = {
  ai_image: {
    upload: "Ürün fotoğrafı ekle (isteğe bağlı)",
    uploadHint: "Eklersen ürün olduğu gibi korunur, sahne çevresine kurulur. JPG, PNG ya da WebP, en fazla 5 MB.",
    placeholder: "ör. Mermer tezgâhta sabah ışığında duran cam şişe, yanında taze nane yaprakları, sade ve ferah",
    busy: "Görseller üretiliyor, yarım dakika kadar sürebilir…",
  },
  ai_video: {
    upload: "Başlangıç görseli ekle (isteğe bağlı)",
    uploadHint: "Video bu görselden başlar; ürün olduğu gibi korunur. JPG, PNG ya da WebP, en fazla 5 MB.",
    placeholder: "ör. Kamera ürüne yavaşça yaklaşıyor, arkada bulanık bir kafe, sıcak gün ışığı",
    busy: "Video üretiliyor. Bu birkaç dakika sürebilir; sayfayı kapatma.",
  },
};

export function GenaiTool(props: { op: Op; perResult: number; maxResults: number; balance: number; aspects: { id: string; label: string }[] }) {
  const { op, perResult, balance } = props;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(op === "ai_image" ? Math.min(2, props.maxResults) : 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const fresh = () => setRequestId(crypto.randomUUID());
  const cost = perResult * count;
  const noCredit = balance < cost;

  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [pending]);

  async function submit(form: HTMLFormElement) {
    setPending(true);
    setElapsed(0);
    setError(null);
    const data = new FormData(form);
    if (file) data.set("image", file);
    else data.delete("image");
    data.set("op", op);
    data.set("requestId", requestId);
    if (op === "ai_image") data.set("count", String(count));
    try {
      const res = await fetch("/api/genai", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; files?: Result[]; charged?: number; partial?: boolean };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "İşlem tamamlanamadı. Biraz sonra yeniden dene; kredin düşmedi.");
        return;
      }
      setResults(body.files ?? []);
      const charged = body.charged ?? 0;
      setNote(
        charged
          ? `${charged} kredi düştü.${body.partial ? " İstenen sonuçların bir kısmı üretilemedi; yalnızca gelenler için kredi düştü." : ""}`
          : "Bu istek daha önce işlenmişti; kredi düşmedi.",
      );
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantını kontrol edip yeniden dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 grid gap-6">
      <p className="rounded-xl bg-amber-tint px-4 py-3 text-small text-ink">
        Üretilen {op === "ai_video" ? "video" : "görsel"} gerçek bir çekim değildir. Ürününün gerçeğinden farklı görünen (rengi, etiketi, içeriği, sonucu) bir kreatif tüketiciyi yanıltabilir. Yayından önce ürünle karşılaştır, reklam metnini Yeni analiz ile kontrol et ve gerçekçi insan içeriyorsa platformun yapay zekâ etiketini kullan.
      </p>
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`aciklama-${op}`} className="text-sm font-semibold text-ink">Ne görmek istiyorsun?</label>
          <textarea id={`aciklama-${op}`} name="description" required minLength={10} maxLength={600} rows={4} className={inputClass} placeholder={COPY[op].placeholder} />
          <p className="text-meta text-muted">Sahneyi, ışığı ve havayı anlat. Görsele yazı, fiyat, indirim ya da sağlık iddiası eklenmez; metni kreatif stüdyosunda ya da reklam aracında kendin ekle. Kişi adı, telefon ve adres gönderilmeden silinir.</p>
        </div>
        <UploadField
          id={`yukle-${op}`}
          label={COPY[op].upload}
          hint={COPY[op].uploadHint}
          file={file}
          onFile={(f, err) => {
            setFile(f);
            setError(err);
            fresh();
          }}
        />
        <fieldset>
          <legend className="text-small font-semibold text-ink">Oran</legend>
          <div className={`mt-2 grid gap-2 ${props.aspects.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
            {props.aspects.map((a, i) => (
              <label key={a.id} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-2 text-center text-small font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                <input type="radio" name="aspect" value={a.id} defaultChecked={i === 0} className="accent-ink" />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
        {op === "ai_image" ? (
          <fieldset>
            <legend className="text-small font-semibold text-ink">Kaç görsel?</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {Array.from({ length: props.maxResults }, (_, i) => i + 1).map((n) => (
                <label key={n} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line text-base font-semibold has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                  <input type="radio" name="countChoice" value={n} checked={count === n} onChange={() => setCount(n)} className="accent-ink" />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-meta text-muted">Video 3–10 saniye, 720p ve seslidir (yalnızca müzik ve ortam sesi istenir).</p>
        )}
        <p className="text-meta text-muted">
          Açıklama ve varsa görsel, dosya bilgileri silinerek Google Gemini API&apos;ye gönderilir; ad, e-posta ya da hesap bilgisi gönderilmez. Google, ürettiği görsellere görünmez SynthID filigranı ekler.
        </p>
        <button type="submit" disabled={pending || noCredit} className={`${buttonClass("accent")} w-full sm:w-auto`}>
          {pending ? `Üretiliyor… ${elapsed} sn` : `${op === "ai_video" ? "Video üret" : `${count} görsel üret`} · ${cost} kredi`}
        </button>
        {pending ? <p role="status" className="text-small text-ink-soft">{COPY[op].busy}</p> : null}
        {noCredit ? (
          <p className="text-small text-coral-deep">
            Bu işlem {cost} kredi; bakiyen {balance}. <Link href="/panel/krediler">Krediler</Link> sayfasından paket alabilirsin.
          </p>
        ) : (
          <p className="text-meta text-muted">Kredi yalnızca gelen sonuçlar için ve sonuç hazır olunca düşer.</p>
        )}
        {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{error}</p> : null}
      </form>

      {results.length ? (
        <section aria-labelledby={`sonuc-${op}`}>
          <h3 id={`sonuc-${op}`} className="text-lg font-bold">Sonuçlar</h3>
          <p className="text-small text-muted">{note} Dosyalar 90 gün saklanır.</p>
          <ul className={`mt-3 grid gap-4 ${results.length > 1 ? "grid-cols-2" : "max-w-sm"}`}>
            {results.map((r, i) => (
              <li key={r.href} className="overflow-hidden rounded-2xl border border-line bg-card">
                {r.mime === "video/mp4" ? (
                  <video src={r.href} controls playsInline muted className="w-full bg-ink" aria-label={`Üretilen video ${i + 1}`} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.href} alt={`Üretilen görsel ${i + 1}`} className="w-full bg-paper-2 object-contain" />
                )}
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
