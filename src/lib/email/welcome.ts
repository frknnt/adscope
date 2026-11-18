import { RULE_CATALOG, type Sector } from "@/lib/rules/catalog";
import { GUIDE_SLUGS } from "@/lib/guides/guides";
import { SECTOR_INFO } from "@/lib/sectors";

/** Days after signup. Step 7 promotes paid packages, so it is a commercial message (ETK/İYS). */
export const WELCOME_STEPS = [0, 1, 3, 7, 14] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number];
export const COMMERCIAL_STEPS: ReadonlySet<WelcomeStep> = new Set([7]);
const DAY = 86_400_000;

/**
 * The step due for an account created at `createdAt`. A step stays due for two days, so a missed
 * daily run is caught up once; older steps are never sent late (no burst for older accounts).
 */
export function dueStep(createdAt: string, now: Date): WelcomeStep | null {
  const days = Math.floor((now.getTime() - Date.parse(createdAt)) / DAY);
  if (!Number.isFinite(days) || days < 0) return null;
  const step = [...WELCOME_STEPS].reverse().find((s) => s <= days);
  return step !== undefined && days - step <= 1 ? step : null;
}

export interface WelcomeContext {
  siteUrl: string;
  displayName: string | null;
  sector: Sector | null;
  balance: number;
  unsubscribeUrl: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const DISCLAIMER = "AdScope bir risk değerlendirmesi aracıdır, hukuki görüş değildir. Sonuçlar reklamın onaylanacağını garanti etmez.";

/** Three sector risks from the rule cards (active cards first; unverified ones are labelled). */
export function sectorRisks(sector: Sector | null) {
  const pick = sector && sector !== "genel" ? sector : "genel";
  const cards = RULE_CATALOG.filter((r) => r.sector === pick && r.domain !== "creative_quality" && r.status !== "draft");
  const sorted = [...cards.filter((r) => r.status === "active"), ...cards.filter((r) => r.status !== "active")];
  return sorted.slice(0, 3).map((r) => ({ title: r.title, verified: r.status === "active" }));
}

function guideUrl(siteUrl: string, sector: Sector | null) {
  const slug = Object.entries(GUIDE_SLUGS).find(([, s]) => s === sector)?.[0];
  return slug ? `${siteUrl}/rehber/${slug}` : `${siteUrl}/rehber`;
}

export function buildWelcomeEmail(step: WelcomeStep, ctx: WelcomeContext) {
  const name = ctx.displayName?.trim().slice(0, 80) || null;
  const hello = name ? `Merhaba ${name},` : "Merhaba,";
  const u = ctx.siteUrl;
  let subject: string;
  let paragraphs: string[];
  let list: string[] = [];
  let cta: { label: string; href: string };

  switch (step) {
    case 0:
      subject = "AdScope'a hoş geldin: ilk reklamını yayından önce kontrol et";
      paragraphs = [
        "Hesabın hazır. İlk 3 analiz kredisi hesabında.",
        "Görselini ve reklam metnini yükle; AdScope Meta, Google Ads ve TikTok politikalarına ve Türk reklam mevzuatına göre risk taşıyan ifadeleri işaretler, daha güvenli bir metin ve varyantlar önerir.",
        "Kredi yalnızca rapor başarıyla tamamlandığında düşer.",
      ];
      cta = { label: "İlk analizini başlat", href: `${u}/panel/yeni` };
      break;
    case 1:
      subject = "Bir AdScope raporu nasıl okunur?";
      paragraphs = ["Raporun üç bölümü var. Her bulgunun yanında dayandığı kural kartı ve resmî kaynak yazar."];
      list = [
        "Risk özeti: platform ve mevzuat açısından genel tablo.",
        "Bulgular: hangi ifadenin neden dikkat çektiği; doğrulanmış kurallar ile incelemedeki kurallar ayrı gösterilir.",
        "Güvenli metin ve varyantlar: aynı mesajı daha düşük riskle anlatan öneriler.",
      ];
      cta = { label: "Örnek raporu gör", href: `${u}/#rapor` };
      break;
    case 3: {
      const label = ctx.sector ? SECTOR_INFO[ctx.sector].long : "Genel";
      const risks = sectorRisks(ctx.sector);
      subject = `${label} reklamlarında sık görülen 3 risk`;
      paragraphs = ["Sektörün için kural kartlarımızda en sık karşılaşılan başlıklar şunlar:"];
      list = risks.map((r) => (r.verified ? r.title : `${r.title} (kaynak incelemede)`));
      cta = { label: "Sektör rehberini aç", href: guideUrl(u, ctx.sector) };
      break;
    }
    case 7:
      subject = `Kalan kredin: ${ctx.balance}. İhtiyacına göre paketler`;
      paragraphs = [
        `Şu an hesabında ${ctx.balance} kredi var. Görsel analizi 1, video analizi 2 kredidir.`,
        "Daha fazla reklam kontrol edeceksen abonelik olmadan kredi paketi alabilirsin.",
      ];
      cta = { label: "Paketleri gör", href: `${u}/fiyatlandirma` };
      break;
    case 14:
      subject = "AdScope'u nasıl buldun?";
      paragraphs = [
        "İki haftadır AdScope kullanıyorsun. Neyin işine yaradığını ve neyin eksik kaldığını duymak isteriz.",
        "Bu e-postayı yanıtlayabilir ya da rapordaki bulguların yanındaki geri bildirim düğmelerini kullanabilirsin.",
      ];
      cta = { label: "Raporlarına git", href: `${u}/panel/gecmis` };
      break;
  }

  const commercial = COMMERCIAL_STEPS.has(step);
  const footer = commercial
    ? "Bu e-postayı ticari ileti onayı verdiğin için aldın."
    : "Bu e-postayı AdScope hesabın olduğu için aldın; hesabını kullanmana yardım eden bilgilendirme e-postasıdır.";

  const text = [hello, "", ...paragraphs, ...(list.length ? ["", ...list.map((l) => `- ${l}`)] : []), "", `${cta.label}: ${cta.href}`, "", footer, `E-postalardan çık: ${ctx.unsubscribeUrl}`, DISCLAIMER].join("\n");
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#14213d">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<p style="font-size:13px;letter-spacing:.04em;color:#5b6478;margin:0 0 18px">ADSCOPE</p>
<h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${esc(subject)}</h1>
<p style="margin:0 0 14px">${esc(hello)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join("\n")}
${list.length ? `<ul style="margin:0 0 20px;padding-left:20px">${list.map((l) => `<li style="margin:0 0 8px">${esc(l)}</li>`).join("")}</ul>` : ""}
<p style="margin:8px 0 24px"><a href="${esc(cta.href)}" style="display:inline-block;background:#14213d;color:#f6f3ec;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:bold">${esc(cta.label)}</a></p>
<p style="font-size:12px;color:#5b6478;margin:0 0 6px">${esc(footer)} <a href="${esc(ctx.unsubscribeUrl)}" style="color:#5b6478">E-postalardan çık</a></p>
<p style="font-size:12px;color:#5b6478;margin:0">${esc(DISCLAIMER)}</p>
</div></body></html>`;
  return { subject, text, html, commercial };
}
