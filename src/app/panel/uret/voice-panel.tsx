"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LiveTextField } from "@/components/live-check";
import { buttonClass } from "@/components/ui";
import { liveCheck } from "@/lib/engine/live";
import type { Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import type { ScriptScene } from "@/lib/script/generate";
import { VOICEOVER_CREDIT_COST } from "@/lib/speech/costs";
import { AI_VOICE_RULE_IDS, AI_VOICE_SCRIPT_NOTICE, MAX_VOICE_TEXT, PREVIEW_SECONDS, TTS_SPEEDS, TTS_VOICES, type TtsSpeed, type TtsVoice } from "@/lib/speech/voices";
import { previewVoiceAction, voiceoverAction } from "./voice-actions";

export type VoiceoverView = {
  id: string;
  createdAt: string;
  voice: TtsVoice;
  speed: TtsSpeed;
  scenes: { index: number; seconds: number; overrun: boolean }[];
};

const sec = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`;
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const voiceLabel = (v: TtsVoice) => TTS_VOICES.find((x) => x.id === v)?.label ?? v;

/** The AI-voice notice of a voiced script; shown above the scenes and never hidden. */
export function AiVoiceNotice() {
  return (
    <p className="rounded-xl border border-ink bg-card px-4 py-3 text-small font-medium text-ink" role="note">
      {AI_VOICE_SCRIPT_NOTICE}{" "}
      {AI_VOICE_RULE_IDS.map((id, i) => (
        <span key={id}>
          {i ? " · " : ""}
          <a href={`/kurallar#${id}`} className="font-semibold text-blue">{id}</a>
        </span>
      ))}
    </p>
  );
}

/**
 * Turkish voice-over of a script (P11.1): pick a synthetic voice and a speed, listen to a free
 * five-second preview of any line, then voice one scene or all of them for one credit. Every line
 * is checked while typing; a red finding blocks the voice-over until it is fixed.
 */
export function VoicePanel({ scriptId, scenes, sector, platform, enabled, balance, voiceovers }: { scriptId: string; scenes: ScriptScene[]; sector: Sector; platform: Platform; enabled: boolean; balance: number; voiceovers: VoiceoverView[] }) {
  const router = useRouter();
  const [voice, setVoice] = useState<TtsVoice>("Kore");
  const [speed, setSpeed] = useState<TtsSpeed>("normal");
  const [texts, setTexts] = useState<string[]>(() => scenes.map((s) => s.voiceover));
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ index: number; url: string } | null>(null);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview]);
  // A new choice is a new job: a fresh request id, so a retry of the same job is never charged twice.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- new idempotency key whenever the job changes
  useEffect(() => setRequestId(crypto.randomUUID()), [voice, speed, texts]);

  const red = useMemo(() => texts.map((t) => liveCheck(t, sector, platform).some((f) => f.severity === "red")), [texts, sector, platform]);
  const voiced = scenes.map((_, i) => i).filter((i) => texts[i]?.trim());
  const blocked = voiced.filter((i) => red[i]);
  const noCredit = balance < VOICEOVER_CREDIT_COST;

  if (!enabled) {
    return (
      <section aria-labelledby="dis-ses-baslik" className="grid gap-2 rounded-2xl border border-line bg-card p-4 shadow-card">
        <h3 id="dis-ses-baslik" className="text-lg font-bold">Türkçe dış ses</h3>
        <p className="rounded-xl bg-info-tint px-4 py-3 text-small text-info">Seslendirme bu ortamda kapalı: metinden sese hizmeti bağlı değil. Dış sesi SRT olarak indirip kendi kaydını kullanabilirsin.</p>
      </section>
    );
  }

  async function listen(i: number) {
    setError(null);
    setBusy(`preview-${i}`);
    const res = await previewVoiceAction({ scriptId, text: texts[i], voice, speed });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    const bytes = Uint8Array.from(atob(res.audio), (c) => c.charCodeAt(0));
    setPreview({ index: i, url: URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })) });
  }

  async function voiceLines(indexes: number[], key: string) {
    setError(null);
    setDone(null);
    const bad = indexes.filter((i) => red[i]);
    if (bad.length) return setError(`Önce yüksek riskli ifadeyi düzelt: ${bad.map((i) => `${i + 1}. sahne`).join(", ")}.`);
    setBusy(key);
    const res = await voiceoverAction({ requestId, scriptId, voice, speed, lines: indexes.map((i) => ({ index: i, text: texts[i] })) });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setRequestId(crypto.randomUUID());
    setDone(res.charged ? `${res.charged} kredi düştü. Ses dosyaları 90 gün saklanır.` : "Bu seslendirme daha önce yapılmıştı; yeniden kredi düşmedi.");
    router.refresh();
  }

  return (
    <section aria-labelledby="dis-ses-baslik" className="grid gap-4 rounded-2xl border border-line bg-card p-4 shadow-card">
      <div>
        <h3 id="dis-ses-baslik" className="text-lg font-bold">Türkçe dış ses</h3>
        <p className="mt-1 text-small text-ink-soft">
          Sesler hazır sentetik seslerdir; ünlü ya da gerçek bir kişinin sesini taklit etme seçeneği yoktur. Sağlayıcıya yalnızca okunacak satır gider; adın ve e-postan gitmez.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-small font-semibold text-ink">Ses</legend>
          <div className="mt-2 grid gap-1.5">
            {TTS_VOICES.map((v) => (
              <label key={v.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-small has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                <input type="radio" name="tts-voice" value={v.id} checked={voice === v.id} onChange={() => setVoice(v.id)} className="size-4 accent-ink" />
                {v.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-small font-semibold text-ink">Hız</legend>
          <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-paper-2 p-1">
            {TTS_SPEEDS.map((s) => (
              <label key={s.id} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-small font-semibold has-[:focus-visible]:outline-2 ${speed === s.id ? "bg-card text-ink shadow-card" : "text-ink-soft"}`}>
                <input type="radio" name="tts-speed" value={s.id} checked={speed === s.id} onChange={() => setSpeed(s.id)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-meta text-muted">Ön dinleme ücretsizdir ve {PREVIEW_SECONDS} saniyedir. Seslendirme {VOICEOVER_CREDIT_COST} kredi: tek sahne ya da tüm sahneler; yalnızca bütün satırlar başarıyla okunursa düşer.</p>
        </fieldset>
      </div>

      <ol className="grid gap-3" aria-label="Dış ses satırları">
        {scenes.map((s, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={`dis-ses-${i}`} className="text-small font-semibold">
                {i + 1}. sahne dış sesi <span className="tabular font-normal text-muted">{sec(s.end - s.start)}</span>
              </label>
              <span className="flex flex-wrap gap-2">
                <button type="button" disabled={!texts[i]?.trim() || Boolean(busy) || red[i]} onClick={() => void listen(i)} className={buttonClass("ghost", "min-h-10 px-3 text-meta")}>
                  {busy === `preview-${i}` ? "Hazırlanıyor…" : `${PREVIEW_SECONDS} sn ön dinle`}<span className="sr-only">: {i + 1}. sahne</span>
                </button>
                <button type="button" disabled={!texts[i]?.trim() || Boolean(busy) || red[i] || noCredit} onClick={() => void voiceLines([i], `one-${i}`)} className={buttonClass("ghost", "min-h-10 px-3 text-meta")}>
                  {busy === `one-${i}` ? "Seslendiriliyor…" : `Bu sahneyi seslendir · ${VOICEOVER_CREDIT_COST} kredi`}<span className="sr-only">: {i + 1}. sahne</span>
                </button>
              </span>
            </div>
            <LiveTextField id={`dis-ses-${i}`} label={`${i + 1}. sahne dış sesi`} value={texts[i] ?? ""} onChange={(v) => setTexts((t) => Object.assign([...t], { [i]: v }))} sector={sector} platform={platform} maxLength={MAX_VOICE_TEXT} multiline rows={2} placeholder="Bu sahnede dış ses yok" />
            {red[i] ? <p className="text-meta font-semibold text-coral-deep">Yüksek riskli ifade var: seslendirmeden önce düzelt ya da güvenli sürümü uygula.</p> : null}
            {preview?.index === i ? (
              // A five-second sample of the line just written; the text is on screen above it.
               
              <audio src={preview.url} controls autoPlay aria-label={`${i + 1}. sahne ön dinleme`} className="w-full" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!voiced.length || Boolean(busy) || blocked.length > 0 || noCredit} onClick={() => void voiceLines(voiced, "all")} className={buttonClass("accent")}>
          {busy === "all" ? "Seslendiriliyor…" : `Tüm dış sesi seslendir · ${VOICEOVER_CREDIT_COST} kredi`}
        </button>
        {blocked.length ? <span className="text-small text-coral-deep">Önce düzelt: {blocked.map((i) => `${i + 1}. sahne`).join(", ")}</span> : null}
        {noCredit ? <span className="text-small text-coral-deep">Kredin kalmadı. Krediler sayfasından paket alabilirsin.</span> : null}
      </div>
      {error ? <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-body font-medium text-coral-deep">{error}</p> : null}
      {done ? <p role="status" className="rounded-xl bg-green-tint px-4 py-3 text-body font-medium text-green">{done}</p> : null}

      {voiceovers.length ? (
        <div className="grid gap-3">
          <h4 className="font-bold">Seslendirmeler</h4>
          {voiceovers.map((v) => (
            <div key={v.id} className="grid gap-2 rounded-xl bg-paper-2 p-3">
              <p className="text-meta text-ink-soft">{voiceLabel(v.voice)} · {TTS_SPEEDS.find((s) => s.id === v.speed)?.label} · {dateFmt.format(new Date(v.createdAt))}</p>
              <ul className="grid gap-2">
                {v.scenes.map((s, j) => (
                  <li key={s.index} className="grid gap-1">
                    <span className="flex flex-wrap items-center justify-between gap-2 text-meta">
                      <span className="font-semibold">{s.index + 1}. sahne · {sec(s.seconds)}</span>
                      <a href={`/api/generations/${v.id}/files/${j}`} download className="font-semibold text-blue">WAV indir<span className="sr-only">: {s.index + 1}. sahne</span></a>
                    </span>
                    {/* The line's text is shown in the scene list above; this is its synthetic reading. */}
                    { }
                    <audio src={`/api/generations/${v.id}/files/${j}`} controls preload="none" aria-label={`${s.index + 1}. sahne seslendirmesi`} className="w-full" />
                    {s.overrun ? <span className="text-meta text-coral-deep">Ses sahne süresinden uzun. Metni kısalt ya da hızı artır.</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-meta text-muted">Ses dosyaları 90 gün sonra silinir. Videoya eklemek için Video sekmesinde bu seslendirmeyi seç.</p>
        </div>
      ) : null}
    </section>
  );
}
