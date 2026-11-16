/**
 * Landing page helpers (pure, no network):
 *  - extractLanding: turns raw HTML into title, description, h1s and visible text.
 *  - landingChecks: compares the ad with its landing page and returns a report plus heuristic findings.
 *
 * Heuristic findings are creative_quality notes, never legal or policy violations; the rule engine
 * separately scans the landing text against the same rule cards as the ad.
 */
import { fold } from "./text";
import type { AdInput, EngineFinding, LandingCheck, LandingReport, LandingSnapshot } from "./types";

const MAX_TEXT = 20_000;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ccedil: "ç", Ccedil: "Ç", ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", ndash: "–", mdash: "—", euro: "€", percnt: "%" };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return NAMED[e] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function metaContent(html: string, names: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (name && names.includes(name)) {
      const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (content) return clean(content);
    }
  }
  return "";
}

export function extractLanding(html: string) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|head)\b[\s\S]*?<\/\1>/gi, " ");
  const title = clean(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 200);
  const description = (metaContent(html, ["description", "og:description"]) || "").slice(0, 400);
  const h1 = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => clean(m[1])).filter(Boolean).slice(0, 5).map((x) => x.slice(0, 200));
  const text = clean(body.replace(/<(br|p|div|li|h[1-6]|tr|section|article)\b[^>]*>/gi, " . ")).replace(/(\s\.)+/g, " .").slice(0, MAX_TEXT);
  return { title, description, h1, text };
}

const PERCENT = /%\s?(\d{1,2})(?!\d)|(?<!\d)(\d{1,2})\s?%/g;
const PRICE = /(?:₺\s?(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:,\d{1,2})?)|(?:(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:,\d{1,2})?\s?(?:tl|try|₺)(?![a-z]))/gi;

function percents(s: string) {
  return [...new Set([...s.matchAll(PERCENT)].map((m) => m[1] ?? m[2]))];
}
function prices(s: string) {
  return [...new Set([...s.matchAll(PRICE)].map((m) => (m[1] ?? m[2]).replace(/[.\s]/g, "")))];
}
function words(s: string) {
  return [...new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 5))];
}

const STATUS_TEXT: Record<LandingSnapshot["status"], string> = {
  ok: "Sayfa açıldı.",
  http_error: "Sayfa hata kodu döndürdü.",
  blocked: "Bu adres güvenlik nedeniyle taranmadı (yerel veya özel ağ adresi).",
  unreachable: "Sayfaya ulaşılamadı.",
  not_html: "Adres bir web sayfası değil (HTML dönmedi).",
  too_large: "Sayfa çok büyük olduğu için taranmadı.",
  timeout: "Sayfa zamanında yanıt vermedi.",
  invalid_url: "Adres geçerli bir http(s) bağlantısı değil.",
};

function heuristic(field: EngineFinding["field"], severity: EngineFinding["severity"], title: string, explanation: string, suggestion: string, matchedText: string | null = null): EngineFinding {
  return { ruleId: null, ruleVersionId: null, ruleStatus: null, domain: "creative_quality", severity, field, matchedText, title, explanation, suggestion, origin: "heuristic" };
}

export function landingChecks(input: AdInput, snap: LandingSnapshot): { report: LandingReport; findings: EngineFinding[] } {
  const checks: LandingCheck[] = [];
  const findings: EngineFinding[] = [];
  const base = { requestedUrl: snap.requestedUrl, finalUrl: snap.finalUrl, status: snap.status, httpStatus: snap.httpStatus, title: snap.title, fetchedAt: snap.fetchedAt };

  const reachable = snap.status === "ok";
  checks.push({
    key: "reachable",
    label: "Sayfa açılıyor",
    ok: reachable,
    detail: reachable ? `HTTP ${snap.httpStatus ?? 200}${snap.finalUrl && snap.finalUrl !== snap.requestedUrl ? ` · yönlendirildi: ${snap.finalUrl}` : ""}` : `${STATUS_TEXT[snap.status]}${snap.httpStatus ? ` (HTTP ${snap.httpStatus})` : ""}`,
  });
  if (!reachable) {
    if (snap.status !== "blocked" && snap.status !== "invalid_url") {
      findings.push(
        heuristic("landing_page", "yellow", "Açılış sayfası açılmadı", `${STATUS_TEXT[snap.status]} Çalışmayan veya hata veren bir hedef sayfa, reklamın incelemede reddedilmesine ya da tıklamaların boşa gitmesine yol açabilir.`, "Bağlantıyı tarayıcıda ve mobilde açarak kontrol edin; yönlendirmelerin ve stok/ürün sayfasının çalıştığından emin olun."),
      );
    }
    return { report: { ...base, checks }, findings };
  }

  const https = snap.https;
  checks.push({ key: "https", label: "Güvenli bağlantı (HTTPS)", ok: https, detail: https ? "Sayfa HTTPS üzerinden açılıyor." : "Sayfa HTTPS kullanmıyor." });
  if (!https) findings.push(heuristic("landing_page", "yellow", "Açılış sayfası HTTPS değil", "Şifrelenmemiş sayfalar tarayıcıda 'güvenli değil' uyarısı gösterir; ödeme ve form içeren sayfalarda güven kaybına yol açar.", "Sitenizi HTTPS'e taşıyın ve reklamda https:// ile başlayan adresi kullanın."));

  const page = `${snap.title} ${snap.description} ${snap.h1.join(" ")} ${snap.text}`;
  const pageFolded = fold(page);
  // A video's spoken and on-screen text makes offers too, so it is compared with the page as well.
  const adText = `${input.headline} ${input.primaryText} ${input.description} ${input.transcript ?? ""}`;

  const adPercents = percents(adText);
  if (adPercents.length) {
    const pagePercents = new Set(percents(page));
    const missing = adPercents.filter((p) => !pagePercents.has(p));
    checks.push({ key: "discount", label: "İndirim oranı sayfada da var", ok: missing.length === 0, detail: missing.length ? `Sayfada bulunamadı: ${missing.map((m) => `%${m}`).join(", ")}` : `Reklamdaki oran sayfada geçiyor: ${adPercents.map((m) => `%${m}`).join(", ")}` });
    if (missing.length) {
      findings.push(heuristic("landing_page", "yellow", "Reklamdaki indirim oranı açılış sayfasında yok", `Reklamda ${missing.map((m) => `%${m}`).join(", ")} geçiyor ama açılış sayfasında bu oran bulunamadı. Reklam ile sayfa arasındaki tutarsızlık hem Meta incelemesinde hem tüketici şikâyetlerinde risk oluşturur.`, "İndirim oranını ve koşullarını açılış sayfasında da aynı şekilde gösterin veya reklamdan çıkarın.", missing.map((m) => `%${m}`).join(", ")));
    }
  } else {
    checks.push({ key: "discount", label: "İndirim oranı sayfada da var", ok: null, detail: "Reklamda indirim oranı yok." });
  }

  const adPrices = prices(adText);
  if (adPrices.length) {
    const pagePrices = new Set(prices(page));
    const missing = adPrices.filter((p) => !pagePrices.has(p));
    checks.push({ key: "price", label: "Fiyat sayfada da aynı", ok: missing.length === 0, detail: missing.length ? `Sayfada bulunamadı: ${missing.map((m) => `${m} TL`).join(", ")}` : "Reklamdaki fiyat sayfada geçiyor." });
    if (missing.length) {
      findings.push(heuristic("landing_page", "yellow", "Reklamdaki fiyat açılış sayfasında yok", `Reklamda geçen ${missing.map((m) => `${m} TL`).join(", ")} fiyatı açılış sayfasında bulunamadı.`, "Reklamdaki fiyatın sayfada aynı şekilde göründüğünden emin olun; fiyat değiştiyse reklamı güncelleyin.", missing.map((m) => `${m} TL`).join(", ")));
    }
  } else {
    checks.push({ key: "price", label: "Fiyat sayfada da aynı", ok: null, detail: "Reklamda fiyat yok." });
  }

  if (input.brandName?.trim()) {
    const found = pageFolded.includes(fold(input.brandName.trim()));
    checks.push({ key: "brand", label: "Marka adı sayfada geçiyor", ok: found, detail: found ? `“${input.brandName}” sayfada geçiyor.` : `“${input.brandName}” sayfada bulunamadı.` });
    if (!found) findings.push(heuristic("landing_page", "info", "Marka adı açılış sayfasında görünmüyor", "Reklamı veren marka ile açılış sayfası arasında bağ kurulamazsa kullanıcı güveni düşer.", "Sayfanın üst kısmında marka adını ve logoyu gösterin."));
  }

  const adWords = words(`${input.headline} ${input.primaryText}`).slice(0, 25);
  if (adWords.length >= 3) {
    const pageWords = new Set(words(page));
    const shared = adWords.filter((w) => pageWords.has(w));
    const ratio = shared.length / adWords.length;
    const ok = ratio >= 0.2;
    checks.push({ key: "relevance", label: "Reklam ile sayfa konusu örtüşüyor", ok, detail: `Reklamdaki anahtar kelimelerin %${Math.round(ratio * 100)} kadarı sayfada geçiyor.` });
    if (!ok) findings.push(heuristic("landing_page", "info", "Reklam ile açılış sayfası zayıf örtüşüyor", "Reklamdaki ürün ve fayda ifadelerinin çoğu sayfada geçmiyor. Kullanıcı reklamda gördüğünü sayfada hemen bulamazsa çıkar.", "Kullanıcıyı ana sayfa yerine doğrudan ilgili ürün veya kampanya sayfasına gönderin."));
  }

  const promo = /indirim|kampanya|firsat|%/.test(fold(adText));
  if (promo) {
    const hasTerms = /kosul|son gun|son tarih|gecerli|stoklarla sinirli/.test(pageFolded);
    checks.push({ key: "terms", label: "Kampanya koşulları sayfada", ok: hasTerms, detail: hasTerms ? "Sayfada kampanya koşulu veya süresine dair ifade var." : "Sayfada kampanya koşulu veya süresine dair ifade bulunamadı." });
    if (!hasTerms) findings.push(heuristic("landing_page", "info", "Kampanya koşulları açılış sayfasında görünmüyor", "İndirim veya kampanya duyuran reklamlarda koşulların ve sürenin tüketiciye açıkça sunulması beklenir.", "Kampanya süresini, kapsamını ve varsa şartları açılış sayfasında açıkça yazın."));
  }

  checks.push({ key: "title", label: "Sayfa başlığı var", ok: Boolean(snap.title), detail: snap.title ? `“${snap.title}”` : "Sayfanın <title> etiketi boş." });

  return { report: { ...base, checks }, findings };
}
