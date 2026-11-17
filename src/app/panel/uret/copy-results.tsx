"use client";

import Link from "next/link";
import { useState } from "react";
import type { CopyLine, CopyOutput } from "@/lib/copy/generate";
import { FRAMEWORK_LABEL } from "@/lib/copy/schema";
import type { Platform } from "@/lib/platforms";
import { CopyButton } from "../forms";

const RISK = {
  ok: { label: "Kural uyarısı yok", cls: "bg-green-tint text-green" },
  yellow: { label: "Dikkat", cls: "bg-amber-tint text-ink" },
  red: { label: "Yüksek risk", cls: "bg-coral-tint text-coral-deep" },
} as const;

function Line({ line, name, value, selected, onSelect, limit }: { line: CopyLine; name: string; value: number; selected: boolean; onSelect: (text: string) => void; limit: number }) {
  const len = [...line.text].length;
  return (
    <li className={`rounded-xl border p-3 ${selected ? "border-blue bg-blue-tint/40" : "border-line bg-card"}`}>
      <div className="flex items-start gap-3">
        <input type="radio" name={name} value={value} checked={selected} onChange={() => onSelect(line.safe ?? line.text)} aria-label={`Seç: ${line.text}`} className="mt-1 size-5 shrink-0 accent-[var(--color-blue)]" />
        <div className="min-w-0 flex-1">
          <p className={`text-body ${line.risk === "red" ? "text-ink-soft line-through decoration-coral/60" : "text-ink"}`}>{line.text}</p>
          {line.safe ? (
            <p className="mt-1.5 text-body text-ink">
              <span className="mr-1.5 rounded-md bg-green-tint px-1.5 py-0.5 text-fine font-bold text-green">Güvenli sürüm</span>
              {line.safe}
            </p>
          ) : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
            <span className={`rounded-full px-2 py-0.5 font-bold ${RISK[line.risk].cls}`}>{RISK[line.risk].label}</span>
            {line.framework ? <span>{FRAMEWORK_LABEL[line.framework]}</span> : null}
            <span className={`tabular ${len > limit ? "text-coral-deep" : ""}`}>{len}/{limit}</span>
            {line.trimmed ? <span>platform sınırına göre kısaltıldı</span> : null}
          </p>
          {line.issues.length ? <p className="mt-1 text-meta text-ink-soft">{line.issues.join(" · ")}</p> : null}
        </div>
        <CopyButton text={line.safe ?? line.text} />
      </div>
    </li>
  );
}

export function CopyResults({ copy, platform, limits, aiFailed }: { copy: CopyOutput; platform: Platform; limits: { headline: number; primaryText: number; description: number; cta: number }; aiFailed?: boolean }) {
  const first = (l: CopyLine[]) => (l.find((x) => x.risk === "ok") ?? l[0]) as CopyLine | undefined;
  const [h, setH] = useState(first(copy.headlines)?.text ?? "");
  const [p, setP] = useState(first(copy.primaryTexts)?.text ?? "");
  const [d, setD] = useState(first(copy.descriptions)?.text ?? "");
  const wizard = `/panel/yeni#${new URLSearchParams({ baslik: h, metin: p, aciklama: d, platform }).toString()}`;
  const groups: { title: string; key: string; lines: CopyLine[]; sel: string; set: (t: string) => void; limit: number }[] = [
    { title: "Başlıklar", key: "h", lines: copy.headlines, sel: h, set: setH, limit: limits.headline },
    { title: "Ana metinler", key: "p", lines: copy.primaryTexts, sel: p, set: setP, limit: limits.primaryText },
    { title: "Açıklamalar", key: "d", lines: copy.descriptions, sel: d, set: setD, limit: limits.description },
  ];
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <p className="text-small text-ink-soft">
          {copy.source === "ai" ? "Yapay zekâ ile üretildi; her satır kural motorundan geçti." : aiFailed ? "Yapay zekâ yanıt veremedi; şablon öneriler gösteriliyor, kredi düşülmedi." : "Şablon öneriler (yapay zekâ kapalı)."} {copy.limitNote}
        </p>
        <Link href={wizard} className="inline-flex h-11 items-center rounded-xl bg-ink px-5 font-semibold text-paper no-underline hover:bg-navy-700">
          Seçilenlerle analiz başlat
        </Link>
      </div>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`grup-${g.key}`}>
          <h3 id={`grup-${g.key}`} className="text-lg font-bold">{g.title} <span className="text-small font-semibold text-muted">({g.lines.length})</span></h3>
          <ul className="mt-3 grid gap-2">
            {g.lines.map((l, i) => (
              <Line key={i} line={l} name={`sec-${g.key}`} value={i} selected={g.sel === (l.safe ?? l.text) || g.sel === l.text} onSelect={g.set} limit={g.limit} />
            ))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="grup-cta">
        <h3 id="grup-cta" className="text-lg font-bold">Harekete geçirici ifadeler</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {copy.ctas.map((c, i) => (
            <li key={i} className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-4 pr-1 text-small font-semibold">
              {c.safe ?? c.text}
              <CopyButton text={c.safe ?? c.text} />
            </li>
          ))}
        </ul>
      </section>
      <p className="text-meta text-muted">Risk değerlendirmesidir, hukuki görüş değildir. Kural uyarısı olmaması reklamın onaylanacağı anlamına gelmez.</p>
    </div>
  );
}
