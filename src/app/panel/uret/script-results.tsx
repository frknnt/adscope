"use client";

import { Disclaimer } from "@/components/ui";
import type { ScriptOutput } from "@/lib/script/generate";
import { toSrt } from "@/lib/script/srt";
import { AI_VOICE_NOTICE } from "@/lib/speech/voices";
import { CopyButton } from "../forms";
import { AiVoiceNotice, VoicePanel, type VoiceoverView } from "./voice-panel";

type VoiceProps = Omit<Parameters<typeof VoicePanel>[0], "scenes"> & { voiceovers: VoiceoverView[] };

const RISK = {
  ok: { label: "Kural uyarısı yok", cls: "bg-green-tint text-green" },
  yellow: { label: "Dikkat", cls: "bg-amber-tint text-ink" },
  red: { label: "Yüksek risk", cls: "bg-coral-tint text-coral-deep" },
} as const;

const sec = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`;

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-subrip;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ScriptResults({ script, aiFailed, voice }: { script: ScriptOutput; aiFailed?: boolean; voice?: VoiceProps }) {
  const voiced = Boolean(voice?.voiceovers.length);
  const plain =
    script.scenes.map((s, i) => `${i + 1}. sahne (${sec(s.start)}–${sec(s.end)})\nGörüntü: ${s.visual}\nEkran yazısı: ${s.onScreen || "-"}\nDış ses: ${s.voiceover || "-"}`).join("\n\n") +
    (voiced ? `\n\n${AI_VOICE_NOTICE}` : "");
  const hasVoice = script.scenes.some((s) => s.voiceover);
  const hasText = script.scenes.some((s) => s.onScreen);
  return (
    <div className="grid gap-5">
      {voiced ? <AiVoiceNotice /> : null}
      {script.warnings.length ? (
        <ul className="grid gap-2" aria-label="Senaryo uyarıları">
          {script.warnings.map((w) => (
            <li key={w} className={`rounded-xl px-4 py-3 text-small ${w.startsWith("Yapay zekâ ile üretildiğini belirt") ? "border border-ink bg-card font-medium text-ink" : "bg-amber-tint text-ink"}`}>{w}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <p className="text-small text-ink-soft">
          {script.source === "ai" ? "Yapay zekâ ile üretildi; her satır kural motorundan geçti." : aiFailed ? "Yapay zekâ yanıt veremedi; şablon senaryo gösteriliyor, kredi düşülmedi." : "Şablon senaryo (yapay zekâ kapalı); her satır kural motorundan geçti."} Toplam {script.duration} saniye, {script.scenes.length} sahne.
        </p>
        <span className="flex flex-wrap gap-2">
          <button type="button" disabled={!hasVoice} onClick={() => download(toSrt(script.scenes, "voiceover"), `adscope-senaryo-${script.duration}sn-dis-ses.srt`)} className="inline-flex h-11 items-center rounded-xl bg-ink px-5 font-semibold text-paper hover:bg-navy-700 disabled:opacity-50">
            Dış ses altyazısı (SRT)
          </button>
          <button type="button" disabled={!hasText} onClick={() => download(toSrt(script.scenes, "onScreen"), `adscope-senaryo-${script.duration}sn-ekran-yazisi.srt`)} className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-card px-5 font-semibold text-ink hover:border-ink disabled:opacity-50">
            Ekran yazısı (SRT)
          </button>
          <CopyButton text={plain} />
        </span>
      </div>
      <ol className="grid gap-3" aria-label="Sahneler">
        {script.scenes.map((s, i) => (
          <li key={i} className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {i + 1}. sahne <span className="tabular text-small font-semibold text-muted">{sec(s.start)}–{sec(s.end)}</span>
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-meta font-bold ${RISK[s.check.risk].cls}`}>{RISK[s.check.risk].label}</span>
            </div>
            <dl className="mt-3 grid gap-2 text-body sm:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="text-small font-semibold text-muted">Görüntü</dt>
              <dd className="text-ink-soft">{s.visual}</dd>
              <dt className="text-small font-semibold text-muted">Ekran yazısı</dt>
              <dd className="text-ink">{s.onScreen || <span className="text-muted">Yok</span>}</dd>
              <dt className="text-small font-semibold text-muted">Dış ses</dt>
              <dd className="text-ink">{s.voiceover || <span className="text-muted">Yok</span>}</dd>
            </dl>
            {s.check.safe ? (
              <p className="mt-3 text-body text-ink">
                <span className="mr-1.5 rounded-md bg-green-tint px-1.5 py-0.5 text-fine font-bold text-green">Güvenli sürüm</span>
                {s.check.safe}
              </p>
            ) : null}
            {s.check.issues.length ? <p className="mt-2 text-meta text-ink-soft">{s.check.issues.join(" · ")}</p> : null}
            {s.testimonialRemoved ? <p className="mt-2 text-meta text-ink-soft">Müşteri yorumu gibi görünen bir satır çıkarıldı.</p> : null}
          </li>
        ))}
      </ol>
      {voice ? <VoicePanel {...voice} scenes={script.scenes} /> : null}
      <Disclaimer />
    </div>
  );
}
