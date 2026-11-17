import { upcomingEvents } from "@/lib/calendar/season";
import { rulePlatform, PLATFORM_SHORT } from "@/lib/platforms";
import { RULE_CATALOG, type RuleCardDef, type Sector } from "@/lib/rules/catalog";
import { SECTOR_LABEL } from "@/lib/sectors";

/**
 * Monthly regulation newsletter: rule cards added or re-verified in the last 30 days (the catalog
 * is the single source of truth for the database seed) and the season events of the next 45 days.
 * Generic content only: no ad text, no user data beyond the greeting name.
 */
export function newsletterPeriod(today: Date) {
  return today.toISOString().slice(0, 7);
}

export function changedRules(today: Date, sector: Sector | null, days = 30): RuleCardDef[] {
  const from = new Date(today.getTime() - days * 86400_000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  return RULE_CATALOG.filter(
    (r) =>
      r.status !== "draft" &&
      r.status !== "retired" &&
      r.lastVerifiedAt !== undefined &&
      r.lastVerifiedAt >= from &&
      r.lastVerifiedAt <= to &&
      (!sector || r.sector === "genel" || r.sector === sector),
  ).sort((a, b) => (a.status === b.status ? a.id.localeCompare(b.id) : a.status === "active" ? -1 : 1));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const fmt = (iso: string) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));

export function buildNewsletter(today: Date, opts: { siteUrl: string; displayName: string | null; sector: Sector | null }) {
  const rules = changedRules(today, opts.sector);
  const events = upcomingEvents({ from: today, days: 45, sector: opts.sector }).slice(0, 5);
  const month = `${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`;
  const name = opts.displayName?.trim().slice(0, 80) || null;
  const rulesUrl = `${opts.siteUrl}/kurallar`;
  const settingsUrl = `${opts.siteUrl}/panel/ayarlar#bulten`;
  const subject = `AdScope mevzuat bülteni · ${month}`;
  const disclaimer = "Risk değerlendirmesidir, hukuki görüş değildir. Doğrulanmamış kurallar yalnızca bilgilendirme amaçlıdır.";
  const status = (r: RuleCardDef) => (r.status === "active" ? "doğrulandı" : "doğrulama bekliyor");
  const area = (r: RuleCardDef) => {
    const p = rulePlatform(r);
    return p !== "all" ? PLATFORM_SHORT[p] : r.domain === "tr_law" ? "Türk mevzuatı" : "Kreatif kalite";
  };
  const ruleLine = (r: RuleCardDef) => `${r.title} (${area(r)}${r.sector !== "genel" ? `, ${SECTOR_LABEL[r.sector]}` : ""}; ${status(r)})`;

  const text = [
    name ? `Merhaba ${name},` : "Merhaba,",
    "",
    `${month} bülteni${opts.sector ? ` (${SECTOR_LABEL[opts.sector]} sektörü dahil)` : ""}.`,
    "",
    rules.length ? `Son 30 günde eklenen veya güncellenen ${rules.length} kural kartı:` : "Son 30 günde kural kartlarında değişiklik olmadı.",
    ...rules.slice(0, 15).map((r) => `- ${ruleLine(r)}`),
    rules.length > 15 ? `- ve ${rules.length - 15} kart daha` : null,
    `Tüm kartlar ve kaynakları: ${rulesUrl}`,
    "",
    events.length ? "Önümüzdeki dönemler:" : null,
    ...events.map((e) => `- ${e.name}: ${fmt(e.start)}; incelemeye son gönderim ${fmt(e.submitBy)}`),
    "",
    disclaimer,
    `Bülteni kapatmak için: ${settingsUrl}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f7f4ee;font-family:Arial,Helvetica,sans-serif;color:#13213c">
<div style="max-width:600px;margin:0 auto;padding:28px 20px">
<p style="font-size:12px;font-weight:bold;letter-spacing:.08em;color:#b23a21;text-transform:uppercase">AdScope · Mevzuat bülteni</p>
<h1 style="font-family:Georgia,serif;font-size:26px;margin:4px 0 16px">${esc(month)}</h1>
<p>${name ? `Merhaba ${esc(name)},` : "Merhaba,"}</p>
<h2 style="font-size:17px;margin:22px 0 8px">Kural kartlarında değişenler</h2>
${
  rules.length
    ? `<ul style="padding-left:18px;line-height:1.55">${rules
        .slice(0, 15)
        .map((r) => `<li><a href="${esc(rulesUrl)}#${esc(r.id)}" style="color:#13213c">${esc(r.title)}</a> <span style="color:#56607a">· ${esc(ruleLine(r).slice(r.title.length + 2, -1))}</span></li>`)
        .join("")}</ul>${rules.length > 15 ? `<p style="color:#56607a">ve ${rules.length - 15} kart daha</p>` : ""}`
    : `<p style="color:#3d4c6b">Son 30 günde değişiklik olmadı.</p>`
}
<p><a href="${esc(rulesUrl)}" style="color:#b23a21;font-weight:bold">Tüm kural kartları ve kaynakları</a></p>
${
  events.length
    ? `<h2 style="font-size:17px;margin:22px 0 8px">Önümüzdeki dönemler</h2><ul style="padding-left:18px;line-height:1.55">${events
        .map((e) => `<li><strong>${esc(e.name)}</strong>: ${esc(fmt(e.start))} <span style="color:#56607a">· incelemeye son gönderim ${esc(fmt(e.submitBy))}</span></li>`)
        .join("")}</ul>`
    : ""
}
<p style="margin-top:26px;font-size:13px;color:#3d4c6b"><strong>${esc(disclaimer)}</strong></p>
<p style="font-size:12px;color:#56607a">Bu e-postayı bülten tercihin açık olduğu için aldın. <a href="${esc(settingsUrl)}" style="color:#56607a">Bülteni kapat</a></p>
</div></body></html>`;
  return { subject, text, html, ruleCount: rules.length };
}
