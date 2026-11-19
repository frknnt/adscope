import Link from "next/link";
import type { ReactNode } from "react";
import { HighlightedText } from "@/components/highlighted-text";
import { LandingPlatformVariants } from "@/components/landing-platform-variants";
import {
  IconAlert,
  IconAppeal,
  IconBoard,
  IconCalendar,
  IconCheck,
  IconDoc,
  IconKey,
  IconPen,
  IconScale,
  IconUpload,
  IconUsers,
  IconVideo,
} from "@/components/icons";
import { Tabs } from "@/components/interactive";
import { LevelPill, ScaleBar } from "@/components/risk";
import { ButtonLink, Disclaimer } from "@/components/ui";
import { CREDIT_PACKAGES, formatTry } from "@/lib/payments/packages";
import { RULE_CATALOG } from "@/lib/rules/catalog";
import { SAMPLE_AD, sampleReport } from "@/lib/sample";
import { getRepo } from "@/lib/data";
import { buildGuide, GUIDE_SLUGS, type GuideSlug } from "@/lib/guides/guides";
import { SECTOR_IDS, SECTOR_INFO } from "@/lib/sectors";
import { QuickCheck } from "./reklamim-reddedilir-mi/quick-check";

type Report = Awaited<ReturnType<typeof sampleReport>>;

const WRAP = "mx-auto max-w-[75rem] px-5 sm:px-6";

function Eyebrow({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "light" }) {
  return (
    <p
      className={`inline-flex rounded-full px-3 py-1 text-fine font-bold uppercase tracking-[0.08em] ${tone === "blue" ? "bg-blue-tint text-blue" : "bg-paper/10 text-paper"}`}
    >
      {children}
    </p>
  );
}

function SectionHead({ eyebrow, title, lead, center = false }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] text-ink sm:text-[2.6rem]">{title}</h2>
      {lead ? <p className="mt-4 text-lg leading-relaxed text-ink-soft">{lead}</p> : null}
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-tint text-blue">
        <IconCheck width={14} height={14} strokeWidth={2.5} />
      </span>
      <span className="text-ink-soft">{children}</span>
    </li>
  );
}

/** Browser-window frame for product mockups. */
function Frame({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-2xl border border-line bg-card shadow-raised ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-line bg-paper-2 px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 truncate rounded-md bg-card px-3 py-0.5 text-fine text-muted">adscope.com.tr/panel</span>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="p-5 sm:p-6">{children}</div>
    </figure>
  );
}

/* ---------- Hero collage: AdScope's own sample creatives, drawn in HTML ---------- */

type Ad = { brand: string; title: string; cta: string; bg: string; product: string; ratio: string };

function AdCard({ ad, className = "", style, children }: { ad: Ad; className?: string; style?: React.CSSProperties; children?: ReactNode }) {
  return (
    <div className={`absolute overflow-hidden rounded-2xl shadow-raised ring-1 ring-black/5 ${className}`} style={{ aspectRatio: ad.ratio, background: ad.bg, ...style }}>
      <div className="flex h-full flex-col p-3.5 text-left">
        <p className="text-fine font-bold uppercase tracking-[0.08em] text-ink/70">{ad.brand}</p>
        <p className="mt-1 text-[0.95rem] font-extrabold leading-tight text-ink">{ad.title}</p>
        <div className="relative flex flex-1 items-center justify-center">
          <span className="block h-[58%] w-[34%] rounded-[0.9rem] shadow-[0_14px_24px_-12px_rgb(11_27_63/.45)]" style={{ background: ad.product }} />
        </div>
        <span className="self-start rounded-lg bg-ink px-2.5 py-1 text-fine font-bold text-paper">{ad.cta}</span>
      </div>
      {children}
    </div>
  );
}

function Chip({ children, className = "", tone = "white" }: { children: ReactNode; className?: string; tone?: "white" | "red" | "green" }) {
  const t = tone === "red" ? "bg-coral-tint text-coral-deep" : tone === "green" ? "bg-green-tint text-green" : "bg-card text-ink";
  return <span className={`float-chip absolute z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-meta font-bold shadow-raised ring-1 ring-black/5 ${t} ${className}`}>{children}</span>;
}

const ADS: Ad[] = [
  { brand: "Vita+", title: "Günlük magnezyum desteğin", cta: "İncele", bg: "linear-gradient(160deg,#e3f4ec,#c5e8d6)", product: "linear-gradient(180deg,#13703a,#0e5a2e)", ratio: "4/5" },
  { brand: "Lumé", title: "C vitaminli bakım serumu", cta: "Keşfet", bg: "linear-gradient(160deg,#fde9df,#f8d3c3)", product: "linear-gradient(180deg,#f29a72,#d9704a)", ratio: "1/1" },
  { brand: "Kodla Akademi", title: "Ekim grubu kayıtları açık", cta: "Başvur", bg: "linear-gradient(170deg,#e6ecff,#c9d6ff)", product: "linear-gradient(180deg,#2456e6,#1d3a7a)", ratio: "9/16" },
  { brand: "Mavi Ev", title: "Deniz manzaralı 2+1", cta: "Bilgi al", bg: "linear-gradient(160deg,#e4f3f8,#c7e5ef)", product: "linear-gradient(180deg,#2c8fb0,#1b6d88)", ratio: "1/1" },
];

function HeroCollage({ report }: { report: Report }) {
  return (
    <div className="relative mx-auto h-[25rem] w-full max-w-[34rem] sm:h-[32rem]" aria-hidden>
      <div className="absolute inset-[6%] rounded-[2.5rem] bg-tint" />
      <AdCard ad={ADS[2]} className="left-[1%] top-[3%] w-[27%] -rotate-3" />
      <AdCard ad={ADS[1]} className="right-[2%] top-[1%] w-[31%] rotate-2" />
      <AdCard ad={ADS[3]} className="bottom-0 left-[4%] w-[28%] rotate-1" />
      <AdCard ad={ADS[0]} className="bottom-0 right-[4%] w-[27%] -rotate-2" />
      {/* The risky sample ad, the one the engine actually scored */}
      <div className="absolute left-1/2 top-[46%] z-10 w-[64%] -translate-x-1/2 -translate-y-1/2 sm:w-[50%] rounded-2xl bg-card p-4 shadow-float ring-1 ring-black/5">
        <p className="text-fine font-bold uppercase tracking-[0.08em] text-muted">Örnek reklam · takviye gıda</p>
        <p className="mt-2 text-small font-semibold leading-snug text-ink">
          <HighlightedText text={SAMPLE_AD.primaryText} marks={report.findings.map((f) => ({ text: f.matched_text, severity: f.severity }))} />
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-fine font-semibold text-muted">Meta ret riski</span>
          <LevelPill level={report.meta_risk_level} />
        </div>
      </div>
      <Chip tone="red" className="left-[30%] top-[8%] sm:left-[33%]">
        <IconAlert width={14} height={14} /> Ret riski {report.meta_risk_score}/100
      </Chip>
      <Chip className="bottom-[33%] left-0 sm:-left-3">
        <IconScale width={14} height={14} /> {report.legal_finding_count} mevzuat bulgusu
      </Chip>
      <Chip tone="green" className="bottom-[41%] right-0 sm:-right-3">
        <IconCheck width={14} height={14} /> Güvenli metin hazır
      </Chip>
    </div>
  );
}

/* ---------- Mockups ---------- */

function ScoreTrio({ report }: { report: Report }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-line p-4">
        <dt className="text-meta font-semibold text-muted">Meta ret riski</dt>
        <dd className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-3xl font-extrabold tabular text-ink">{report.meta_risk_score}</span>
          <LevelPill level={report.meta_risk_level} />
        </dd>
        <dd><ScaleBar value={report.meta_risk_score} label="Meta ret riski" /></dd>
      </div>
      <div className="rounded-xl border border-line p-4">
        <dt className="text-meta font-semibold text-muted">Mevzuat riski</dt>
        <dd className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-3xl font-extrabold tabular text-ink">
            {report.legal_finding_count}
            <span className="ml-1 text-small font-semibold text-muted">bulgu</span>
          </span>
          <LevelPill level={report.legal_risk_level} />
        </dd>
        <dd className="mt-3 text-meta text-ink-soft">Her bulgu kaynaklı bir kural kartına bağlı.</dd>
      </div>
      <div className="rounded-xl border border-line p-4">
        <dt className="text-meta font-semibold text-muted">Kreatif skoru</dt>
        <dd className="mt-1 text-3xl font-extrabold tabular text-ink">
          {report.creative_score}
          <span className="ml-1 text-small font-semibold text-muted">/ 100</span>
        </dd>
        <dd><ScaleBar value={report.creative_score} invert label="Kreatif skoru" /></dd>
      </div>
    </dl>
  );
}

function FindingsList({ report, limit = 3 }: { report: Report; limit?: number }) {
  return (
    <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
      {report.findings.slice(0, limit).map((f, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${f.severity === "red" ? "bg-coral" : f.severity === "yellow" ? "bg-caution" : "bg-blue"}`} aria-hidden />
          <span className="text-small">
            <strong className="font-bold text-ink">“{f.matched_text}”</strong>
            <span className="text-ink-soft"> · {f.title}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function UploadMock() {
  return (
    <Frame label="Yeni analiz ekranı">
      <div className="flex flex-wrap gap-2 text-meta font-semibold" aria-hidden>
        {["Kreatif", "Metin", "Sektör", "Beyanlar", "Kontrol"].map((s, i) => (
          <span key={s} className={`rounded-full px-2.5 py-1 ${i === 1 ? "bg-ink text-paper" : i < 1 ? "bg-paper-2 text-ink" : "text-muted"}`}>
            {i + 1} {s}
          </span>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[9rem_1fr]">
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-paper-2 text-meta font-semibold text-muted">
          <IconUpload />
          Görsel / video
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-meta font-semibold text-ink">Platform</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-meta font-semibold">
              <span className="rounded-lg bg-ink px-2.5 py-1 text-paper">Meta</span>
              <span className="rounded-lg border border-line px-2.5 py-1 text-ink">Google Ads</span>
              <span className="rounded-lg border border-line px-2.5 py-1 text-ink">TikTok</span>
            </div>
          </div>
          <div>
            <p className="text-meta font-semibold text-ink">Ana metin</p>
            <p className="mt-1.5 rounded-xl border border-line-strong px-3 py-2 text-small text-ink-soft">{SAMPLE_AD.primaryText}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-blue-tint px-3 py-2 text-meta font-semibold text-blue">
            <span className="size-2 rounded-full bg-blue motion-safe:animate-pulse" /> 63 kural kartıyla taranıyor
          </div>
        </div>
      </div>
    </Frame>
  );
}

function SafeTextMock({ report }: { report: Report }) {
  const variants = report.variants.filter((v) => v.kind === "variant").slice(0, 2);
  const safe = report.variants.find((v) => v.kind === "safe");
  return (
    <Frame label="Güvenli metin ve varyantlar">
      <p className="text-fine font-bold uppercase tracking-[0.08em] text-coral-deep">Önce</p>
      <p className="mt-1.5 rounded-xl bg-paper-2 p-3 text-small leading-relaxed text-ink">
        <HighlightedText text={SAMPLE_AD.primaryText} marks={report.findings.map((f) => ({ text: f.matched_text, severity: f.severity }))} />
      </p>
      <p className="mt-4 text-fine font-bold uppercase tracking-[0.08em] text-green">Sonra</p>
      <p className="mt-1.5 rounded-xl border border-green/25 bg-green-tint p-3 text-small leading-relaxed text-ink">{report.safe_text}</p>
      {safe ? (
        <p className="mt-2 flex items-center gap-1.5 text-meta font-semibold text-green">
          <IconCheck width={14} height={14} /> Aynı kurallarla yeniden tarandı: {safe.recheck_red} kırmızı, {safe.recheck_yellow} sarı bayrak
        </p>
      ) : null}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {variants.map((v) => (
          <li key={v.position} className="rounded-xl border border-line p-3">
            <p className="text-fine font-bold uppercase tracking-[0.08em] text-muted">Varyant · {v.tone}</p>
            <p className="mt-1 text-small font-bold text-ink">{v.headline}</p>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function VideoMock() {
  const frames = [
    { t: "0:00", label: "Kanca", bg: "linear-gradient(170deg,#1d3a7a,#2456e6)" },
    { t: "0:02", label: "Ürün", bg: "linear-gradient(170deg,#2c8fb0,#13285a)" },
    { t: "0:06", label: "Teklif", bg: "linear-gradient(170deg,#0b1b3f,#1d3a7a)" },
  ];
  return (
    <Frame label="Video ve Reels analizi">
      <div className="grid grid-cols-3 gap-3" aria-hidden>
        {frames.map((f) => (
          <div key={f.t} className="relative aspect-[9/16] overflow-hidden rounded-xl" style={{ background: f.bg }}>
            <div className="absolute inset-x-[8%] bottom-[18%] top-[12%] rounded-md border border-dashed border-paper/60" />
            <span className="absolute left-2 top-2 rounded-md bg-paper/90 px-1.5 text-fine font-bold tabular text-ink">{f.t}</span>
            <span className="absolute inset-x-0 bottom-[24%] text-center text-meta font-extrabold text-paper">{f.label}</span>
          </div>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 text-small">
        <li className="flex items-center justify-between rounded-xl bg-green-tint px-3 py-2 font-semibold text-green">
          Altyazı güvenli alanda <IconCheck width={16} height={16} />
        </li>
        <li className="flex items-center justify-between rounded-xl bg-amber-tint px-3 py-2 font-semibold text-amber">
          İlk 3 saniyede marka görünmüyor <IconAlert width={16} height={16} />
        </li>
        <li className="flex items-center justify-between rounded-xl bg-paper-2 px-3 py-2 font-semibold text-ink">
          Dış ses metni kurallarla tarandı <IconCheck width={16} height={16} />
        </li>
      </ul>
    </Frame>
  );
}

function AppealMock() {
  return (
    <Frame label="İtiraz asistanı">
      <div className="flex items-center justify-between gap-3">
        <p className="text-small font-bold text-ink">İtiraz taslağı</p>
        <span className="flex gap-1 text-meta font-bold">
          <span className="rounded-lg bg-ink px-2 py-0.5 text-paper">TR</span>
          <span className="rounded-lg border border-line px-2 py-0.5 text-ink">EN</span>
        </span>
      </div>
      <p className="mt-3 rounded-xl bg-paper-2 p-4 text-small leading-relaxed text-ink-soft">
        Merhaba, reklamımız &ldquo;Kişisel Sağlık ve Görünüm&rdquo; politikası gerekçesiyle reddedildi. Metindeki kilo kaybı süresi ve sonuç vaadi kaldırıldı; ürün yalnızca günlük beslenmeye destek olarak tanıtılıyor. Güncel metni yeniden incelemenizi rica ederiz.
      </p>
      <div className="mt-4 rounded-xl border border-line p-3">
        <p className="text-meta font-bold text-ink">Önerimiz</p>
        <p className="mt-1 text-small text-ink-soft">Önce düzeltilmiş yeni reklam, sonra itiraz. Kontrol listesi: 3 / 5 tamam.</p>
      </div>
    </Frame>
  );
}

function ReportMock({ report }: { report: Report }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-float">
      <div className="grid md:grid-cols-[13rem_1fr]">
        <aside className="hidden border-r border-line bg-paper-2 p-5 md:block" aria-hidden>
          <p className="text-small font-extrabold text-ink">AdScope</p>
          <ul className="mt-5 space-y-1 text-meta font-semibold text-ink-soft">
            {["Pano", "Yeni analiz", "Geçmiş", "İtiraz asistanı", "Sezon takvimi", "Markalar"].map((x, i) => (
              <li key={x} className={`rounded-lg px-3 py-2 ${i === 2 ? "bg-card text-ink shadow-card" : ""}`}>{x}</li>
            ))}
          </ul>
        </aside>
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-meta font-semibold text-muted">Rapor · {SAMPLE_AD.headline} · Meta</p>
              <p className="mt-1 text-xl font-extrabold text-ink sm:text-2xl">Yayından önce 3 ifadeyi düzelt</p>
            </div>
            <span className="rounded-lg border border-line px-3 py-1.5 text-meta font-semibold text-ink">PDF indir</span>
          </div>
          <div className="mt-6">
            <ScoreTrio report={report} />
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-small font-bold text-ink">Bulgular</p>
              <FindingsList report={report} limit={4} />
            </div>
            <div className="rounded-xl border border-blue/20 bg-blue-tint p-4">
              <p className="text-small font-bold text-ink">Önce bunu düzelt</p>
              <p className="mt-2 text-small leading-relaxed text-ink-soft">{report.safe_text}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Content ---------- */

const NEEDS = [
  {
    title: "Reklamım reddedildi",
    points: ["Ret mesajını yapıştır, hangi politikaya takıldığını gör.", "İtiraz mı yeni reklam mı daha mantıklı, öneri al.", "Türkçe ve İngilizce itiraz taslağını kopyala."],
    cta: { href: "/kayit", label: "İtiraz taslağı hazırla" },
    get: ["Politika eşleşmesi", "TR + EN itiraz metni", "Düzeltilmiş reklam metni"],
  },
  {
    title: "Yeni reklam hazırlıyorum",
    points: ["Görselini ve metnini yayından önce kontrol et.", "Riskli ifadelerin yerine güvenli öneriler al.", "5 doğal Türkçe varyantla test et."],
    cta: { href: "/kayit", label: "İlk kontrolü yap" },
    get: ["Ret riski skoru", "Mevzuat bulguları", "Güvenli metin + 5 varyant"],
  },
  {
    title: "Ajansım, çok markam var",
    points: ["Her marka için ton ve yasaklı kelime listesi.", "Ekibine salt okunur erişim, avukatına inceleme bağlantısı ver.", "Logolu PDF raporu müşterine gönder."],
    cta: { href: "/fiyatlandirma", label: "Ajans paketini incele" },
    get: ["Çoklu marka", "10 kişilik ekip", "Logolu PDF ve API"],
  },
  {
    title: "Hesabım kısıtlandı",
    points: ["Adım adım kısıtlama rehberini izle.", "Kısıtlamaya yol açan reklamları yeniden tara.", "Yeni reklamları yayından önce kontrol ederek tekrarı önle."],
    cta: { href: "/kayit", label: "Rehberi aç" },
    get: ["8 adımlı kontrol listesi", "Toplu yeniden tarama", "İtiraz taslağı"],
  },
];

const ALL = [
  { Icon: IconScale, title: "Reklam ön kontrolü", desc: "Meta, Google Ads, TikTok politikaları ve Türk reklam mevzuatı tek raporda." },
  { Icon: IconVideo, title: "Video ve Reels analizi", desc: "Kareler, kanca, altyazı güvenli alanı ve dış ses metni.", isNew: false },
  { Icon: IconAppeal, title: "İtiraz asistanı", desc: "Ret mesajından politika eşleşmesi, TR + EN itiraz taslağı." },
  { Icon: IconCalendar, title: "Sezon takvimi", desc: "Türkiye'ye özel kampanya günleri, hazır şablonlar ve hatırlatma." },
  { Icon: IconDoc, title: "Toplu kontrol", desc: "20 reklamı tek seferde tara, riskliden güvenliye sırala.", isNew: true },
  { Icon: IconBoard, title: "İlham panosu", desc: "Uzun süre yayında kalan reklamları incele, kendi metnini kontrol et.", isNew: true },
  { Icon: IconUsers, title: "Ajans modu", desc: "Çoklu marka, salt okunur ekip, avukat inceleme bağlantısı." },
  { Icon: IconKey, title: "API ve Chrome eklentisi", desc: "Kontrolü kendi araçlarına ve tarayıcına taşı." },
  { Icon: IconPen, title: "WhatsApp / DM şablonu", desc: "Reklamdan gelen mesajlara kurallardan geçmiş ilk yanıt." },
];

const FAQ: [string, ReactNode][] = [
  [
    "AdScope reklamımın onaylanacağını garanti ediyor mu?",
    "Hayır. AdScope bir risk değerlendirmesidir, hukuki görüş değildir. Platformların kendi inceleme sistemleri ve mevzuatın yorumu değişebilir; AdScope riskleri yayından önce görmeni ve düzeltmeni sağlar.",
  ],
  [
    "Bulgular neye dayanıyor?",
    <>
      Her bulgu sürümlü bir kural kartına bağlıdır: kaynak kurum, resmî bağlantı, yürürlük ve son doğrulama tarihi. Resmî kaynaktan doğrulanamayan kartlar yalnızca bilgilendirme olarak gösterilir.{" "}
      <Link href="/kurallar" className="font-semibold text-blue">Kural kartlarını gör</Link>
    </>,
  ],
  [
    "Genel bir sohbet botuna sorsam olmaz mı?",
    "Sohbet botları kaynak göstermeyebilir ve aynı reklama farklı cevaplar verebilir. AdScope'un kural motoru aynı girdiye aynı sonucu verir, her bulguyu kaynağına bağlar ve rapor, güvenli metin, varyant ve itiraz taslağını birlikte üretir.",
  ],
  ["Hangi platformları destekliyor?", "Meta (Facebook, Instagram), Google Ads ve TikTok. Türk reklam mevzuatı kontrolleri platformdan bağımsız çalışır."],
  ["Kredi nasıl düşüyor?", "Görsel analizi 1, video/Reels analizi 2 kredidir. Kredi yalnızca rapor başarıyla tamamlandığında düşer. Abonelik yoktur; kayıtta 3 analiz ücretsizdir."],
  ["Yüklediğim reklamlar ne oluyor?", "İçeriklerin model eğitiminde kullanılmaz, saklama süresini sen seçersin ve istediğinde silebilirsin. Ayrıntılar gizlilik politikasında."],
];

export default async function HomePage() {
  const report = await sampleReport();
  const activeCount = RULE_CATALOG.filter((r) => r.status === "active").length;
  const sources = [...new Set(RULE_CATALOG.map((r) => r.sourceOrg))].slice(0, 8);
  const sectors = SECTOR_IDS.filter((s) => s !== "genel");
  const rules = await getRepo().listAllRules();
  const guides = (Object.keys(GUIDE_SLUGS) as GuideSlug[]).map((slug) => {
    const g = buildGuide(slug, rules);
    return { slug, label: g.label, short: SECTOR_INFO[g.sector].label, risky: g.risky.slice(0, 3), safe: g.safe.slice(0, 2) };
  });
  const featuredId = "profesyonel";

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60rem_28rem_at_70%_-10%,var(--blue-tint),transparent_70%)]" aria-hidden />
        <div className={`${WRAP} relative grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20`}>
          <div className="reveal">
            <Eyebrow>Türkiye&apos;ye özel reklam ön kontrolü</Eyebrow>
            <h1 className="mt-5 font-display text-[2.4rem] leading-[1.04] text-ink sm:text-[3.4rem] lg:text-[3.75rem]">
              Reklamını yayınlamadan önce <span className="text-gradient">riskini gör.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft sm:text-[1.2rem]">
              Meta, Google Ads ve TikTok politikaları ile Türk reklam mevzuatına göre kontrol et. Riskli ifadeyi düzelt, beş varyant al, reddedilirse itirazını hazırla.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/kayit" variant="primary" className="px-6 text-base">
                Ücretsiz başla
              </ButtonLink>
              <ButtonLink href="#dene" variant="ghost" className="px-6 text-base">
                Kayıt olmadan dene
              </ButtonLink>
            </div>
            <p className="mt-5 text-small font-medium text-muted">Kart gerekmez · 3 ücretsiz analiz · İçeriğin model eğitiminde kullanılmaz</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-6">
              <span className="text-meta font-semibold text-muted">Kontrol edilen platformlar</span>
              <ul className="flex flex-wrap gap-2">
                {["Meta", "Instagram", "Google Ads", "TikTok"].map((p) => (
                  <li key={p} className="rounded-lg border border-line bg-card px-3 py-1.5 text-meta font-bold text-ink shadow-card">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="reveal" style={{ animationDelay: "120ms" }}>
            <HeroCollage report={report} />
          </div>
        </div>
      </section>

      {/* Live mini check: the same rule engine as the free check page, nothing is stored */}
      <section id="dene" aria-labelledby="dene-baslik" className="scroll-mt-24 border-y border-line bg-paper-2 py-16 lg:py-20">
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start`}>
          <div>
            <Eyebrow>Kayıt olmadan dene</Eyebrow>
            <h2 id="dene-baslik" className="mt-4 font-display text-[2rem] leading-tight text-ink sm:text-[2.5rem]">Metnini yapıştır, riskli ifadeleri hemen gör.</h2>
            <p className="mt-4 max-w-md text-body leading-relaxed text-ink-soft">
              Bu kutu kural motorunu doğrudan çalıştırır. Yapay zekâ kullanılmaz, metnin kaydedilmez. Görsel, video ve açılış sayfası kontrolü ücretsiz hesapla açılır.
            </p>
            <ul className="mt-6 grid gap-3">
              <Check>Kaynaklı kural kartlarına göre işaretler</Check>
              <Check>Doğrulanmamış kurallar yalnızca dikkat düzeyinde kalır</Check>
              <Check>Daha güvenli bir yazım önerir</Check>
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-card p-5 shadow-card sm:p-7">
            <QuickCheck />
          </div>
        </div>
      </section>

      {/* Sector picker: risky wordings come from each sector's rule cards */}
      <section aria-labelledby="sektorler" className={`${WRAP} py-20 lg:py-28`}>
        <SectionHead eyebrow="Sektörüne göre" title={<span id="sektorler">Sektörünü seç, sık görülen riskleri gör.</span>} lead="Örnekler kural kartlarındaki riskli ifadelerden, daha güvenli yazımlar ürünün kendi düzeltme motorundan gelir." />
        <div className="mt-10">
          <Tabs
            label="Sektör seç"
            tabs={guides.map((g) => ({
              title: g.short,
              content: (
                <div className="grid gap-6 pt-6 lg:grid-cols-2">
                  <div>
                    <h3 className="text-small font-bold uppercase tracking-[0.06em] text-coral-deep">Riskli ifadeler</h3>
                    <ul className="mt-3 grid gap-2">
                      {g.risky.map((r) => (
                        <li key={r.text} className="rounded-xl border border-line bg-card px-4 py-3 text-body text-ink">
                          “{r.text}”{r.verified ? null : <span className="ml-2 text-meta font-semibold text-muted">(kaynak doğrulanmadı)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-small font-bold uppercase tracking-[0.06em] text-green">Daha güvenli yazım</h3>
                    <ul className="mt-3 grid gap-2">
                      {g.safe.map((r) => (
                        <li key={r.from} className="rounded-xl border border-line bg-card px-4 py-3 text-body">
                          <span className="block text-small text-muted line-through">{r.from}</span>
                          <span className="mt-1 block text-ink">{r.to}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/rehber/${g.slug}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-blue">
                      {g.label} rehberinin tamamı
                    </Link>
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      </section>

      {/* Platform AI variants: paste them and check against Turkish ad rules (P9.3) */}
      <LandingPlatformVariants />

      {/* Needs selector */}
      <section id="ihtiyac" className={`${WRAP} scroll-mt-24 py-20 lg:py-28`}>
        <SectionHead center eyebrow="Senin durumun" title="Bugün neye ihtiyacın var?" lead="Durumunu seç, AdScope'un o an ne yapacağını gör." />
        <div className="mx-auto mt-10 max-w-4xl">
          <Tabs
            label="Kullanım durumları"
            tabs={NEEDS.map((n) => ({
              title: n.title,
              content: (
                <div className="grid gap-6 rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8 md:grid-cols-[1.3fr_1fr]">
                  <div>
                    <ul className="space-y-3.5">
                      {n.points.map((p) => (
                        <Check key={p}>{p}</Check>
                      ))}
                    </ul>
                    <ButtonLink href={n.cta.href} variant="primary" className="mt-7">
                      {n.cta.label}
                    </ButtonLink>
                  </div>
                  <div className="rounded-2xl bg-tint p-5">
                    <p className="text-fine font-bold uppercase tracking-[0.08em] text-navy-700">Elinde ne olur?</p>
                    <ul className="mt-3 space-y-2">
                      {n.get.map((g) => (
                        <li key={g} className="rounded-xl bg-card px-3.5 py-2.5 text-small font-semibold text-ink shadow-card">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      </section>

      {/* Feature blocks */}
      <section className="bg-paper-2 py-20 lg:py-28">
        <div className={`${WRAP} space-y-24 lg:space-y-32`}>
          {[
            {
              id: "kontrol",
              eyebrow: "Kontrol et",
              title: "Bir dakikada üç soruya cevap",
              lead: "Meta bu reklamı reddeder mi, Türk reklam mevzuatı açısından riskli bir şey var mı, kreatif iyi performans gösterir mi?",
              points: ["0-100 ret riski skoru ve risk düzeyi", "İndirim beyanı, sağlık beyanı, yapay zekâ karakteri gibi mevzuat kontrolleri", "Sektör paketleri: takviye gıda, estetik, kozmetik, kurs, emlak, finans"],
              visual: <UploadMock />,
            },
            {
              id: "guvenli-metin",
              eyebrow: "Düzelt",
              title: "Riskli ifadenin yerine güvenli öneri",
              lead: "İşaretlenen her ifade için güvenli bir karşılık ve aynı kurallarla yeniden taranmış beş doğal Türkçe varyant.",
              points: ["Markanın yasaklı kelimeleri hiç kullanılmaz", "Varyantlar farklı tonlarda, karakter sınırına uygun", "Tek tıkla kopyala, CSV olarak indir"],
              visual: <SafeTextMock report={report} />,
            },
            {
              id: "video",
              eyebrow: "Video ve Reels",
              title: "İlk 3 saniyeyi kaçırma",
              lead: "Video cihazından çıkmaz: tarayıcı birkaç kare alır. Kanca, altyazı güvenli alanı, format ve dış ses metni incelenir.",
              points: ["9:16 güvenli alan kontrolü", "Dış ses metni de kurallardan geçer", "Görsel analizinin iki katı kredi, başka ücret yok"],
              visual: <VideoMock />,
            },
            {
              id: "itiraz",
              eyebrow: "İtiraz et",
              title: "Reddedildiysen ne yapacağını bil",
              lead: "Ret mesajını yapıştır; hangi politikaya takıldığını, itirazın mı yeni reklamın mı daha mantıklı olduğunu gör.",
              points: ["Türkçe ve İngilizce itiraz taslağı", "Hesap kısıtlaması için 8 adımlı rehber", "Ek kredi düşmez"],
              visual: <AppealMock />,
            },
          ].map((b, i) => (
            <div key={b.id} id={b.id} className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <SectionHead eyebrow={b.eyebrow} title={b.title} lead={b.lead} />
                <ul className="mt-7 space-y-3">
                  {b.points.map((p) => (
                    <Check key={p}>{p}</Check>
                  ))}
                </ul>
                <Link href="/kayit" className="mt-7 inline-flex min-h-11 items-center gap-1.5 text-body font-bold text-blue no-underline hover:underline">
                  Ücretsiz dene <span aria-hidden>→</span>
                </Link>
              </div>
              <div className={i % 2 ? "lg:order-1" : ""}>{b.visual}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Report mockup */}
      <section id="rapor" className={`${WRAP} scroll-mt-24 py-20 lg:py-28`}>
        <SectionHead
          center
          eyebrow="Gerçek çıktı"
          title="Örnek rapor, AdScope motorunun gerçek sonucu"
          lead={<>Aşağıdaki skorlar, &ldquo;{SAMPLE_AD.headline}&rdquo; örnek reklamı kural motorundan geçirilerek bu sayfa açılırken hesaplandı.</>}
        />
        <div className="mt-12">
          <ReportMock report={report} />
        </div>
      </section>

      {/* Product facts (counted from the catalogue, not marketing estimates) */}
      <section aria-label="AdScope rakamlarla" className={`${WRAP} pb-20 lg:pb-28`}>
        <dl className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {[
            [String(RULE_CATALOG.length), "kural kartı", `${activeCount} tanesi resmî kaynaktan doğrulandı`],
            ["3", "reklam platformu", "Meta, Google Ads, TikTok"],
            [String(sectors.length), "sektör paketi", "Takviye gıdadan finansa"],
            ["2 dil", "itiraz taslağı", "Türkçe ve İngilizce"],
          ].map(([n, label, note]) => (
            <div key={label} className="bg-card p-7">
              <dt className="sr-only">{label}</dt>
              <dd className="text-4xl font-extrabold tabular text-ink">{n}</dd>
              <dd className="mt-1 text-body font-bold text-ink">{label}</dd>
              <dd className="mt-1 text-small text-muted">{note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works + sources */}
      <section className="bg-paper-2 py-20 lg:py-28">
        <div className={WRAP}>
          <SectionHead center eyebrow="Nasıl çalışır" title="Yükle, kontrol et, düzelt" />
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              ["Yükle", "Görselini veya videonu, metnini, platformu ve sektörünü seç.", IconUpload],
              ["Kontrol et", `${RULE_CATALOG.length} kural kartıyla taranır; sonuç yaklaşık bir dakikada hazır.`, IconScale],
              ["Düzelt ve yayınla", "Güvenli metni ve varyantları kullan, raporu PDF olarak indir ya da ekibinle paylaş.", IconCheck],
            ].map(([t, d, I], i) => {
              const Icon = I as typeof IconUpload;
              return (
                <li key={t as string} className="rounded-2xl border border-line bg-card p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-tint text-navy-700">
                      <Icon />
                    </span>
                    <span className="text-3xl font-extrabold tabular text-blue/80" aria-hidden>0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-ink">{t as string}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{d as string}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-14 text-center">
            <h3 className="text-small font-bold text-ink">Kurallarımızı dayandırdığımız kaynaklar</h3>
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {sources.map((s) => (
                <li key={s} className="rounded-full border border-line bg-card px-3.5 py-1.5 text-meta font-semibold text-ink-soft">
                  {s} <span className="ml-1 text-fine font-bold uppercase tracking-wide text-muted">kaynak</span>
                </li>
              ))}
            </ul>
            <Link href="/kurallar" className="mt-5 inline-flex min-h-11 items-center text-small font-bold text-blue">
              Tüm kural kartları ve resmî bağlantılar →
            </Link>
          </div>
        </div>
      </section>

      {/* Everything grid */}
      <section id="hepsi" className={`${WRAP} scroll-mt-24 py-20 lg:py-28`}>
        <SectionHead center eyebrow="Hepsi bir arada" title="Reklam sürecinin her adımı için bir araç" />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ALL.map(({ Icon, title, desc, isNew }) => (
            <li key={title} className="group rounded-2xl border border-line bg-card p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-raised">
              <span className="flex size-11 items-center justify-center rounded-xl bg-tint text-navy-700">
                <Icon />
              </span>
              <h3 className="mt-5 flex items-center gap-2 text-lg font-extrabold text-ink">
                {title}
                {isNew ? <span className="rounded-full bg-blue-tint px-2 py-0.5 text-fine font-bold text-blue">Yeni</span> : null}
              </h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{desc}</p>
            </li>
          ))}
        </ul>

        <div id="ajans" className="mt-16 grid scroll-mt-24 gap-8 rounded-3xl border border-line bg-tint p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <Eyebrow>Ajanslar için</Eyebrow>
            <h3 className="mt-4 font-display text-[1.75rem] leading-tight text-ink sm:text-[2.1rem]">Müşterilerinin reklamlarını tek panelden kontrol et</h3>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              <Check>Marka başına ton, sektör ve yasaklı kelimeler</Check>
              <Check>10 kişiye kadar salt okunur ekip</Check>
              <Check>Avukat için oturumsuz inceleme bağlantısı</Check>
              <Check>Logolu PDF rapor ve API anahtarı</Check>
            </ul>
          </div>
          <div className="rounded-2xl bg-card p-6 shadow-card">
            <p className="text-small font-bold text-muted">Ajans paketi</p>
            <p className="mt-1 text-3xl font-extrabold tabular text-ink">
              {formatTry(CREDIT_PACKAGES.find((p) => p.id === "ajans")?.priceMinor ?? 0)}
              <span className="ml-2 text-body font-semibold text-muted">/ {CREDIT_PACKAGES.find((p) => p.id === "ajans")?.credits} analiz</span>
            </p>
            <ButtonLink href="/fiyatlandirma" variant="primary" className="mt-5 w-full">
              Paketleri karşılaştır
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-paper-2 py-20 lg:py-28">
        <div className={WRAP}>
          <SectionHead center eyebrow="Fiyatlar" title="Analiz başına öde, abonelik yok" lead="Kredi yalnızca rapor başarıyla tamamlandığında düşer." />
          <ul className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <li className="flex flex-col rounded-2xl border border-line bg-card p-6 shadow-card">
              <h3 className="text-lg font-extrabold text-ink">Ücretsiz</h3>
              <p className="mt-3 text-3xl font-extrabold tabular text-ink">0 ₺</p>
              <p className="mt-1 text-small text-muted">3 analiz · kayıtta bir kez</p>
              <ButtonLink href="/kayit" variant="ghost" className="mt-auto w-full">
                Ücretsiz başla
              </ButtonLink>
            </li>
            {CREDIT_PACKAGES.map((p) => {
              const featured = p.id === featuredId;
              return (
                <li
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl p-6 ${featured ? "text-paper shadow-float" : "border border-line bg-card shadow-card"}`}
                  style={featured ? { background: "var(--gradient-brand)" } : undefined}
                >
                  {featured ? <span className="absolute right-5 top-5 rounded-full bg-paper/15 px-2.5 py-0.5 text-fine font-bold uppercase tracking-wide">Önerilen</span> : null}
                  <h3 className={`text-lg font-extrabold ${featured ? "" : "text-ink"}`}>{p.name}</h3>
                  <p className={`mt-3 text-3xl font-extrabold tabular ${featured ? "" : "text-ink"}`}>{formatTry(p.priceMinor)}</p>
                  <p className={`mt-1 text-small ${featured ? "text-paper/80" : "text-muted"}`}>{p.credits} analiz</p>
                  <p className={`mb-6 mt-4 text-small leading-relaxed ${featured ? "text-paper/85" : "text-ink-soft"}`}>{p.description}</p>
                  <ButtonLink href="/fiyatlandirma" variant={featured ? "ghost" : "primary"} className={`mt-auto w-full ${featured ? "border-transparent" : ""}`}>
                    {p.name} paketi
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="sss" className={`${WRAP} scroll-mt-24 py-20 lg:py-28`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHead eyebrow="SSS" title="Sık sorulan sorular" />
            <Disclaimer className="mt-8" />
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-card">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-6 py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-bold text-ink [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <div className="pb-5 leading-relaxed text-ink-soft">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing band */}
      <section className={`${WRAP} pb-20 lg:pb-28`}>
        <div className="relative overflow-hidden rounded-3xl px-7 py-14 text-center text-paper sm:px-12 sm:py-20" style={{ background: "var(--gradient-brand)" }}>
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-paper/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-paper/5" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl font-display text-[2rem] leading-tight sm:text-[2.8rem]">İlk üç analiz bizden</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-paper/85">Kayıt ol, reklamını yükle, sonucu yaklaşık bir dakikada gör.</p>
          <ButtonLink href="/kayit" variant="ghost" className="relative mt-8 border-transparent px-7 text-base">
            Ücretsiz hesap oluştur
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
