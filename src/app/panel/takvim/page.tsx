import Link from "next/link";
import { IconCalendar, IconInfo, IconPlus } from "@/components/icons";
import { RuleStatusPill, SECTOR_LABEL } from "@/components/rule-status";
import { buttonClass, Disclaimer } from "@/components/ui";
import { requirePanelUser } from "@/app/panel/guard";
import { daysUntil, istanbulToday, phaseOf, upcomingEvents, type Phase, type SeasonEvent } from "@/lib/calendar/season";
import { setSeasonRemindersAction } from "@/app/panel/actions";
import { templatesFor } from "@/lib/calendar/templates";
import { getRepo } from "@/lib/data";
import { RULE_CATALOG, type Sector } from "@/lib/rules/catalog";

export const metadata = { title: "Sezon takvimi" };

const SECTORS = Object.keys(SECTOR_LABEL) as Sector[];
const RULES = new Map(RULE_CATALOG.map((r) => [r.id, r]));

const PHASE: Record<Phase, { label: string; cls: string }> = {
  yayinda: { label: "Reklam dönemi başladı", cls: "bg-coral-tint text-coral-deep" },
  "incelemeye-gonder": { label: "İncelemeye gönderme zamanı", cls: "bg-amber-tint text-amber" },
  hazirlik: { label: "Hazırlık zamanı", cls: "bg-info-tint text-info" },
  yaklasiyor: { label: "Yaklaşıyor", cls: "bg-paper-2 text-ink-soft" },
};

const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", ...o }).format(toDate(iso));
const dayMonth = (iso: string) => fmt(iso, { day: "numeric", month: "long" });

function rangeLabel(e: SeasonEvent) {
  if (e.start === e.end) return fmt(e.start, { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  return `${dayMonth(e.start)} – ${fmt(e.end, { day: "numeric", month: "long", year: "numeric" })}`;
}

function countdown(days: number) {
  if (days <= 0) return "Bugün veya devam ediyor";
  if (days === 1) return "Yarın";
  return `${days} gün kaldı`;
}

function EventCard({ e, today, open, sector }: { e: SeasonEvent; today: Date; open: boolean; sector: Sector | null }) {
  const templates = templatesFor(e.id, sector);
  const phase = phaseOf(e, today);
  const days = daysUntil(e.start, today);
  const steps = [
    { key: "hazirlik", label: "Hazırlığa başla", date: e.prepStart },
    { key: "incelemeye-gonder", label: "İncelemeye gönder", date: e.submitBy },
    { key: "yayinda", label: "Reklamlar yayında", date: e.adStart },
  ] as const;
  const order: Phase[] = ["yaklasiyor", "hazirlik", "incelemeye-gonder", "yayinda"];
  const reached = order.indexOf(phase);

  return (
    <article id={e.key} aria-labelledby={`${e.key}-h`} className="scroll-mt-6 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[5.5rem_1fr]">
        <div className="flex items-baseline gap-2 sm:block sm:text-center" aria-hidden>
          <p className="font-display text-4xl font-semibold leading-none tabular sm:text-5xl">{fmt(e.start, { day: "numeric" })}</p>
          <p className="mt-1 text-meta font-semibold uppercase tracking-wide text-muted">{fmt(e.start, { month: "short" })}</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`${e.key}-h`} className="text-[1.2rem] font-bold leading-snug">{e.name}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-fine font-bold ${PHASE[phase].cls}`}>{PHASE[phase].label}</span>
          </div>
          <p className="mt-1 text-small text-muted">
            <time dateTime={e.start}>{rangeLabel(e)}</time> · <span className="tabular">{countdown(days)}</span>
          </p>
          {!e.verified ? (
            <p className="mt-2 flex items-start gap-1.5 text-meta font-medium text-amber">
              <IconInfo className="mt-0.5 size-3.5 shrink-0" /> {e.dateRule}
            </p>
          ) : (
            <p className="mt-1 text-meta text-muted">{e.dateRule}</p>
          )}
          <p className="mt-3 text-body leading-relaxed text-ink-soft">{e.summary}</p>

          <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Hazırlık adımları">
            {steps.map((s, i) => {
              const done = reached > i + 1;
              const current = reached === i + 1;
              return (
                <li
                  key={s.key}
                  aria-current={current ? "step" : undefined}
                  className={`rounded-xl border px-3 py-2 ${current ? "border-ink bg-field shadow-[0_0_0_1px_var(--ink)]" : "border-line"} ${done ? "text-muted" : ""}`}
                >
                  <span className="block text-fine font-semibold text-muted">{i + 1}. {s.label}</span>
                  <time dateTime={s.date} className="block text-body font-semibold tabular">{dayMonth(s.date)}</time>
                </li>
              );
            })}
          </ol>

          <details className="group mt-4 rounded-xl bg-paper/70 px-4 py-3" open={open}>
            <summary className="cursor-pointer text-body font-semibold">Öneriler ve uyum hatırlatmaları</summary>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="text-meta font-bold uppercase tracking-wide text-muted">Kreatif önerileri</h4>
                <ul className="mt-2 grid gap-1.5 text-body leading-relaxed">
                  {e.tips.map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-coral">•</span>{t}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-meta font-bold uppercase tracking-wide text-muted">Yayından önce kontrol et</h4>
                <ul className="mt-2 grid gap-3 text-body leading-relaxed">
                  {e.reminders.map((r) => (
                    <li key={r.text}>
                      <p>{r.text}</p>
                      {r.ruleIds.length ? (
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta">
                          {r.ruleIds.map((id) => {
                            const rule = RULES.get(id);
                            return rule ? (
                              <span key={id} className="inline-flex items-center gap-1.5">
                                <Link href={`/kurallar#${id}`} className="font-semibold text-ink tabular">{id}</Link>
                                <RuleStatusPill status={rule.status} />
                              </span>
                            ) : null;
                          })}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {templates.map((t) => (
              <Link key={t.id} href={`/panel/yeni?sablon=${t.id}`} className="inline-flex items-center gap-1.5 text-body font-semibold text-coral-deep">
                <IconPlus className="size-4" /> Şablonla başla: {t.title}
              </Link>
            ))}
            <Link href="/panel/yeni" className={`inline-flex items-center gap-1.5 text-body font-semibold ${templates.length ? "text-ink-soft" : "text-coral-deep"}`}>
              {templates.length ? null : <IconPlus className="size-4" />} {templates.length ? "Kendi metninle kontrol et" : "Bu dönemin reklamını kontrol et"}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ sektor?: string }> }) {
  await requirePanelUser();
  const [sp, profile] = await Promise.all([searchParams, getRepo().getProfile()]);
  const sector: Sector | null = SECTORS.includes(sp.sektor as Sector) ? (sp.sektor as Sector) : null;
  const today = istanbulToday();
  const events = upcomingEvents({ from: today, days: 365, sector });
  const months = new Map<string, SeasonEvent[]>();
  for (const e of events) {
    const k = e.start.slice(0, 7);
    months.set(k, [...(months.get(k) ?? []), e]);
  }
  const suggested = profile?.defaultSector ?? null;
  const filters: { href: string; label: string; active: boolean }[] = [
    { href: "/panel/takvim", label: "Tüm sektörler", active: sector === null },
    ...SECTORS.map((s) => ({ href: `/panel/takvim?sektor=${s}`, label: SECTOR_LABEL[s], active: sector === s })),
  ];
  const unverified = events.some((e) => !e.verified);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-semibold leading-tight">Sezon takvimi</h1>
          <p className="mt-2 text-ink-soft">
            Önümüzdeki 12 ayın özel gün ve kampanya dönemleri. Her dönem için ne zaman hazırlanman, reklamı ne zaman incelemeye göndermen gerektiği ve dönemin sık rastlanan uyum riskleri.
          </p>
        </div>
        <a href={`/panel/takvim/ics${sector ? `?sektor=${sector}` : ""}`} className={buttonClass("ghost", "h-10")} download>
          <IconCalendar className="size-[18px]" /> Takvimime ekle (.ics)
        </a>
      </div>

      <form action={setSeasonRemindersAction} className="mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-4">
        <input type="hidden" name="on" value={profile?.seasonReminders ? "0" : "1"} />
        <p className="min-w-0 flex-1 basis-64 text-body">
          <span className="font-semibold">Sezon hatırlatma e-postaları {profile?.seasonReminders ? "açık" : "kapalı"}.</span>{" "}
          <span className="text-ink-soft">{profile?.seasonReminders ? "Hazırlık zamanı gelen her dönem için bir e-posta alırsın." : "Hazırlık zamanı geldiğinde e-postayla haber verelim mi?"}</span>
        </p>
        <button type="submit" className={buttonClass(profile?.seasonReminders ? "ghost" : "primary", "h-10")}>
          {profile?.seasonReminders ? "Hatırlatmaları kapat" : "Hatırlatmaları aç"}
        </button>
      </form>

      <nav aria-label="Sektöre göre süz" className="mt-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-small font-semibold no-underline ${f.active ? "bg-ink text-paper" : "border border-line-strong text-ink-soft hover:bg-paper-2 hover:text-ink"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {!sector && suggested ? (
        <p className="mt-3 text-small text-muted">
          Varsayılan sektörün {SECTOR_LABEL[suggested]}. <Link href={`/panel/takvim?sektor=${suggested}`} className="font-semibold text-ink">Yalnızca bu sektörü göster</Link>
        </p>
      ) : null}

      {unverified ? (
        <p className="mt-6 flex max-w-3xl items-start gap-2 rounded-xl bg-amber-tint px-4 py-3 text-small text-amber">
          <IconInfo className="mt-0.5 size-4 shrink-0" />
          <span>Bazı tarihler resmî takvimle doğrulanmadı: dini bayramlar ay takvimine göre değişir ve ikincil kaynaklardan alındı (Diyanet takvimiyle kontrol et); okulların açılış günü MEB çalışma takvimine göre değişir. Planlamadan önce kontrol et.</span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-10">
        {events.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card px-5 py-4 text-ink-soft">Bu sektör için önümüzdeki 12 ayda kayıtlı dönem yok.</p>
        ) : (
          [...months.entries()].map(([month, list]) => (
            <section key={month} aria-labelledby={`ay-${month}`}>
              <h2 id={`ay-${month}`} className="font-display text-2xl font-semibold capitalize">{fmt(`${month}-01`, { month: "long", year: "numeric" })}</h2>
              <div className="mt-4 grid gap-4">
                {list.map((e) => <EventCard key={e.key} e={e} today={today} open={e === events[0]} sector={sector ?? profile?.defaultSector ?? null} />)}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="mt-10 text-meta text-muted">
        <p className="mb-3">Hatırlatmalar bir kontrol listesidir, bulgu değildir. Bağlı kural kartlarının durumu yanında yazar; “Doğrulama bekliyor” ve “Taslak” kartlar ihlal olarak değerlendirilmez.</p>
        <Disclaimer />
      </div>
    </div>
  );
}
