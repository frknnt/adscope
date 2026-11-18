import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { IconAlert, IconAppeal, IconCalendar, IconCheck, IconCoin, IconDoc, IconHistory, IconImage, IconPlus, IconTag, IconUsers, IconVideo } from "@/components/icons";
import { KpiCard } from "@/components/panel-ui";
import { ButtonLink } from "@/components/ui";
import { daysUntil, istanbulToday } from "@/lib/calendar/season";
import { upcomingEvents } from "@/lib/calendar/season";
import { templatesFor } from "@/lib/calendar/templates";
import { getRepo } from "@/lib/data";
import { rescanAnalyses } from "@/lib/engine/rescan";
import { dashboardStats } from "@/lib/panel/reports";
import { requirePanelUser } from "@/app/panel/guard";
import { ReportsView } from "./gecmis/reports-view";

export const metadata = { title: "Pano" };

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });

function QuickTile({ href, title, cost, Icon, text }: { href: string; title: string; cost: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; text: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-line bg-card p-5 no-underline shadow-card transition-colors hover:border-blue/40">
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-tint text-blue" aria-hidden>
          <Icon className="size-5" />
        </span>
        <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-meta font-semibold text-ink-soft">{cost}</span>
      </span>
      <span className="mt-4 font-bold text-ink group-hover:text-blue">{title}</span>
      <span className="mt-1 text-small text-ink-soft">{text}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  await requirePanelUser();
  const repo = getRepo();
  const [profile, balance, recent, rules, brands, team] = await Promise.all([repo.getProfile(), repo.getBalance(), repo.listAnalyses(200), repo.listAllRules(), repo.listBrands(), repo.getTeam()]);
  const rescan = rescanAnalyses(recent.slice(0, 50), rules);
  const stats = dashboardStats(recent, new Date());
  const name = profile?.displayName?.split(" ")[0];
  const today = istanbulToday();
  const seasons = upcomingEvents({ from: today, days: 120, sector: profile?.defaultSector ?? null }).slice(0, 3);
  const firstRun = recent.length === 0;
  const brandNames = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  const status = firstRun
    ? "İlk reklamını kontrol etmeye hazırsın."
    : stats.highRisk > 0
      ? `${stats.highRisk} raporda yüksek risk var. Yayına almadan önce gözden geçir.`
      : "Son raporlarında yüksek risk görünmüyor.";

  const steps = [
    { done: brands.length > 0, title: "Marka ekle", text: "Ton, yasaklı kelimeler ve logo raporlara yansır.", href: "/panel/markalar", Icon: IconTag },
    { done: false, title: "İlk kontrol", text: "Görsel, ana metin ve sektör yeterli; yaklaşık bir dakika.", href: "/panel/yeni", Icon: IconPlus },
    { done: false, title: "Raporu indir", text: "Markalı PDF ya da varyant tablosu olarak dışa aktar.", href: "/panel/yeni", Icon: IconDoc },
    { done: team.members.length + team.invites.length > 0, title: "Ekibini davet et", text: "Ekip üyeleri raporları görür, kredi harcamaz.", href: "/panel/ekip", Icon: IconUsers },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">{name ? `Merhaba ${name}.` : "Merhaba."}</h1>
          <p className="mt-2 text-ink-soft">{status}</p>
        </div>
        {balance > 0 ? null : (
          <ButtonLink href="/panel/krediler" variant="accent" className="h-12 px-6">
            <IconCoin className="size-[18px]" /> Kredi yükle
          </ButtonLink>
        )}
      </div>

      <section aria-label="Özet">
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <li><KpiCard label="Kalan kredi" value={balance} unit="analiz" Icon={IconCoin} tone={balance <= 2 ? "warn" : "default"} href="/panel/krediler" hint={balance <= 2 ? "Azaldı: kredi al" : "Krediler sayfasına git"} /></li>
          <li><KpiCard label="Bu ay yapılan analiz" value={firstRun ? null : stats.thisMonth} Icon={IconHistory} hint="İstanbul saatiyle bu takvim ayı" /></li>
          <li><KpiCard label="Ortalama ret riski" value={stats.avgRisk} unit="/ 100" Icon={IconAlert} tone={stats.avgRisk !== null && stats.avgRisk >= 60 ? "risk" : "default"} hint="Son 10 tamamlanmış analiz" /></li>
          <li><KpiCard label="Yüksek riskli rapor" value={firstRun ? null : stats.highRisk} Icon={IconAlert} tone={stats.highRisk ? "risk" : "default"} href={stats.highRisk ? "/panel/gecmis?risk=high" : undefined} hint="Meta ya da mevzuat düzeyi yüksek" /></li>
        </ul>
      </section>

      {rescan.length ? (
        <section aria-labelledby="kural-guncel" className="rounded-2xl border border-amber/30 bg-amber-tint p-5">
          <h2 id="kural-guncel" className="flex items-center gap-2 text-lg font-bold">
            <IconAlert className="size-5 text-amber" aria-hidden />
            Kurallar güncellendi: {rescan.length} eski reklamında artık yeni risk var
          </h2>
          <p className="mt-1 text-body text-ink-soft">
            Son 50 analizinin metnini bugünkü doğrulanmış kural kartlarıyla yeniden taradık (kredi harcanmadı). Bu reklamlar hâlâ yayındaysa gözden geçir.
          </p>
          <ul className="mt-3 grid gap-2">
            {rescan.slice(0, 5).map((h) => (
              <li key={h.id} className="rounded-xl border border-line bg-card px-4 py-2.5 text-body">
                <Link href={`/panel/analiz/${h.id}`} className="font-semibold">{h.label}</Link>
                <span className="text-muted">
                  {" "}· ret riski {h.oldMeta} → <strong className="text-ink">{h.newMeta}</strong>
                  {h.newLegal > h.oldLegal ? <> · mevzuat bulgusu {h.oldLegal} → <strong className="text-ink">{h.newLegal}</strong></> : null}
                </span>
                {h.titles.length ? <span className="block text-meta text-muted">{h.titles.join(" · ")}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {firstRun ? (
        <section aria-labelledby="baslangic" className="rounded-2xl border border-line bg-card p-6 shadow-card">
          <h2 id="baslangic" className="font-display text-2xl font-semibold">Başlarken</h2>
          <p className="mt-1 text-ink-soft">
            {steps.filter((s) => s.done).length} / {steps.length} adım tamamlandı.
          </p>
          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className={`flex h-full items-start gap-4 rounded-xl border p-4 no-underline ${s.done ? "border-green/25 bg-green-tint" : "border-line hover:border-line-strong"}`}>
                  <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-small font-bold ${s.done ? "bg-green text-paper" : "bg-paper-2 text-ink"}`} aria-hidden>
                    {s.done ? <IconCheck className="size-4" /> : i + 1}
                  </span>
                  <span>
                    <span className="block font-bold text-ink">
                      {s.title}
                      <span className="sr-only">{s.done ? " (tamamlandı)" : " (yapılmadı)"}</span>
                    </span>
                    <span className="mt-0.5 block text-small text-ink-soft">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {!profile?.onboardingCompletedAt ? (
            <p className="mt-5 text-body text-ink-soft">
              <strong className="text-ink">Sektörünü seç,</strong> raporlar ilgili kural paketiyle gelsin. <Link href="/panel/baslangic" className="font-semibold">Başlangıç ayarları</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="hizli-baslat">
        <h2 id="hizli-baslat" className="font-display text-2xl font-semibold">Hızlı başlat</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickTile href="/panel/yeni" title="Görsel kontrol" cost="1 kredi" Icon={IconImage} text="Görsel ve metni Meta, Google Ads, TikTok ve Türk mevzuatına göre tara." />
          <QuickTile href="/panel/yeni?tur=video" title="Video / Reels kontrol" cost="2 kredi" Icon={IconVideo} text="Kanca, altyazı, güvenli alan ve konuşma metni incelemesi." />
          <QuickTile href="/panel/toplu" title="Toplu kontrol" cost="Kredisiz" Icon={IconDoc} text="Birden çok reklam metnini tek seferde kural motoruyla tara." />
          <QuickTile href="/panel/itiraz" title="İtiraz taslağı" cost="Kredisiz" Icon={IconAppeal} text="Ret mesajını yapıştır, TR ve EN itiraz taslağını al." />
        </div>
      </section>

      {!firstRun ? (
        <section aria-labelledby="son-raporlar">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="son-raporlar" className="font-display text-2xl font-semibold">Son raporlar</h2>
            <Link href="/panel/gecmis" className="font-semibold text-blue">Tümünü gör</Link>
          </div>
          <div className="mt-4">
            <ReportsView items={recent.slice(0, 6)} view="izgara" brands={brandNames} selectable={false} />
          </div>
        </section>
      ) : null}

      {seasons.length ? (
        <section aria-labelledby="sezon">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="sezon" className="font-display text-2xl font-semibold">Yaklaşan sezon günleri</h2>
            <Link href="/panel/takvim" className="inline-flex min-h-11 items-center font-semibold text-blue">Takvim</Link>
          </div>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {seasons.map((e, i) => {
              const tpl = templatesFor(e.id, profile?.defaultSector ?? null)[0];
              const left = Math.max(0, daysUntil(e.start, today));
              return (
                <li key={e.key} className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-card">
                  <span className="flex items-center gap-2 text-meta font-semibold text-muted">
                    <IconCalendar className="size-4 text-blue" aria-hidden />
                    <span>
                      {dayFmt.format(new Date(`${e.start}T12:00:00Z`))} · <span className="tabular">{left}</span> gün kaldı
                    </span>
                  </span>
                  <span className="mt-2 font-bold text-ink">{i === 0 ? `Sıradaki dönem: ${e.name}` : e.name}</span>
                  <span className="mt-1 text-small text-ink-soft">En geç {dayFmt.format(new Date(`${e.submitBy}T12:00:00Z`))} tarihinde incelemeye gönder.</span>
                  <Link href={tpl ? `/panel/yeni?sablon=${tpl.id}` : `/panel/takvim#${e.key}`} className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-3 font-semibold text-blue">
                    <IconPlus className="size-4" aria-hidden /> {tpl ? "Şablonla başla" : "Dönemi incele"}
                    <span className="sr-only">: {e.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
