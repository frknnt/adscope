import { upcomingEvents, utc, type SeasonEvent } from "@/lib/calendar/season";
import { fold } from "./text";
import type { AdInput, EngineFinding } from "./types";

const fmt = (iso: string) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
const PROMO = /(indirim|kampanya|firsat|%\s*\d|\d+\s*%|tl yerine|ozel fiyat|hediye|bayram|yilbasi|sevgililer|anneler|babalar|efsane cuma|black friday|okul)/;

/**
 * Season notes: when the analysis runs inside a season event's ad window, the report reminds the user of
 * that period's common compliance points. Always "info"; never a violation and never changes a score.
 */
export function seasonFindings(input: AdInput): EngineFinding[] {
  if (!input.today || !/^\d{4}-\d{2}-\d{2}$/.test(input.today)) return [];
  const [y, m, d] = input.today.split("-").map(Number);
  const today = utc(y, m, d);
  const text = fold(`${input.headline} ${input.primaryText} ${input.description} ${input.transcript ?? ""} ${input.speech?.text ?? ""}`);
  const live = upcomingEvents({ from: today, days: 60, sector: input.sector }).filter((e) => input.today! >= e.prepStart && input.today! <= e.end);
  // An ad that mentions an offer is the main case; otherwise only the nearest event is noted.
  const picked: SeasonEvent[] = PROMO.test(text) ? live.slice(0, 2) : live.slice(0, 1);
  return picked.map((e) => {
    const when = e.start === e.end ? fmt(e.start) : `${fmt(e.start)} – ${fmt(e.end)}`;
    const points = e.reminders.map((r) => r.text);
    const dateNote = e.verified ? "" : ` Tarih notu: ${e.dateRule}`;
    const suggestion =
      input.today! <= e.submitBy
        ? `Reklamı en geç ${fmt(e.submitBy)} tarihinde incelemeye gönder; ret durumunda düzeltmeye zaman kalır.`
        : input.today! < e.adStart
          ? "Önerilen inceleme tarihi geçti; olası bir ret için düzeltme süresi kısalabilir, reklamı hemen incelemeye gönder."
          : "Dönem başladı; yayındaki reklamlarda kampanya koşullarının açılış sayfasıyla aynı olduğunu kontrol et.";
    return {
      ruleId: null,
      ruleVersionId: null,
      ruleStatus: null,
      domain: "creative_quality",
      severity: "info",
      field: "general",
      matchedText: null,
      title: `Sezon notu: ${e.name} (${when})`,
      explanation: `Bu analiz ${e.name} dönemine denk geliyor. Bu dönemde dikkat: ${points.join(" ")}${dateNote}`.slice(0, 1500),
      suggestion,
      origin: "heuristic",
    } satisfies EngineFinding;
  });
}
