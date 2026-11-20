import "server-only";
import type { AdminRepo, PlanRenewalDue } from "@/lib/data/types";
import type { EmailMessage, EmailProvider } from "@/lib/email/provider";
import { findPackage, formatTry, PLAN_REMINDER_DAYS } from "./packages";

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const day = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

/** Renewal reminder for an agency month that ends soon. Service e-mail (about a paid package), not marketing. */
export function buildPlanReminderEmail(due: PlanRenewalDue, siteUrl: string): Omit<EmailMessage, "to" | "idempotencyKey"> {
  const pkg = findPackage(due.packageId);
  const name = due.displayName?.trim().slice(0, 80) || null;
  const ends = day.format(new Date(due.endsAt));
  const renewUrl = `${siteUrl}/panel/krediler?yenile=${encodeURIComponent(due.packageId)}#ajans-paketi`;
  const label = pkg ? `${pkg.name} (${formatTry(pkg.priceMinor)}, ${pkg.credits} kredi)` : "Ajans paketi";
  const subject = `Ajans paketin ${ends} tarihinde bitiyor`;
  const lines = [
    name ? `Merhaba ${name},` : "Merhaba,",
    "",
    `${label} dönemin ${ends} tarihinde bitiyor. Paket kendiliğinden yenilenmez ve kartından otomatik çekim yapılmaz.`,
    `Devam etmek istersen tek tıkla yenileyebilirsin; yeni ay, bu dönemin bittiği andan başlar: ${renewUrl}`,
    "",
    "Yenilemezsen hiçbir şey yapman gerekmez ve ücret alınmaz.",
    "Risk değerlendirmesidir, hukuki görüş değildir.",
  ];
  const html = `<p>${name ? `Merhaba ${esc(name)},` : "Merhaba,"}</p>
<p><strong>${esc(label)}</strong> dönemin <strong>${esc(ends)}</strong> tarihinde bitiyor. Paket kendiliğinden yenilenmez ve kartından otomatik çekim yapılmaz.</p>
<p><a href="${esc(renewUrl)}">Ajans paketini yenile</a>. Yeni ay, bu dönemin bittiği andan başlar.</p>
<p>Yenilemezsen hiçbir şey yapman gerekmez ve ücret alınmaz.</p>
<p style="color:#56607a;font-size:13px">Risk değerlendirmesidir, hukuki görüş değildir.</p>`;
  return { subject, text: lines.join("\n"), html };
}

/**
 * Sends one reminder per period, PLAN_REMINDER_DAYS before it ends, only when the owner has not bought
 * the next month yet. The period is claimed before sending and released if the send fails, so a rerun
 * never sends twice and a failed send is retried on the next run.
 */
export async function sendPlanReminders(admin: AdminRepo, email: EmailProvider, siteUrl: string, now = new Date()) {
  let sent = 0;
  let failed = 0;
  for (const due of await admin.listPlanRenewalsDue(now, PLAN_REMINDER_DAYS)) {
    if (!(await admin.claimPlanReminder(due.periodId))) continue;
    const res = await email.send({ to: due.email, idempotencyKey: `plan-renewal:${due.periodId}`, ...buildPlanReminderEmail(due, siteUrl) });
    if (res.ok) sent++;
    else {
      failed++;
      await admin.releasePlanReminder(due.periodId);
    }
  }
  return { sent, failed };
}
