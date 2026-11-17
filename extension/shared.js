// Shared helpers for the popup and the service worker. No network requests are made here:
// the extension only opens a tab on the AdScope site the user configured.

export const MAX_TEXT = 2200;

/** Accepts https:// sites, or http:// only for localhost during development. */
export function normalizeSite(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  return url.origin;
}

export async function getSite() {
  const { site } = await chrome.storage.sync.get("site");
  return normalizeSite(site);
}

/**
 * Builds the wizard address. The text travels in the URL fragment (#…), which browsers never send
 * to the server, so ad copy does not end up in request logs. The wizard removes it after reading.
 */
export function checkUrl(site, { text = "", headline = "", landing = "" } = {}) {
  const p = new URLSearchParams({ platform: "meta" });
  const t = String(text).replace(/\s+\n/g, "\n").trim().slice(0, MAX_TEXT);
  if (t) p.set("metin", t);
  if (headline) p.set("baslik", String(headline).trim().slice(0, 255));
  if (/^https?:\/\//i.test(landing)) p.set("url", String(landing).slice(0, 2048));
  return `${site}/panel/yeni#${p.toString()}`;
}
