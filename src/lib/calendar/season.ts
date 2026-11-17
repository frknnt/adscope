/**
 * Season calendar: Turkish marketing dates with preparation milestones and compliance reminders.
 *
 * Dates are computed, not fetched:
 *  - fixed days (14 Şubat, 8 Mart, 23 Nisan, 11.11, 24 Kasım, 1 Ocak),
 *  - rule-based days (Anneler Günü = May's 2nd Sunday, Babalar Günü = June's 3rd Sunday,
 *    Efsane Cuma = November's last Friday, Siber Pazartesi = the Monday after it),
 *  - religious holidays from a per-year table. These follow the lunar calendar; the table is taken from
 *    secondary sources and is marked `verified: false` until checked against Diyanet's official calendar.
 *
 * Compliance reminders link to rule cards; they are checklists for the ad, not findings.
 */
import { SECTOR_IDS, type Sector } from "@/lib/sectors";

export type EventKind = "sabit" | "hesaplanan" | "dini" | "sezon";

export interface Reminder {
  text: string;
  ruleIds: string[];
  sectors?: Sector[];
}

interface EventDef {
  id: string;
  name: string;
  kind: EventKind;
  /** Days before the date when ads usually start running. */
  leadDays: number;
  sectors: Sector[];
  summary: string;
  tips: string[];
  reminders: Reminder[];
  /** Returns [start, end] for a given year (UTC midnight dates), or null when the year is not known. */
  dates(year: number): { start: Date; end: Date; rule: string; verified: boolean } | null;
}

export interface SeasonEvent {
  id: string;
  key: string;
  name: string;
  kind: EventKind;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (same as start for one-day events)
  dateRule: string;
  verified: boolean;
  /** Day to start preparing creatives. */
  prepStart: string;
  /** Recommended latest day to submit ads for review (leaves room for review delays and fixes). */
  submitBy: string;
  /** First day ads usually run. */
  adStart: string;
  sectors: Sector[];
  summary: string;
  tips: string[];
  reminders: Reminder[];
}

const ALL: Sector[] = [...SECTOR_IDS];
const DAY = 86_400_000;

export const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
export const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** n-th given weekday (0 = Sunday) of a month, 1-based n. */
export function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = utc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month, 1 + offset + (n - 1) * 7);
}

/** Last given weekday (0 = Sunday) of a month. */
export function lastWeekday(year: number, month: number, weekday: number) {
  const last = utc(year, month + 1, 0);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return addDays(last, -offset);
}

/**
 * Religious holidays (bayram days, without arife). Source: secondary published calendars, consistent with each
 * other; NOT yet verified against the official Diyanet calendar. Years missing here are simply not shown.
 */
export const RELIGIOUS_HOLIDAYS: Record<number, { ramazan: [string, string]; kurban: [string, string] }> = {
  2026: { ramazan: ["2026-03-20", "2026-03-22"], kurban: ["2026-05-27", "2026-05-30"] },
  2027: { ramazan: ["2027-03-09", "2027-03-11"], kurban: ["2027-05-16", "2027-05-19"] },
};
const UNVERIFIED_RULE = "Ay takvimine göre değişir; tarih ikincil kaynaklardan alındı, Diyanet takvimiyle doğrulanmadı.";

function fixed(month: number, day: number, rule: string) {
  return (year: number) => {
    const d = utc(year, month, day);
    return { start: d, end: d, rule, verified: true };
  };
}

function religious(which: "ramazan" | "kurban") {
  return (year: number) => {
    const row = RELIGIOUS_HOLIDAYS[year];
    if (!row) return null;
    const [s, e] = row[which];
    const [ys, ms, ds] = s.split("-").map(Number);
    const [ye, me, de] = e.split("-").map(Number);
    return { start: utc(ys, ms, ds), end: utc(ye, me, de), rule: UNVERIFIED_RULE, verified: false };
  };
}

const DISCOUNT: Reminder = {
  text: "İndirim oranı veriyorsan indirim öncesi fiyatı ve bu fiyatın geçerli olduğu dönemi açıkça yaz; “%70’e varan” gibi ifadelerde oranın kaç üründe geçerli olduğunu belirt.",
  ruleIds: ["TR-RY-INDIRIM-REFERANS"],
};
const CONDITIONS: Reminder = {
  text: "Kampanya koşullarını (süre, stok, sepet alt sınırı, kapsam dışı ürünler) reklamda ve açılış sayfasında aynı şekilde göster.",
  ruleIds: ["TR-RY-SARTLI-INDIRIM"],
};
const FREE: Reminder = {
  text: "“Ücretsiz”, “bedava”, “hediye” diyorsan bedelin başka bir yerden alınmadığından emin ol (kargo, zorunlu ek ürün).",
  ruleIds: ["TR-RY-UCRETSIZ"],
};
const INFLUENCER: Reminder = {
  text: "Fenomen iş birliklerinde paylaşımın başında “Reklam” veya “Tanıtım” ibaresi olsun.",
  ruleIds: ["TR-RY-ETKILEYICI-IBARE"],
};
const BODY: Reminder = {
  text: "Beden, kilo veya görünüş üzerinden olumsuz hitap etme; belirli sürede kesin sonuç vaat etme.",
  ruleIds: ["META-PHA-NEGATIVE-SELF", "META-UO-TIMEFRAME"],
  sectors: ["takviye_gida", "estetik_klinik", "kozmetik"],
};
const BEFORE_AFTER: Reminder = {
  text: "Önce/sonra görselleri ve hasta beyanları hem Meta’da hem sağlık hizmeti reklamlarında risklidir.",
  ruleIds: ["META-PHA-BEFORE-AFTER", "TR-ESTETIK-ONCE-SONRA"],
  sectors: ["estetik_klinik", "kozmetik"],
};
const CLINIC_PRICE: Reminder = {
  text: "Sağlık hizmetlerinde fiyat ve kampanya duyurusu kısıtlıdır; bayram/özel gün indirimi ilanı vermeden önce kontrol et.",
  ruleIds: ["TR-ESTETIK-FIYAT-KAMPANYA"],
  sectors: ["estetik_klinik"],
};
const SUPPLEMENT: Reminder = {
  text: "Takviye gıdada hastalık önleme/tedavi veya “beslenmenin yerine geçer” izlenimi verme.",
  ruleIds: ["TR-RY-TAKVIYE-BESLENME", "TR-RY-SAGLIK-BEYANI"],
  sectors: ["takviye_gida"],
};
const COSMETIC: Reminder = {
  text: "Kozmetikte “tedavi eder”, “iyileştirir” gibi tıbbi etki iddiası kurma; “klinik olarak kanıtlandı” diyorsan çalışmayı saklı tut.",
  ruleIds: ["TR-KOZMETIK-TIBBI", "TR-KOZMETIK-KANIT"],
  sectors: ["kozmetik"],
};
const EDUCATION: Reminder = {
  text: "Kurs ve eğitim reklamlarında “sınavı garanti geç”, “iş garantisi” gibi kesin sonuç vaatleri verme; sertifikanın kim tarafından verildiğini açık yaz.",
  ruleIds: ["TR-EGITIM-BASARI-GARANTI", "TR-EGITIM-IS-GARANTI", "TR-EGITIM-SERTIFIKA"],
  sectors: ["kurs_egitim"],
};
const FINANCE: Reminder = {
  text: "Finans ve kredi kampanyalarında getiri vaadi verme, toplam maliyeti ve yetki bilgisini yaz; Meta’da bu reklamlar özel kategori olarak işaretlenmeli.",
  ruleIds: ["TR-FINANS-GETIRI", "TR-KREDI-MALIYET", "META-OZEL-KAT-KREDI"],
  sectors: ["finans"],
};
const REAL_ESTATE: Reminder = {
  text: "Konut kampanyalarında yetki belgesi numarasını yaz, kira getirisi veya değer artışı garantisi verme; Meta’da konut özel kategorisini seç.",
  ruleIds: ["TR-EMLAK-YETKI-BELGESI", "TR-EMLAK-GETIRI", "META-OZEL-KAT-KONUT"],
  sectors: ["emlak"],
};

const EVENTS: EventDef[] = [
  {
    id: "yilbasi",
    name: "Yılbaşı",
    kind: "sabit",
    leadDays: 21,
    sectors: ALL,
    summary: "Aralık ayının ikinci yarısı hediye ve yeni yıl kampanyalarıyla en yoğun reklam dönemlerinden biri.",
    tips: [
      "Kargo son sipariş tarihini reklamda ve sayfada net yaz; son günlerde “yetişir mi” sorusu dönüşümü düşürür.",
      "Hediye paketi, kişiye özel not gibi küçük ekleri öne çıkaran varyantlar dene.",
      "Yeni yıl hedefi mesajlarında (spor, beslenme) sonuç vaadi yerine süreci anlat.",
    ],
    reminders: [DISCOUNT, CONDITIONS, BODY, SUPPLEMENT, COSMETIC, FINANCE, REAL_ESTATE],
    dates: fixed(1, 1, "Her yıl 1 Ocak."),
  },
  {
    id: "sevgililer-gunu",
    name: "Sevgililer Günü",
    kind: "sabit",
    leadDays: 14,
    sectors: ["genel", "estetik_klinik", "kozmetik"],
    summary: "Hediye, deneyim ve bakım kategorilerinde talep 14 Şubat’tan önceki iki haftada yoğunlaşır.",
    tips: [
      "Fiyat aralığına göre hediye rehberi (“500 TL altı”) formatı tıklanma için iyi çalışır.",
      "Son teslim tarihini ve mağazadan teslim seçeneğini görselde göster.",
    ],
    reminders: [DISCOUNT, CONDITIONS, CLINIC_PRICE, COSMETIC],
    dates: fixed(2, 14, "Her yıl 14 Şubat."),
  },
  {
    id: "kadinlar-gunu",
    name: "Dünya Kadınlar Günü",
    kind: "sabit",
    leadDays: 7,
    sectors: ALL,
    summary: "Kutlama ve farkındalık günü; indirimden çok marka mesajı ve topluluk içerikleri öne çıkar.",
    tips: [
      "Klişe rol ve görünüş vurgusundan kaçın; tepki alan kampanyalar hızla yayılır.",
      "Kadın girişimci, çalışan veya müşteri hikâyeleri gibi gerçek içerikler kullan.",
    ],
    reminders: [
      { text: "Kişisel özellik ima eden hitaplardan (“Kilolu musun?”) kaçın.", ruleIds: ["META-PA-PERSONAL-ATTRIBUTES"] },
      BODY,
    ],
    dates: fixed(3, 8, "Her yıl 8 Mart."),
  },
  {
    id: "ramazan-bayrami",
    name: "Ramazan Bayramı",
    kind: "dini",
    leadDays: 30,
    sectors: ALL,
    summary: "Ramazan ayı boyunca iftar/sahur saatlerinde mobil kullanım artar; bayram öncesi hediye ve giyim talebi yükselir.",
    tips: [
      "Reklam saatlerini iftar sonrası ve sahur öncesine göre planla.",
      "Bayram öncesi son kargo gününü ve bayramda çalışma saatlerini duyur.",
      "Dini motifleri saygılı ve ölçülü kullan.",
    ],
    reminders: [DISCOUNT, CONDITIONS, SUPPLEMENT, CLINIC_PRICE],
    dates: religious("ramazan"),
  },
  {
    id: "23-nisan",
    name: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı",
    kind: "sabit",
    leadDays: 7,
    sectors: ["genel"],
    summary: "Oyuncak, kitap, etkinlik ve aile kategorileri için kısa ama belirgin bir dönem.",
    tips: [
      "Reklamı ebeveynlere hitap edecek şekilde kur; çocuğa doğrudan satın alma çağrısı yapma.",
      "Çocuk görselleri kullanıyorsan ailenin açık iznini sakla.",
    ],
    reminders: [
      {
        text: "Çocuklara yönelik reklamlar ayrıca düzenlenir. AdScope’ta bu konuda henüz aktif kural kartı yok; yayından önce uzman görüşü al.",
        ruleIds: [],
      },
    ],
    dates: fixed(4, 23, "Her yıl 23 Nisan."),
  },
  {
    id: "anneler-gunu",
    name: "Anneler Günü",
    kind: "hesaplanan",
    leadDays: 14,
    sectors: ALL,
    summary: "Yılın en güçlü hediye günlerinden biri; kozmetik, takı, bakım ve deneyim kategorilerinde talep yüksek.",
    tips: [
      "Hediye kartı ve son dakika dijital hediye seçeneklerini son 3 günde öne çıkar.",
      "Duygusal hikâye anlatan video kreatifleri bu dönemde iyi performans gösterir; ilk 3 saniyede ürünü göster.",
    ],
    reminders: [DISCOUNT, CONDITIONS, INFLUENCER, BEFORE_AFTER, CLINIC_PRICE, COSMETIC],
    dates: (y) => {
      const d = nthWeekday(y, 5, 0, 2);
      return { start: d, end: d, rule: "Mayıs ayının ikinci pazarı.", verified: true };
    },
  },
  {
    id: "kurban-bayrami",
    name: "Kurban Bayramı",
    kind: "dini",
    leadDays: 14,
    sectors: ALL,
    summary: "Uzun tatil dönemi; seyahat, ev ve mutfak kategorileri öne çıkar, bayram süresince teslimat yavaşlar.",
    tips: [
      "Tatil öncesi son kargo tarihini ve bayram boyunca destek saatlerini net yaz.",
      "Seyahate çıkan kitle için mobil öncelikli, kısa video kreatifleri hazırla.",
    ],
    reminders: [DISCOUNT, CONDITIONS, CLINIC_PRICE],
    dates: religious("kurban"),
  },
  {
    id: "yaz-sezonu",
    name: "Yaz sezonu öncesi",
    kind: "sezon",
    leadDays: 30,
    sectors: ["takviye_gida", "estetik_klinik", "kozmetik"],
    summary: "Haziran öncesi form, cilt bakımı ve güneş koruma talepleri artar; vaat odaklı reklamlar da en çok bu dönemde reddedilir.",
    tips: [
      "“X günde Y kilo” gibi vaatler yerine rutin, içerik ve kullanım şeklini anlat.",
      "Uzman görüşü kullanıyorsan unvanın doğru ve doğrulanabilir olduğundan emin ol.",
    ],
    reminders: [BODY, BEFORE_AFTER, SUPPLEMENT, COSMETIC, { text: "Kilo verme ve kozmetik işlem reklamlarında yaş hedeflemesi ve kısıtları kontrol et.", ruleIds: ["META-HW-RESTRICTED"] }],
    dates: fixed(6, 1, "Haziran başı (sezon başlangıcı, sabit bir gün değil)."),
  },
  {
    id: "babalar-gunu",
    name: "Babalar Günü",
    kind: "hesaplanan",
    leadDays: 14,
    sectors: ["genel"],
    summary: "Elektronik, giyim, aksesuar ve deneyim hediyeleri için iki haftalık bir pencere.",
    tips: ["Fiyat aralığına göre hediye önerileri ve hızlı teslimat vurgusu kullan."],
    reminders: [DISCOUNT, CONDITIONS],
    dates: (y) => {
      const d = nthWeekday(y, 6, 0, 3);
      return { start: d, end: d, rule: "Haziran ayının üçüncü pazarı.", verified: true };
    },
  },
  {
    id: "okula-donus",
    name: "Okula dönüş",
    kind: "sezon",
    leadDays: 21,
    sectors: ["genel", "takviye_gida", "kurs_egitim"],
    summary: "Kırtasiye, çanta, giyim, elektronik ve kurs kayıtları için ağustos sonundan eylül ortasına uzanan dönem. Velilere yönelik kampanyalar artar.",
    tips: [
      "Liste odaklı kreatifler (sınıfa göre ihtiyaç listesi) ve paket fiyatlar iyi çalışır; paketin içeriğini açıkça yaz.",
      "Çocuklara doğrudan “hemen al” çağrısı yapma; mesajı veliye yönelt.",
      "Takviye gıdada “okul başarısı”, “zekâ” veya “hastalıktan korur” gibi vaatlerden kaçın.",
    ],
    reminders: [
      DISCOUNT,
      CONDITIONS,
      { text: "Çocuklara yönelik reklamlarda onların deneyimsizliğinden yararlanan veya doğrudan satın almaya yönelten ifadeler kullanma.", ruleIds: ["TR-RY-COCUK-DOGRUDAN"] },
      SUPPLEMENT,
      EDUCATION,
    ],
    dates: (y) => {
      const d = nthWeekday(y, 9, 1, 2);
      return {
        start: d,
        end: d,
        rule: "Okulların açılış günü MEB çalışma takvimine göre her yıl değişir; burada eylülün ikinci pazartesi varsayıldı. MEB takvimiyle doğrula.",
        verified: false,
      };
    },
  },
  {
    id: "11-11",
    name: "11.11 indirim günü",
    kind: "sabit",
    leadDays: 5,
    sectors: ["genel", "takviye_gida"],
    summary: "Pazaryerlerinin büyük indirim günü; Kasım kampanya döneminin başlangıcı.",
    tips: ["Pazaryeri fiyatınla kendi sitendeki fiyatın tutarlı olduğundan emin ol; açılış sayfası taraması bunu yakalar."],
    reminders: [DISCOUNT, CONDITIONS, FREE],
    dates: fixed(11, 11, "Her yıl 11 Kasım."),
  },
  {
    id: "efsane-cuma",
    name: "Efsane Cuma (Black Friday)",
    kind: "hesaplanan",
    leadDays: 10,
    sectors: ALL,
    summary: "Yılın en rekabetçi reklam haftası; tıklama maliyetleri yükselir, indirim beyanları en çok bu dönemde denetlenir.",
    tips: [
      "Kreatifleri ve açılış sayfalarını kampanyadan en az bir hafta önce incelemeye gönder.",
      "Aynı ürün için reklamdaki ve sayfadaki indirim oranını birebir eşleştir.",
      "Stok sınırlıysa bunu reklamda belirt.",
    ],
    reminders: [DISCOUNT, CONDITIONS, FREE, CLINIC_PRICE],
    dates: (y) => {
      const d = lastWeekday(y, 11, 5);
      return { start: d, end: d, rule: "Kasım ayının son cuması.", verified: true };
    },
  },
  {
    id: "siber-pazartesi",
    name: "Siber Pazartesi",
    kind: "hesaplanan",
    leadDays: 3,
    sectors: ["genel"],
    summary: "Efsane Cuma’dan sonraki pazartesi; çevrim içi indirimlerin ikinci dalgası.",
    tips: ["Efsane Cuma’da iyi çalışan kreatifleri yeni teklifle güncelle; aynı görseli tekrar kullanmak frekans yorgunluğu yaratır."],
    reminders: [DISCOUNT, CONDITIONS],
    dates: (y) => {
      const d = addDays(lastWeekday(y, 11, 5), 3);
      return { start: d, end: d, rule: "Efsane Cuma’dan sonraki pazartesi.", verified: true };
    },
  },
  {
    id: "ogretmenler-gunu",
    name: "Öğretmenler Günü",
    kind: "sabit",
    leadDays: 7,
    sectors: ["genel"],
    summary: "Kırtasiye, kitap ve küçük hediyeler için kısa bir dönem.",
    tips: ["Veli hedeflemesi ve okul çıkışı saatleri için zamanlama yap."],
    reminders: [DISCOUNT],
    dates: fixed(11, 24, "Her yıl 24 Kasım."),
  },
];

export const SEASON_EVENT_IDS = EVENTS.map((e) => e.id);

/** Turkey's calendar date for an instant (Europe/Istanbul, UTC+3, no DST). */
export function istanbulToday(now = new Date()) {
  const d = new Date(now.getTime() + 3 * 3600_000);
  return utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Events whose end is on or after `from`, within `days`, sorted by start date. */
export function upcomingEvents(opts: { from?: Date; days?: number; sector?: Sector | null } = {}): SeasonEvent[] {
  const from = opts.from ?? istanbulToday();
  const until = addDays(from, opts.days ?? 365);
  const years = [from.getUTCFullYear(), from.getUTCFullYear() + 1, from.getUTCFullYear() + 2];
  const out: SeasonEvent[] = [];
  for (const def of EVENTS) {
    if (opts.sector && !def.sectors.includes(opts.sector)) continue;
    for (const y of years) {
      const d = def.dates(y);
      if (!d || d.end < from || d.start > until) continue;
      const adStart = addDays(d.start, -def.leadDays);
      out.push({
        id: def.id,
        key: `${def.id}-${y}`,
        name: def.name,
        kind: def.kind,
        start: iso(d.start),
        end: iso(d.end),
        dateRule: d.rule,
        verified: d.verified,
        prepStart: iso(addDays(adStart, -14)),
        submitBy: iso(addDays(adStart, -3)),
        adStart: iso(adStart),
        sectors: def.sectors,
        summary: def.summary,
        tips: def.tips,
        reminders: def.reminders.filter((r) => !opts.sector || !r.sectors || r.sectors.includes(opts.sector)),
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, "tr"));
}

export type Phase = "hazirlik" | "incelemeye-gonder" | "yayinda" | "yaklasiyor";

/** Where today falls relative to the event's milestones. */
export function phaseOf(e: SeasonEvent, today: Date = istanbulToday()): Phase {
  const t = iso(today);
  if (t >= e.adStart) return "yayinda";
  if (t >= e.submitBy) return "incelemeye-gonder";
  if (t >= e.prepStart) return "hazirlik";
  return "yaklasiyor";
}

export function daysUntil(isoDate: string, today: Date = istanbulToday()) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.round((utc(y, m, d).getTime() - today.getTime()) / DAY);
}

// --- iCalendar export -------------------------------------------------------------------------

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines to 75 octets as RFC 5545 requires (UTF-8 aware). */
function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let limit = 75;
  for (const ch of line) {
    if (enc.encode(cur + ch).length > limit) {
      parts.push(cur);
      cur = ch;
      limit = 74; // continuation lines start with a space
    } else cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

const compact = (isoDate: string) => isoDate.replaceAll("-", "");
const nextDay = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return iso(addDays(utc(y, m, d), 1));
};

export function toIcs(events: SeasonEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AdScope//Sezon Takvimi//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:AdScope sezon takvimi"];
  for (const e of events) {
    const note = e.verified ? "" : "\nTarih doğrulanmadı: ikincil kaynaklardan alındı.";
    const desc = `${e.summary}\nHazırlığa başla: ${e.prepStart}\nİncelemeye gönder: ${e.submitBy}\nYayın: ${e.adStart} itibarıyla${note}\n\nRisk değerlendirmesidir, hukuki görüş değildir.`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.key}@adscope`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.end))}`,
      `SUMMARY:${icsEscape(e.name)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:${e.key}-gonder@adscope`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.submitBy)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.submitBy))}`,
      `SUMMARY:${icsEscape(`${e.name}: reklamları incelemeye gönder`)}`,
      `DESCRIPTION:${icsEscape(`Reklamlar ${e.adStart} tarihinde yayında olmalı. Gönderimden önce AdScope ile kontrol et.`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Today's date in Turkey as YYYY-MM-DD (used for season notes in the analysis). */
export const seasonToday = (now = new Date()) => iso(istanbulToday(now));
