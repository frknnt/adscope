import { templatesFor } from "./templates";
import { upcomingEvents, type SeasonEvent } from "./season";
import type { Sector } from "@/lib/rules/catalog";

/** Events a reminder is due for: preparation has started and ads have not started running yet. */
export function remindersDue(today: Date, sector: Sector | null): SeasonEvent[] {
  return upcomingEvents({ from: today, days: 60, sector }).filter((e) => {
    const t = today.toISOString().slice(0, 10);
    return t >= e.prepStart && t < e.adStart;
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (iso: string) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));

export function buildReminderEmail(e: SeasonEvent, opts: { siteUrl: string; displayName: string | null; sector: Sector | null }) {
  const name = opts.displayName?.trim().slice(0, 80) || null;
  const calendarUrl = `${opts.siteUrl}/panel/takvim#${encodeURIComponent(e.key)}`;
  const template = templatesFor(e.id, opts.sector)[0] ?? null;
  const newUrl = template ? `${opts.siteUrl}/panel/yeni?sablon=${encodeURIComponent(template.id)}` : `${opts.siteUrl}/panel/yeni`;
  const settingsUrl = `${opts.siteUrl}/panel/ayarlar`;
  const when = e.start === e.end ? fmt(e.start) : `${fmt(e.start)} – ${fmt(e.end)}`;
  const reminders = e.reminders.map((r) => r.text);
  const subject = `${e.name} yaklaşıyor: reklamını ${fmt(e.submitBy)} tarihine kadar incelemeye gönder`;
  const dateNote = e.verified ? null : e.dateRule;
  const disclaimer = "AdScope bir risk değerlendirmesi aracıdır, hukuki görüş değildir.";

  const text = [
    name ? `Merhaba ${name},` : "Merhaba,",
    "",
    `${e.name}: ${when}.`,
    dateNote ? `Not: ${dateNote}` : null,
    `Reklamların genelde ${fmt(e.adStart)} civarında yayına girer. Meta incelemesi ve olası düzeltmeler için reklamı en geç ${fmt(e.submitBy)} tarihinde incelemeye göndermeni öneririz.`,
    "",
    "Yayından önce kontrol et:",
    ...reminders.map((r) => `- ${r}`),
    "",
    template ? `Hazır şablonla başla: ${newUrl}` : `Reklamını kontrol et: ${newUrl}`,
    `Takvimde gör: ${calendarUrl}`,
    "",
    `Bu e-postaları Ayarlar'dan kapatabilirsin: ${settingsUrl}`,
    disclaimer,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#14213d">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<p style="font-size:13px;letter-spacing:.04em;color:#5b6478;margin:0 0 18px">ADSCOPE · SEZON HATIRLATMASI</p>
<h1 style="font-size:24px;line-height:1.25;margin:0 0 6px">${esc(e.name)}</h1>
<p style="margin:0 0 18px;color:#3c4660">${esc(when)}</p>
<p style="margin:0 0 14px">${name ? `Merhaba ${esc(name)},` : "Merhaba,"}</p>
${dateNote ? `<p style="margin:0 0 14px;padding:10px 12px;background:#fbefd9;color:#7a4b00;border-radius:8px;font-size:14px">${esc(dateNote)}</p>` : ""}
<p style="margin:0 0 14px">Reklamların genelde <strong>${esc(fmt(e.adStart))}</strong> civarında yayına girer. Meta incelemesi ve olası düzeltmeler için reklamı en geç <strong>${esc(fmt(e.submitBy))}</strong> tarihinde incelemeye göndermeni öneririz.</p>
<h2 style="font-size:16px;margin:22px 0 8px">Yayından önce kontrol et</h2>
<ul style="margin:0 0 20px;padding-left:20px">${reminders.map((r) => `<li style="margin:0 0 8px">${esc(r)}</li>`).join("")}</ul>
<p style="margin:0 0 10px"><a href="${esc(newUrl)}" style="display:inline-block;background:#14213d;color:#f6f3ec;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:bold">${template ? "Hazır şablonla başla" : "Reklamını kontrol et"}</a></p>
<p style="margin:0 0 24px"><a href="${esc(calendarUrl)}" style="color:#b23a1e">Takvimde gör</a></p>
<p style="font-size:12px;color:#5b6478;margin:0">Bu e-postaları <a href="${esc(settingsUrl)}" style="color:#5b6478">Ayarlar</a> sayfasından kapatabilirsin. ${esc(disclaimer)}</p>
</div></body></html>`;
  return { subject, text, html };
}
