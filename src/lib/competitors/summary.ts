import type { CompetitorSummary } from "@/lib/data/types";

/** Ad fields the weekly summary needs; ad_snapshot_url is never part of it. */
export interface WatchedAd {
  id: string;
  pageName: string;
  titles: string[];
  bodies: string[];
  deliveryStart: string | null;
  deliveryStop: string | null;
  libraryUrl: string;
}

const clip = (s: string, n: number) => [...s.replace(/\s+/g, " ").trim()].slice(0, n).join("");

function daysRunning(ad: WatchedAd, today: Date) {
  if (!ad.deliveryStart) return -1;
  const start = Date.parse(`${ad.deliveryStart}T00:00:00Z`);
  const stop = ad.deliveryStop ? Date.parse(`${ad.deliveryStop}T00:00:00Z`) : today.getTime();
  return Number.isFinite(start) ? Math.max(0, Math.floor((stop - start) / 86_400_000)) : -1;
}

/** New ads since the last check and the three longest-running active ads. */
export function summarize(ads: WatchedAd[], seenIds: string[], today = new Date(), cap = 1000): { summary: CompetitorSummary; seenIds: string[] } {
  const seen = new Set(seenIds);
  const fresh = ads.filter((a) => !seen.has(a.id));
  const longest = [...ads]
    .map((a) => ({ a, days: daysRunning(a, today) }))
    .filter((x) => x.days >= 0)
    .sort((x, y) => y.days - x.days)
    .slice(0, 3)
    .map(({ a, days }) => ({ id: a.id, pageName: clip(a.pageName, 120), title: clip(a.titles[0] ?? "", 160), body: clip(a.bodies[0] ?? "", 280), deliveryStart: a.deliveryStart, days, libraryUrl: a.libraryUrl }));
  // The first check only records what exists; nothing is "new" yet.
  const newCount = seenIds.length ? fresh.length : 0;
  return { summary: { newCount, activeCount: ads.length, longest }, seenIds: [...seenIds, ...fresh.map((a) => a.id)].slice(-cap) };
}

/** ISO week key such as 2026-W47 (Istanbul date). */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildDigest(p: { displayName: string | null; siteUrl: string; watches: { term: string; summary: CompetitorSummary }[] }) {
  const total = p.watches.reduce((a, w) => a + w.summary.newCount, 0);
  const subject = total ? `Rakip izleme: bu hafta ${total} yeni reklam` : "Rakip izleme: haftalık özet";
  const lines = p.watches.map((w) => {
    const top = w.summary.longest[0];
    return `• ${w.term}: bu hafta ${w.summary.newCount} yeni reklam, ${w.summary.activeCount} yayında${top ? `; en uzun yayında kalan ${top.days} gündür (${top.pageName})` : ""}.`;
  });
  const hello = p.displayName ? `Merhaba ${p.displayName},` : "Merhaba,";
  const foot = "Yalnızca AB'de yayınlanan reklamlar Meta Reklam Kütüphanesi API'sinde görünür; yalnızca Türkiye'de yayınlanan ticari reklamlar bu özette yer almaz. Bildirimleri İlham panosundaki Rakip izleme bölümünden kapatabilirsin.";
  const text = [hello, "", "İzlediğin aramaların haftalık özeti:", ...lines, "", `Ayrıntılar: ${p.siteUrl}/panel/ilham#rakip-izleme`, "", foot].join("\n");
  const html = `<p>${esc(hello)}</p><p>İzlediğin aramaların haftalık özeti:</p><ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul><p><a href="${esc(p.siteUrl)}/panel/ilham#rakip-izleme">Panelde ayrıntıları gör</a></p><p style="color:#555;font-size:13px">${esc(foot)}</p>`;
  return { subject, text, html };
}
