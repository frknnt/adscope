/**
 * Brand kit: colours, typeface, tagline, audience note, mandatory phrases and website.
 * Pure helpers shared by the brand form, the analysis engine and creative rendering.
 */

/** Typefaces we may embed: all published under the SIL Open Font License, all cover Turkish letters. */
export const BRAND_FONTS = [
  { id: "inter", label: "Inter", family: "Inter" },
  { id: "manrope", label: "Manrope", family: "Manrope" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat" },
  { id: "poppins", label: "Poppins", family: "Poppins" },
  { id: "nunito", label: "Nunito", family: "Nunito" },
  { id: "playfair-display", label: "Playfair Display (serif)", family: "Playfair Display" },
] as const;
export type BrandFontId = (typeof BRAND_FONTS)[number]["id"];
export const BRAND_FONT_IDS = BRAND_FONTS.map((f) => f.id) as [BrandFontId, ...BrandFontId[]];

export const HEX_RE = /^#[0-9a-f]{6}$/;

/** Accepts "#abc", "abc", "#AABBCC"; returns "#aabbcc" or null. */
export function normalizeHex(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s.split("").map((c) => c + c).join("")}`;
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return null;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

/** White or near-black text, whichever reads better on the given background. */
export function textOn(bg: string): "#ffffff" | "#0b1b3f" {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#0b1b3f") ? "#ffffff" : "#0b1b3f";
}

export interface ContrastNote {
  ok: boolean;
  ratio: number;
  message: string;
}

/** Plain-language check for text written on the brand colour. 4.5 is the WCAG AA minimum for body text. */
export function contrastNote(bg: string): ContrastNote {
  const fg = textOn(bg);
  const ratio = contrastRatio(bg, fg);
  if (ratio >= 4.5) return { ok: true, ratio, message: `Bu renk üzerinde ${fg === "#ffffff" ? "beyaz" : "koyu"} yazı rahat okunur (kontrast ${ratio}:1).` };
  if (ratio >= 3) return { ok: false, ratio, message: `Kontrast ${ratio}:1. Büyük başlıklar için yeterli, küçük yazı için düşük. Rengi biraz koyulaştırmayı ya da açmayı dene.` };
  return { ok: false, ratio, message: `Kontrast ${ratio}:1. Bu renk üzerindeki yazı zor okunur; reklamlarda zemin rengi olarak kullanma.` };
}

/** Mandatory phrases ("Kampanya stokla sınırlıdır."): one per line, at most 10, each at most 160 characters. */
export function normalizeRequiredPhrases(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/\n/);
  const out: string[] = [];
  for (const x of list) {
    const p = x.trim().replace(/\s+/g, " ").slice(0, 160);
    if (p.length < 3) continue;
    if (!out.some((y) => y.toLocaleLowerCase("tr-TR") === p.toLocaleLowerCase("tr-TR"))) out.push(p);
    if (out.length >= 10) break;
  }
  return out;
}

/** https only, no credentials; returns the normalised URL or null. */
export function normalizeWebsite(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    u.hash = "";
    const out = u.toString();
    return out.length <= 300 ? out : null;
  } catch {
    return null;
  }
}

export interface SiteSuggestion {
  name: string | null;
  tagline: string | null;
  themeColor: string | null;
  /** Absolute https URL of a logo-like image found on the page; fetched again on save, never trusted. */
  logoUrl: string | null;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function attr(tag: string, name: string) {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? null;
}

function meta(html: string, names: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const n = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    if (names.includes(n)) {
      const c = attr(tag, "content");
      if (c && c.trim()) return decodeEntities(c);
    }
  }
  return null;
}

function absHttps(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(decodeEntities(href), base);
    return u.protocol === "https:" && !/\.(svg|ico)(\?|$)/i.test(u.pathname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Reads suggestions from a fetched page. The HTML is untrusted: only a few meta values are read,
 * trimmed and length-limited; nothing is executed or rendered.
 */
export function extractSiteSuggestion(html: string, pageUrl: string): SiteSuggestion {
  const head = html.slice(0, 200_000);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const siteName = meta(head, ["og:site_name", "application-name"]);
  const name = (siteName || (title ? decodeEntities(title).split(/\s[|\-–—·:]\s/)[0] : "") || "").slice(0, 80) || null;
  const tagline = (meta(head, ["description", "og:description"]) ?? "").slice(0, 120) || null;
  const themeColor = normalizeHex(meta(head, ["theme-color", "msapplication-tilecolor"]));
  let logoUrl: string | null = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    if (rel.includes("apple-touch-icon")) {
      logoUrl = absHttps(attr(tag, "href"), pageUrl);
      if (logoUrl) break;
    }
  }
  if (!logoUrl) logoUrl = absHttps(meta(head, ["og:logo"]), pageUrl);
  if (!logoUrl) {
    const img = /<img\b[^>]*\b(?:alt|class|id)\s*=\s*["'][^"']*logo[^"']*["'][^>]*>/i.exec(head)?.[0];
    if (img) logoUrl = absHttps(attr(img, "src"), pageUrl);
  }
  return { name, tagline, themeColor, logoUrl };
}
