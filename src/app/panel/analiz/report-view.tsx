import Link from "next/link";
import type { ReactNode } from "react";
import { HighlightedText } from "@/components/highlighted-text";
import { IconAlert, IconCheck, IconExternal, IconInfo, IconLink } from "@/components/icons";
import { LevelPill, SEVERITY_LABEL, ScaleBar } from "@/components/risk";
import { DOMAIN_LABEL, RULE_STATUS_LABEL, SECTOR_LABEL, formatDateTimeTr, formatDateTr } from "@/components/rule-status";
import { Disclaimer } from "@/components/ui";
import { Tabs } from "@/components/interactive";
import { wordDiff, type DiffPart } from "@/lib/text/word-diff";
import type { VariantView } from "@/lib/data/types";
import { SeverityFilter } from "./severity-filter";
import type { AnalysisDetail, FindingFeedback, FindingView } from "@/lib/data/types";
import type { DmKit } from "@/lib/engine/dm";
import { PLATFORM_INFO, PLATFORM_SHORT, type Platform } from "@/lib/platforms";
import { FindingFeedbackForm } from "../agency-forms";
import type { LandingReport, VideoReview } from "@/lib/engine/types";
import { aspectLabel } from "@/lib/engine/video";
import { CopyButton } from "../forms";
import { fixFirst, resultSentence } from "@/lib/report/summary";

const FIELD_LABEL: Record<string, string> = {
  headline: "Başlık",
  primary_text: "Ana metin",
  description: "Açıklama",
  image: "Görsel",
  general: "Genel",
  transcript: "Video metni",
  speech: "Konuşma (otomatik)",
  video: "Video",
  landing_page: "Açılış sayfası",
};

const sec = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

function CreativeMedia({ a, base }: { a: AnalysisDetail; base: string }) {
  if (a.mediaType === "video") {
    if (!a.frames.length) return <div className="grid aspect-[9/16] place-items-center rounded-xl border border-dashed border-line text-sm text-muted">Video kareleri silinmiş</div>;
    const [first, ...rest] = a.frames;
    return (
      <figure className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}?frame=${first.index}`} alt={`Videonun ${sec(first.timeMs / 1000)}. saniyesindeki kare`} className="w-full rounded-xl border border-line bg-ink object-contain" width={first.width ?? undefined} height={first.height ?? undefined} />
        {rest.length ? (
          <ul className={`grid gap-1.5 ${rest.length === 5 ? "grid-cols-5" : "grid-cols-4"}`} aria-label="Diğer video kareleri">
            {rest.map((f) => (
              <li key={f.index} className="flex flex-col items-center gap-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}?frame=${f.index}`} alt={`${sec(f.timeMs / 1000)}. saniye`} loading="lazy" className="aspect-[9/16] w-full rounded-md border border-line bg-ink object-cover" />
                <span className="text-fine text-muted tabular">{sec(f.timeMs / 1000)} sn</span>
              </li>
            ))}
          </ul>
        ) : null}
        <figcaption className="text-fine text-muted">Video yüklenmedi; tarayıcıda alınan {a.frames.length} kare incelendi.</figcaption>
      </figure>
    );
  }
  if (a.asset) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${base}`} alt="İncelenen reklam görseli" className="w-full rounded-xl border border-line bg-field object-contain" width={a.asset.width ?? undefined} height={a.asset.height ?? undefined} />;
  }
  return <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-line text-sm text-muted">Görsel silinmiş</div>;
}

const LANDING_STATUS: Record<LandingReport["status"], string> = {
  ok: "Sayfa okundu",
  http_error: "Sayfa hata döndürdü",
  blocked: "Adres güvenlik nedeniyle taranmadı",
  unreachable: "Sayfaya ulaşılamadı",
  not_html: "Bağlantı bir web sayfası değil",
  too_large: "Sayfa çok büyük",
  timeout: "Sayfa zamanında yanıt vermedi",
  invalid_url: "Bağlantı geçersiz",
};

const LANDING_SOURCE: Record<NonNullable<LandingReport["source"]>, string> = {
  fetch: "Sayfa sunucudan okundu",
  screenshot: "Ekran görüntüsünden okundu",
  "fetch+screenshot": "Sayfa ve ekran görüntüsü birlikte okundu",
};

function LandingSection({ report, base, hasScreenshot }: { report: LandingReport; base: string; hasScreenshot: boolean }) {
  const applicable = report.checks.filter((c) => c.ok !== null);
  const passed = applicable.filter((c) => c.ok).length;
  const fromShot = report.source === "screenshot" || report.source === "fetch+screenshot";
  return (
    <section aria-labelledby="acilis" className="rounded-2xl border border-line bg-card p-5 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="acilis" className="flex items-center gap-2 font-display text-xl font-semibold"><IconLink className="size-5" /> Açılış sayfası taraması</h2>
        <p className="text-small text-muted">
          {report.source === "screenshot" ? LANDING_SOURCE.screenshot : LANDING_STATUS[report.status]}
          {report.source === "fetch+screenshot" ? " · ekran görüntüsü de okundu" : ""} · <span className="tabular">{passed}/{applicable.length}</span> kontrol geçti · {formatDateTimeTr(report.fetchedAt)}
        </p>
      </div>
      <div className={hasScreenshot ? "mt-3 grid gap-4 sm:grid-cols-[9rem_1fr]" : ""}>
        {hasScreenshot ? (
          <a href={`${base}?screenshot=1`} target="_blank" rel="noopener noreferrer" className="block self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}?screenshot=1`} alt="Yüklenen açılış sayfası ekran görüntüsü" loading="lazy" className="max-h-56 w-full rounded-lg border border-line bg-field object-cover object-top" />
            <span className="sr-only">(yeni sekmede açılır)</span>
          </a>
        ) : null}
        <p className={`${hasScreenshot ? "" : "mt-2 "}break-all text-small text-ink-soft`}>
          {report.finalUrl ?? (report.requestedUrl || "Bağlantı verilmedi")}
          {report.title ? <span className="block break-normal font-semibold text-ink">{report.title}</span> : null}
          {report.screenshot === "unread" ? <span className="mt-1 block break-normal text-amber">Ekran görüntüsü saklandı ama metni otomatik okunamadı (yapay zekâ kapalı veya yanıt kullanılamadı); aşağıdaki kontroller sınırlı.</span> : null}
          {report.screenshot === "not_page" ? <span className="mt-1 block break-normal text-amber">Yüklenen görsel bir web sayfası ekran görüntüsüne benzemiyor; metni kullanılmadı.</span> : null}
        </p>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {report.checks.map((c) => (
          <li key={c.key} className="flex gap-3 py-2.5">
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-fine font-bold ${c.ok === null ? "bg-paper-2 text-muted" : c.ok ? "bg-green-tint text-green" : "bg-amber-tint text-amber"}`}
              aria-hidden
            >
              {c.ok === null ? "–" : c.ok ? <IconCheck className="size-3.5" /> : "!"}
            </span>
            <span className="text-body">
              <span className="font-semibold">{c.label}</span>
              <span className="sr-only">: {c.ok === null ? "uygulanmadı" : c.ok ? "geçti" : "dikkat"}</span>
              <span className="block break-words text-small text-ink-soft">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-meta text-muted">
        {fromShot
          ? "Ekran görüntüsündeki metin yapay zekâ ile okundu ve yalnızca metin olarak karşılaştırıldı; görüntü raporla birlikte saklanır, sayfanın görünmeyen bölümleri değerlendirilemez."
          : "Sayfa bir kez, sunucudan okundu; içeriği saklanmadı. Giriş, çerez onayı veya JavaScript ile yüklenen bölümler görülmemiş olabilir; böyle sayfalar için ekran görüntüsü ekleyebilirsin."}
      </p>
    </section>
  );
}

function yesNo(v: boolean | null, yes: string, no: string) {
  return v === null ? "Değerlendirilmedi" : v ? yes : no;
}

function VideoReviewSection({ review, base }: { review: VideoReview; base: string }) {
  const a = review.audio;
  const visual: { label: string; value: string; warn?: boolean }[] = review.reviewedByAi
    ? [
        {
          label: "İlk 3 saniye (kanca)",
          value: review.hookStrength === null ? "Değerlendirilmedi" : `${review.hookStrength} / 10${review.hookNote ? ` · ${review.hookNote}` : ""}`,
          warn: review.hookStrength !== null && review.hookStrength <= 4,
        },
        { label: "Ekran yazısı / altyazı", value: yesNo(review.hasCaptions, "Var", "Görülmedi"), warn: review.hasCaptions === false },
        { label: "Sessiz izlemede anlaşılıyor mu?", value: yesNo(review.worksWithoutSound, "Evet", "Zor anlaşılıyor"), warn: review.worksWithoutSound === false },
        { label: "Güvenli alan", value: yesNo(review.safeZoneIssue === null ? null : !review.safeZoneIssue, "Önemli öğeler güvenli alanda", "Yazı veya logo kenara çok yakın"), warn: review.safeZoneIssue === true },
      ]
    : [{ label: "Kanca, altyazı, güvenli alan", value: "Değerlendirilmedi (yapay zekâ kapalı). Bu kontroller kareler üzerinden yapay zekâ ile yapılır." }];
  const rows: { label: string; value: string; warn?: boolean }[] = [
    ...visual,
    {
      label: "Ses",
      value: !a?.analyzed
        ? "Ölçülemedi"
        : !a.present
          ? "Videoda ses yok"
          : `${sec(a.firstSoundSec ?? 0)} sn'de başlıyor${a.silentRatio === null ? "" : a.silentRatio < 0.05 ? " · sessiz bölüm yok" : ` · sürenin yaklaşık %${Math.round(a.silentRatio * 100)} kadarı sessiz`}`,
      warn: Boolean(a?.analyzed && (!a.present || (a.firstSoundSec ?? 0) > 1.5)),
    },
    {
      label: "İlk 3 saniyede söylenen",
      value: review.speechFirst3s ? `“${review.speechFirst3s}”` : review.speechProvider ? "İlk 3 saniyede konuşma yok" : "Konuşma yazıya dökülmedi",
      warn: Boolean(review.speechProvider && !review.speechFirst3s),
    },
  ];
  return (
    <section aria-labelledby="video-inceleme" className="rounded-2xl border border-line bg-card p-5 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="video-inceleme" className="font-display text-xl font-semibold">Video kanca incelemesi</h2>
        <p className="text-small text-muted">{review.reviewedByAi ? "Kareler yapay zekâ ile incelendi" : "Yalnızca ölçümler (yapay zekâ kapalı)"}</p>
      </div>
      <dl className="mt-4 divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="text-small font-semibold">{r.label}</dt>
            <dd className={`text-body ${r.warn ? "font-medium text-amber" : "text-ink-soft"}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {review.frameNotes.length ? (
        <>
          <h3 className="mt-5 text-sm font-bold">Kare notları</h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {review.frameNotes.map((n) => (
              <li key={n.frame} className="flex gap-3 rounded-xl bg-paper/70 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}?frame=${n.frame - 1}`} alt="" loading="lazy" className="aspect-[9/16] w-10 shrink-0 rounded border border-line bg-ink object-cover" />
                <span className="text-small"><span className="font-semibold">Kare {n.frame}.</span> {n.note}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p className="mt-3 text-meta text-muted">Kanca, altyazı ve güvenli alan notları kreatif önerisidir; politika veya mevzuat ihlali değildir.</p>
    </section>
  );
}

const SEV_STYLE = {
  red: { dot: "bg-coral", ring: "border-coral/45", text: "text-coral-deep", tint: "bg-coral-tint" },
  yellow: { dot: "bg-caution", ring: "border-caution/60", text: "text-amber", tint: "bg-amber-tint" },
  info: { dot: "bg-info", ring: "border-info/30", text: "text-info", tint: "bg-info-tint" },
} as const;

function FindingItem({ f, platform, feedback }: { f: FindingView; platform: Platform; feedback?: { analysisId: string; current: FindingFeedback | null } }) {
  const s = SEV_STYLE[f.severity];
  const unverified = f.rule && f.rule.status !== "active";
  return (
    <li className={`rounded-2xl border bg-card p-5 ${s.ring} break-inside-avoid`}>
      <div className="flex flex-wrap items-center gap-2 text-fine font-bold">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${s.tint} ${s.text}`}>
          <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
          {SEVERITY_LABEL[f.severity]}
        </span>
        <span className="text-muted">{f.domain === "meta_policy" ? PLATFORM_INFO[platform].policy : DOMAIN_LABEL[f.domain]}</span>
        {f.field ? <span className="text-muted">· {FIELD_LABEL[f.field] ?? f.field}</span> : null}
        {f.origin === "ai" ? <span className="text-muted">· yapay zekâ tespiti</span> : null}
      </div>
      <h4 className="mt-2.5 text-[1.05rem] font-bold leading-snug">
        {f.matchedText ? <><span className={f.severity === "red" ? "mark-risk" : f.severity === "yellow" ? "mark-warn" : "mark-info"}>“{f.matchedText}”</span> · </> : null}
        {f.title}
      </h4>
      <p className="mt-2 text-body leading-relaxed text-ink-soft">{f.explanation}</p>
      <p className="mt-2 text-body leading-relaxed"><span className="font-semibold">Düzeltme: </span>{f.suggestion}</p>
      {f.rule ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-line pt-3 text-meta text-muted">
          <Link href={`/kurallar#${f.rule.id}`} className="font-semibold text-ink tabular">{f.rule.id} · v{f.rule.version}</Link>
          <span>{RULE_STATUS_LABEL[f.rule.status]}</span>
          <span>Son doğrulama {formatDateTr(f.rule.lastVerifiedAt)}</span>
          <a href={f.rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-coral-deep">
            {f.rule.sourceOrg} <IconExternal className="size-3" aria-hidden /><span className="sr-only">(yeni sekmede açılır)</span>
          </a>
        </div>
      ) : null}
      {unverified ? (
        <p className="mt-2 flex items-start gap-1.5 text-meta text-muted"><IconInfo className="mt-0.5 size-3.5 shrink-0" /> Bu kural resmî kaynakta henüz doğrulanmadı; ihlal olarak sayılmaz ve risk seviyesini değiştirmez.</p>
      ) : null}
      {feedback ? <FindingFeedbackForm analysisId={feedback.analysisId} findingId={f.id} current={feedback.current} /> : null}
    </li>
  );
}

function DmSection({ dm, print }: { dm: DmKit; print: boolean }) {
  const blocks: [string, string, string][] = [
    ["Müşterinin ilk mesajı", "Mesaj gönder reklamında hazır gelen metin. Müşteri tek dokunuşla gönderir.", dm.first_message],
    ["Otomatik karşılama", "WhatsApp Business veya Instagram'da ilk yanıt olarak ayarla.", dm.auto_greeting],
    ["Mesai dışı yanıt", "Çalışma saatleri dışında gelen mesajlara.", dm.away_message],
  ];
  return (
    <section aria-labelledby="dm-h" className="break-inside-avoid">
      <h2 id="dm-h" className="font-display text-2xl font-semibold">WhatsApp / DM şablonları</h2>
      <p className="mt-1 text-body text-ink-soft">Reklamdaki vaatlerle uyumlu, aynı kural kartlarıyla yeniden taranmış öneriler: {dm.recheck_red} kırmızı, {dm.recheck_yellow} sarı bayrak.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {blocks.map(([title, hint, text]) => (
          <div key={title} className="flex flex-col rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">{title}</h3>
              {!print ? <CopyButton text={text} /> : null}
            </div>
            <p className="mt-1 text-meta text-muted">{hint}</p>
            <p className="mt-3 whitespace-pre-line text-body leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Hazır sorular (sohbet başlatıcı)</h3>
          {!print ? <CopyButton text={dm.starter_questions.join("\n")} /> : null}
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {dm.starter_questions.map((q) => <li key={q} className="rounded-full bg-paper px-3 py-1 text-small">{q}</li>)}
        </ul>
      </div>
      <ul className="mt-3 grid gap-1 text-meta text-muted">
        {dm.notes.map((n) => <li key={n} className="flex gap-1.5"><IconInfo className="mt-0.5 size-3.5 shrink-0" />{n}</li>)}
      </ul>
    </section>
  );
}

function DiffText({ parts, kind }: { parts: DiffPart[]; kind: "del" | "ins" }) {
  return (
    <>
      {parts.map((p, i) =>
        p.changed ? (
          kind === "del" ? (
            <del key={i} className="rounded bg-coral-tint px-0.5 text-coral-deep decoration-coral-deep/60">{p.text}</del>
          ) : (
            <ins key={i} className="rounded bg-green-tint px-0.5 font-semibold text-green no-underline">{p.text}</ins>
          )
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Before / after with the changed words highlighted (colour plus strike-through / bold, never colour alone). */
function SafeCompare({ a, safe }: { a: AnalysisDetail; safe: VariantView }) {
  const head = wordDiff(a.headline, safe.headline);
  const body = wordDiff(a.primaryText, safe.primaryText);
  return (
    <section aria-labelledby="guvenli" className="break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="guvenli" className="font-display text-2xl font-semibold">Güvenli metin önerisi</h2>
        <CopyButton text={[safe.headline, safe.primaryText, safe.description].filter(Boolean).join("\n\n")} label="Güvenli metni kopyala" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="text-meta font-semibold text-muted">Önce: senin metnin</p>
          {a.headline ? <p className="mt-2 font-bold"><DiffText parts={head.before} kind="del" /></p> : null}
          <p className="mt-1 whitespace-pre-line leading-relaxed"><DiffText parts={body.before} kind="del" /></p>
        </div>
        <div className="rounded-2xl border border-green/30 bg-green-tint/40 p-5">
          <p className="text-meta font-semibold text-green">Sonra: güvenli öneri</p>
          {safe.headline ? <p className="mt-2 font-bold"><DiffText parts={head.after} kind="ins" /></p> : null}
          <p className="mt-1 whitespace-pre-line leading-relaxed"><DiffText parts={body.after} kind="ins" /></p>
          {safe.description ? <p className="mt-2 text-body text-ink-soft">{safe.description}</p> : null}
        </div>
      </div>
      <p className="mt-2 text-meta text-muted">Çıkarılan ifadelerin üstü çizili, eklenenler kalın. Öneri aynı kural kartlarıyla yeniden tarandı: {safe.recheckRed} kırmızı, {safe.recheckYellow} sarı bayrak.</p>
    </section>
  );
}

/** The single most important thing to fix: the first red (legal before platform), else the first yellow finding. */
function FixFirst({ a, safe }: { a: AnalysisDetail; safe: VariantView | undefined }) {
  const top = fixFirst(a.findings);
  if (!top) return null;
  return (
    <section aria-labelledby="once-duzelt" className="rounded-2xl border border-blue/20 bg-blue-tint p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="once-duzelt" className="text-meta font-bold uppercase tracking-[0.08em] text-blue">Önce bunu düzelt</h2>
          <p className="mt-2 text-lg font-bold leading-snug text-ink">
            {top.matchedText ? <><span className={top.severity === "red" ? "mark-risk" : "mark-warn"}>“{top.matchedText}”</span> · </> : null}
            {top.title}
          </p>
          <p className="mt-1.5 text-body leading-relaxed text-ink-soft"><span className="font-semibold text-ink">Düzeltme: </span>{top.suggestion}</p>
        </div>
        <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-meta font-bold text-ink">{SEVERITY_LABEL[top.severity]}</span>
      </div>
      {safe ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4">
          <p className="min-w-0 flex-1 text-body leading-relaxed"><span className="font-semibold">Güvenli öneri: </span>{safe.primaryText}</p>
          <CopyButton text={[safe.headline, safe.primaryText, safe.description].filter(Boolean).join("\n\n")} />
        </div>
      ) : null}
    </section>
  );
}

export function ReportView({
  a,
  print = false,
  feedback,
  assetBase,
  layout = "flow",
  appealSlot,
}: {
  a: AnalysisDetail;
  print?: boolean;
  /** "tabs" is the interactive panel layout; "flow" keeps every section in reading order (print, review link). */
  layout?: "flow" | "tabs";
  /** Shown in the İtiraz tab when there is no appeal yet (the owner's appeal form). */
  appealSlot?: ReactNode;
  /** Feedback already given by the viewer; pass to show the "bu uyarı yanlış mı?" controls. */
  feedback?: FindingFeedback[];
  /** Where creative files are served from (the review link page uses its own route). */
  assetBase?: string;
}) {
  const base = assetBase ?? `/api/analyses/${a.id}/asset`;
  const fbMap = feedback ? new Map(feedback.map((x) => [x.findingId, x])) : null;
  const groups = (["red", "yellow", "info"] as const).map((sev) => ({ sev, items: a.findings.filter((f) => f.severity === sev) }));
  const marks = a.findings.map((f) => ({ text: f.matchedText, severity: f.severity }));
  const bd = a.scoreBreakdown;
  const safe = a.variants.find((v) => v.kind === "safe");
  const variants = a.variants.filter((v) => v.kind === "variant").sort((x, y) => x.position - y.position);

  const scoresNode = (
    <>
      <section aria-labelledby="skorlar" className="grid gap-4 md:grid-cols-3">
        <h2 id="skorlar" className="sr-only">Skorlar</h2>
        <div className="rounded-2xl border border-line bg-card p-5 break-inside-avoid">
          <p className="text-meta font-semibold text-muted">{PLATFORM_SHORT[a.platform]} ret riski</p>
          <p className="mt-1 flex items-baseline gap-3"><span className="font-display text-5xl font-semibold tabular">{a.metaRiskScore}</span><LevelPill level={a.metaRiskLevel} /></p>
          <ScaleBar value={a.metaRiskScore ?? 0} label={`${PLATFORM_SHORT[a.platform]} ret riski skoru`} />
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 break-inside-avoid">
          <p className="text-meta font-semibold text-muted">Türk mevzuatı riski</p>
          <p className="mt-1 flex items-baseline gap-3"><span className="font-display text-5xl font-semibold tabular">{a.legalFindingCount}</span><span className="text-sm text-muted">doğrulanmış bulgu</span></p>
          <p className="mt-3"><LevelPill level={a.legalRiskLevel} /></p>
          {bd ? <p className="mt-2 text-meta leading-snug text-ink-soft">{bd.legal.reason}</p> : null}
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 break-inside-avoid">
          <p className="text-meta font-semibold text-muted">Kreatif skoru</p>
          <p className="mt-1 flex items-baseline gap-2"><span className="font-display text-5xl font-semibold tabular">{a.creativeScore}</span><span className="text-sm text-muted">/ 100</span></p>
          <ScaleBar value={a.creativeScore ?? 0} invert label="Kreatif skoru" />
        </div>
      </section>


    </>
  );
  const creativeNode = (
    <>
      <section aria-labelledby="reklam" className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
        <h2 id="reklam" className="sr-only">İncelenen reklam</h2>
        <CreativeMedia a={a} base={base} />
        <div className="sheet rounded-2xl border border-line p-5">
          {a.headline ? <p className="text-lg font-bold"><HighlightedText text={a.headline} marks={marks} /></p> : null}
          <p className="mt-2 whitespace-pre-line leading-relaxed"><HighlightedText text={a.primaryText} marks={marks} /></p>
          {a.description ? <p className="mt-3 text-body text-ink-soft"><HighlightedText text={a.description} marks={marks} /></p> : null}
          {a.transcript ? (
            <div className="mt-4 border-t border-dashed border-line pt-3">
              <p className="text-meta font-semibold text-muted">Videodaki konuşma ve ekran yazıları</p>
              <p className="mt-1 whitespace-pre-line text-body leading-relaxed"><HighlightedText text={a.transcript} marks={marks} /></p>
            </div>
          ) : null}
          {a.speechTranscript ? (
            <div className="mt-4 border-t border-dashed border-line pt-3">
              <p className="text-meta font-semibold text-muted">Videodaki konuşma (otomatik yazıya döküldü, hatalı olabilir)</p>
              <p className="mt-1 whitespace-pre-line text-body leading-relaxed"><HighlightedText text={a.speechTranscript} marks={marks} /></p>
            </div>
          ) : null}
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed border-line pt-3 text-meta text-muted">
            <span>{SECTOR_LABEL[a.sector]}</span>
            <span>{PLATFORM_INFO[a.platform].label}</span>
            {a.mediaType === "video" && a.videoMeta ? (
              <span className="tabular">
                Video · {sec(a.videoMeta.durationSec)} sn · {a.videoMeta.width}×{a.videoMeta.height} px ({aspectLabel(a.videoMeta.width, a.videoMeta.height)})
              </span>
            ) : a.asset?.width ? <span className="tabular">{a.asset.width}×{a.asset.height} px</span> : null}
            {a.landingUrl ? <span className="break-all">Açılış sayfası: {a.landingUrl}</span> : null}
            <span className="tabular">{a.creditCost} kredi</span>
            <span>{a.aiProvider && !a.aiProvider.startsWith("deterministic") ? "Kural motoru + yapay zekâ" : a.aiProvider?.includes("kullanılamadı") ? "Kural motoru (yapay zekâ yanıtı kullanılamadı)" : "Kural motoru (yapay zekâ kapalı)"}</span>
          </p>
        </div>
      </section>


    </>
  );
  const findingsNode = (
    <>
      <section aria-labelledby="bulgular">
        <h2 id="bulgular" className="font-display text-2xl font-semibold">Bulgular <span className="text-base font-normal text-muted">· {a.findings.length}</span></h2>
        {a.findings.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-line bg-card px-5 py-4 text-ink-soft">Aktif kural kartlarına göre işaretlenen bir ifade bulunmadı. Bu, reklamın onaylanacağı anlamına gelmez; görseldeki metin ve hedefleme ayrıca kontrol edilmelidir.</p>
        ) : (
          groups.filter((g) => g.items.length).map((g) => (
            <div key={g.sev} data-sev={g.sev} className="mt-5">
              <h3 className={`flex items-center gap-2 text-body font-bold ${SEV_STYLE[g.sev].text}`}>
                {g.sev === "info" ? <IconInfo className="size-4" /> : <IconAlert className="size-4" />}
                {SEVERITY_LABEL[g.sev]} · {g.items.length}
              </h3>
              <ul className="mt-3 grid gap-3">
                {g.items.map((f) => (
                  <FindingItem key={f.id} f={f} platform={a.platform} feedback={fbMap && !print ? { analysisId: a.id, current: fbMap.get(f.id) ?? null } : undefined} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>


    </>
  );
  const breakdownNode = (
    <>
      {bd ? (
        <section aria-labelledby="skor-detay" className="rounded-2xl border border-line bg-card p-5 break-inside-avoid">
          <h2 id="skor-detay" className="font-display text-xl font-semibold">Skorlar nasıl oluştu?</h2>
          <div className="mt-4 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold">{PLATFORM_SHORT[a.platform]} ret riski</h3>
              <table className="mt-2 w-full text-small">
                <tbody className="divide-y divide-line">
                  <tr><td className="py-1.5 pr-3 text-ink-soft">{bd.meta.baseReason}</td><td className="py-1.5 text-right font-semibold tabular">+{bd.meta.base}</td></tr>
                  {bd.meta.items.map((i) => (
                    <tr key={i.ruleId}><td className="py-1.5 pr-3 text-ink-soft">{i.title}</td><td className="py-1.5 text-right font-semibold tabular">+{i.points}</td></tr>
                  ))}
                  <tr><td className="py-1.5 pr-3 font-semibold">Toplam (en fazla 100)</td><td className="py-1.5 text-right font-bold tabular">{a.metaRiskScore}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-sm font-bold">Kreatif skoru</h3>
              <table className="mt-2 w-full text-small">
                <tbody className="divide-y divide-line">
                  {bd.creative.map((c) => (
                    <tr key={c.key}>
                      <td className="py-1.5 pr-3"><span className="font-semibold">{c.label}</span><span className="block text-meta text-ink-soft">{c.reason}</span></td>
                      <td className="py-1.5 text-right align-top font-semibold tabular whitespace-nowrap">{c.score} / {c.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}


    </>
  );
  const safeNode = (
    <>
      {safe ? (
        <section aria-labelledby="guvenli" className="break-inside-avoid">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="guvenli" className="font-display text-2xl font-semibold">Güvenli metin önerisi</h2>
            {!print ? <CopyButton text={[safe.headline, safe.primaryText, safe.description].filter(Boolean).join("\n\n")} /> : null}
          </div>
          <div className="mt-3 rounded-2xl border border-green/30 bg-green-tint/50 p-5">
            {safe.headline ? <p className="font-bold">{safe.headline}</p> : null}
            <p className="mt-1 whitespace-pre-line leading-relaxed">{safe.primaryText}</p>
            {safe.description ? <p className="mt-2 text-body text-ink-soft">{safe.description}</p> : null}
          </div>
          <p className="mt-2 text-meta text-muted">Öneri, aynı kural kartlarıyla yeniden tarandı: {safe.recheckRed} kırmızı, {safe.recheckYellow} sarı bayrak.</p>
        </section>
      ) : null}


    </>
  );
  const variantsNode = (
    <>
      {variants.length ? (
        <section aria-labelledby="varyantlar" className={print ? "print-break" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="varyantlar" className="font-display text-2xl font-semibold">Beş Türkçe varyant</h2>
            {!print && !assetBase ? (
              <a href={`/api/analyses/${a.id}/export?format=csv`} className="no-print inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-meta font-semibold text-ink hover:bg-paper-2" download>
                Tablo olarak indir (CSV)
              </a>
            ) : null}
          </div>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {variants.map((v) => (
              <li key={v.position} className="flex flex-col rounded-2xl border border-line bg-card p-5 break-inside-avoid">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-meta font-bold text-coral-deep">{v.tone}</span>
                  {!print ? <CopyButton text={[v.headline, v.primaryText, v.description].filter(Boolean).join("\n\n")} /> : null}
                </div>
                {v.headline ? <p className="mt-2 font-bold">{v.headline}</p> : null}
                <p className="mt-1 whitespace-pre-line text-body leading-relaxed">{v.primaryText}</p>
                {v.description ? <p className="mt-2 text-small text-ink-soft">{v.description}</p> : null}
                <p className="mt-auto pt-3 text-meta text-muted">
                  Yeniden tarama: {v.recheckRed === 0 && v.recheckYellow === 0 ? "bayrak yok" : `${v.recheckRed} kırmızı, ${v.recheckYellow} sarı`}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}


    </>
  );
  const appealNode = (
    <>
      {a.appeal ? (
        <section id="itiraz" aria-labelledby="itiraz-h" className="scroll-mt-6 break-inside-avoid">
          <h2 id="itiraz-h" className="font-display text-2xl font-semibold">İtiraz asistanı</h2>
          <div className={`mt-4 rounded-2xl p-5 ${a.appeal.recommendation === "new_ad" ? "bg-amber-tint" : "bg-info-tint"}`}>
            <p className="font-bold">{a.appeal.recommendation === "new_ad" ? "Öneri: itiraz yerine düzeltilmiş yeni reklam" : "Öneri: itiraz edilebilir"}</p>
            <p className="mt-1.5 text-body leading-relaxed text-ink-soft">{a.appeal.explanation_tr}</p>
            {a.appeal.detected_policies.length ? <p className="mt-2 text-small text-ink-soft">Ret mesajında tespit edilen politika: {a.appeal.detected_policies.join(", ")}</p> : null}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {([["Türkçe taslak", a.appeal.draft_tr], ["İngilizce taslak (Meta destek formu için)", a.appeal.draft_en]] as const).map(([label, text]) => (
              <div key={label} className="rounded-2xl border border-line bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">{label}</h3>
                  {!print ? <CopyButton text={text} /> : null}
                </div>
                <p className="mt-3 whitespace-pre-line text-body leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-5 text-sm font-bold">Göndermeden önce</h3>
          <ul className="mt-2 grid gap-1.5 text-body">
            {a.appeal.checklist.map((c) => (
              <li key={c.label} className="flex gap-2"><span aria-hidden className="text-muted">☐</span>{c.label}</li>
            ))}
          </ul>
        </section>
      ) : null}


    </>
  );
  const footerNode = (
    <>
      <footer className="flex flex-col gap-3 text-meta text-muted">
        <Disclaimer />
        <p>
          Rapor kimliği <span className="tabular">{a.id}</span> · {a.completedAt ? formatDateTimeTr(a.completedAt) : formatDateTimeTr(a.createdAt)} · {a.engineVersion}
          {a.expiresAt ? <> · {formatDateTr(a.expiresAt)} tarihinde otomatik silinecek</> : null}
        </p>
      </footer>

    </>
  );

  if (layout === "tabs") {
    const tabs = [
      {
        title: `Bulgular (${a.findings.length})`,
        content: (
          <div className="flex flex-col gap-8">
            {creativeNode}
            <SeverityFilter counts={{ red: groups[0].items.length, yellow: groups[1].items.length, info: groups[2].items.length }}>{findingsNode}</SeverityFilter>
            {breakdownNode}
          </div>
        ),
      },
      ...(safe || variants.length
        ? [
            {
              title: "Güvenli metin ve varyantlar",
              content: (
                <div className="flex flex-col gap-8">
                  {safe ? <SafeCompare a={a} safe={safe} /> : null}
                  {variantsNode}
                </div>
              ),
            },
          ]
        : []),
      ...(bd?.video ? [{ title: "Video", content: <VideoReviewSection review={bd.video} base={base} /> }] : []),
      ...(bd?.landing ? [{ title: "Açılış sayfası", content: <LandingSection report={bd.landing} base={base} hasScreenshot={a.hasLandingScreenshot} /> }] : []),
      ...(bd?.dm ? [{ title: "DM şablonu", content: <DmSection dm={bd.dm} print={false} /> }] : []),
      ...(a.appeal || appealSlot ? [{ title: "İtiraz", hash: "itiraz", content: a.appeal ? appealNode : appealSlot }] : []),
    ];
    return (
      <div className="flex flex-col gap-8">
        <p className="text-lg font-semibold leading-snug text-ink" data-testid="result-sentence">{resultSentence(a)}</p>
        {scoresNode}
        <FixFirst a={a} safe={safe} />
        <Tabs label="Rapor bölümleri" tabs={tabs} />
        {footerNode}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="text-lg font-semibold leading-snug text-ink">{resultSentence(a)}</p>
      {scoresNode}
      {creativeNode}
      {findingsNode}
      {bd?.video ? <VideoReviewSection review={bd.video} base={base} /> : null}
      {bd?.landing ? <LandingSection report={bd.landing} base={base} hasScreenshot={a.hasLandingScreenshot} /> : null}

      {breakdownNode}
      {safeNode}
      {variantsNode}
      {bd?.dm ? <DmSection dm={bd.dm} print={print} /> : null}

      {appealNode}
      {footerNode}
    </div>
  );
}
