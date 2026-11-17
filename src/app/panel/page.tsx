import Link from "next/link";
import { IconAppeal, IconCalendar, IconPlus } from "@/components/icons";
import { daysUntil, istanbulToday, phaseOf, upcomingEvents } from "@/lib/calendar/season";
import { ButtonLink } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { AnalysisList } from "./analysis-list";
import { rescanAnalyses } from "@/lib/engine/rescan";
import { IconAlert } from "@/components/icons";

export const metadata = { title: "Pano" };

export default async function DashboardPage() {
  await requirePanelUser();
  const repo = getRepo();
  const [profile, balance, analyses, recent, rules] = await Promise.all([repo.getProfile(), repo.getBalance(), repo.listAnalyses(6), repo.listAnalyses(50), repo.listAllRules()]);
  const rescan = rescanAnalyses(recent, rules);
  const completed = analyses.filter((a) => a.status === "completed");
  const highRisk = completed.filter((a) => a.metaRiskLevel === "high" || a.legalRiskLevel === "high").length;
  const name = profile?.displayName?.split(" ")[0];
  const today = istanbulToday();
  const nextSeason = upcomingEvents({ from: today, days: 120, sector: profile?.defaultSector ?? null })[0] ?? null;

  return (
    <div>
      {rescan.length ? (
        <section aria-labelledby="kural-guncel" className="mb-8 rounded-2xl border border-[#e9b43c]/60 bg-amber-tint/50 p-5">
          <h2 id="kural-guncel" className="flex items-center gap-2 text-lg font-bold">
            <IconAlert className="size-5 text-amber" aria-hidden />
            Kurallar güncellendi: {rescan.length} eski reklamında artık yeni risk var
          </h2>
          <p className="mt-1 text-[0.9rem] text-ink-soft">
            Son 50 analizinin metnini bugünkü doğrulanmış kural kartlarıyla yeniden taradık (kredi harcanmadı). Bu reklamlar hâlâ yayındaysa gözden geçir.
          </p>
          <ul className="mt-3 grid gap-2">
            {rescan.slice(0, 5).map((h) => (
              <li key={h.id} className="rounded-xl border border-line bg-card px-4 py-2.5 text-[0.9rem]">
                <Link href={`/panel/analiz/${h.id}`} className="font-semibold">{h.label}</Link>
                <span className="text-muted">
                  {" "}· ret riski {h.oldMeta} → <strong className="text-ink">{h.newMeta}</strong>
                  {h.newLegal > h.oldLegal ? <> · mevzuat bulgusu {h.oldLegal} → <strong className="text-ink">{h.newLegal}</strong></> : null}
                </span>
                {h.titles.length ? <span className="block text-[0.82rem] text-muted">{h.titles.join(" · ")}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">{name ? `Merhaba ${name}.` : "Merhaba."}</h1>
          <p className="mt-2 text-ink-soft">
            <span className="font-semibold text-ink tabular">{balance}</span> analiz kredin var.
            {highRisk > 0 ? ` Son analizlerinden ${highRisk} tanesi yüksek riskli görünüyor.` : ""}
          </p>
        </div>
        <ButtonLink href={balance > 0 ? "/panel/yeni" : "/panel/krediler"} variant="accent" className="h-12 px-6">
          <IconPlus className="size-[18px]" /> {balance > 0 ? "Yeni analiz" : "Kredi yükle"}
        </ButtonLink>
      </div>

      {!profile?.onboardingCompletedAt ? (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-card px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.95rem]"><strong>Sektörünü seç,</strong> raporlar ilgili kural paketiyle gelsin.</p>
          <ButtonLink href="/panel/baslangic" variant="ghost" className="h-10">Başlangıç ayarları</ButtonLink>
        </div>
      ) : null}

      <section className="mt-10" aria-labelledby="son-analizler">
        <div className="flex items-baseline justify-between">
          <h2 id="son-analizler" className="font-display text-2xl font-semibold">Son analizler</h2>
          {analyses.length ? <Link href="/panel/gecmis" className="text-sm font-semibold text-coral-deep">Tümü</Link> : null}
        </div>
        {analyses.length ? (
          <div className="mt-4"><AnalysisList items={analyses} /></div>
        ) : (
          <div className="sheet mt-4 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-display text-2xl font-semibold">Henüz analiz yok.</p>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">İlk reklamını yükle: görsel, ana metin ve sektör yeterli. Sonuç yaklaşık bir dakikada hazır.</p>
            <ButtonLink href="/panel/yeni" variant="primary" className="mt-6">İlk analizi başlat</ButtonLink>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {nextSeason ? (
          <Link href={`/panel/takvim#${nextSeason.key}`} className="group rounded-2xl border border-line bg-card p-5 no-underline hover:border-line-strong">
            <span className="flex items-center gap-2 font-bold text-ink"><IconCalendar className="size-5 text-coral-deep" /> Sıradaki dönem: {nextSeason.name}</span>
            <span className="mt-1.5 block text-[0.93rem] text-ink-soft">
              <span className="tabular">{Math.max(0, daysUntil(nextSeason.start, today))}</span> gün kaldı.{" "}
              {phaseOf(nextSeason, today) === "yayinda" || phaseOf(nextSeason, today) === "incelemeye-gonder"
                ? "Reklam dönemi başladı ya da çok yakın; yayındaki reklamlarını şimdi kontrol et."
                : `Reklamları en geç ${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${nextSeason.submitBy}T12:00:00Z`))} tarihinde incelemeye gönder.`}
            </span>
          </Link>
        ) : null}
        <Link href="/panel/itiraz" className="group rounded-2xl border border-line bg-card p-5 no-underline hover:border-line-strong">
          <span className="flex items-center gap-2 font-bold text-ink"><IconAppeal className="size-5 text-coral-deep" /> Reklamın reddedildi mi?</span>
          <span className="mt-1.5 block text-[0.93rem] text-ink-soft">Ret mesajını yapıştır; itiraz mı yoksa yeni reklam mı daha mantıklı, söyleyelim ve TR + EN taslak hazırlayalım.</span>
        </Link>
        <Link href="/kurallar" className="group rounded-2xl border border-line bg-card p-5 no-underline hover:border-line-strong">
          <span className="font-bold text-ink">Hangi kurallara bakıyoruz?</span>
          <span className="mt-1.5 block text-[0.93rem] text-ink-soft">Her kural kartının kaynağı, yürürlük ve son doğrulama tarihi açık.</span>
        </Link>
      </section>
    </div>
  );
}
