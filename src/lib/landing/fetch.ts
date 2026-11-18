import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import zlib from "node:zlib";
import { extractLanding } from "@/lib/engine/landing";
import type { LandingSnapshot } from "@/lib/engine/types";
import { appMode } from "@/lib/env";

/**
 * Fetches a user-supplied landing page URL with SSRF protection:
 *  - http/https only, default ports only, no credentials in the URL;
 *  - every DNS answer is checked against private, loopback, link-local, CGNAT, multicast and
 *    reserved ranges at connect time (so DNS rebinding between check and connect is not possible);
 *  - redirects are followed manually (max 4) and each hop is checked again;
 *  - 8 s total timeout, 1.5 MB body cap, HTML only. Cookies are never sent.
 * The page content is treated as untrusted data: it is only text-matched, never executed or rendered.
 */

const MAX_BYTES = 1.5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["64:ff9b::", 96], ["100::", 64]] as const) blocked.addSubnet(net, prefix, "ipv6");

/** True only in local end-to-end runs that point the fetcher at a fixture server. */
export function testHostsAllowed() {
  return allowPrivate();
}

function allowPrivate() {
  // Only for local end-to-end tests against a fixture server. Never honoured in production.
  return process.env.LANDING_SCAN_ALLOW_PRIVATE === "true" && appMode() !== "production" && process.env.NODE_ENV !== "production";
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(address, "ipv6");
  }
  return true;
}

export function validateLandingUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && !((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) && !allowPrivate()) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return allowPrivate() ? u : null;
  }
  if (isIP(host) && isBlockedAddress(host) && !allowPrivate()) return null;
  u.hash = "";
  return u;
}

type Raw = { status: number; headers: http.IncomingHttpHeaders; body: Buffer | null; error?: LandingSnapshot["status"] };

export function guardedLookup(hostname: string, options: object, cb: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(hostname, { ...(options as object), all: true }, (err, addresses) => {
    if (err) return cb(err, "", 4);
    const list = (addresses as LookupAddress[]) ?? [];
    if (!list.length || (!allowPrivate() && list.some((a) => isBlockedAddress(a.address)))) {
      const e = new Error("blocked_address") as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return cb(e, "", 4);
    }
    const wantsAll = (options as { all?: boolean }).all;
    if (wantsAll) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

type Want = { accept: string; types: RegExp; maxBytes: number; notType: LandingSnapshot["status"] };
const HTML: Want = { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", types: /text\/html|application\/xhtml\+xml/i, maxBytes: MAX_BYTES, notType: "not_html" };
const IMAGE: Want = { accept: "image/png,image/jpeg,image/webp;q=0.9", types: /^image\/(png|jpeg|webp)\b/i, maxBytes: 2 * 1024 * 1024, notType: "not_html" };

function requestOnce(url: URL, deadline: number, want: Want = HTML): Promise<Raw> {
  return new Promise((resolve) => {
    const lib = url.protocol === "https:" ? https : http;
    const remaining = Math.max(500, deadline - Date.now());
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as typeof dnsLookup,
        timeout: remaining,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AdScopeLandingCheck/1.0)",
          Accept: want.accept,
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: null });
        }
        const type = String(res.headers["content-type"] ?? "");
        if (!want.types.test(type)) {
          res.destroy();
          return resolve({ status, headers: res.headers, body: null, error: want.notType });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > want.maxBytes) {
          res.destroy();
          return resolve({ status, headers: res.headers, body: null, error: "too_large" });
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          enc === "gzip" ? res.pipe(zlib.createGunzip()) : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : enc === "deflate" ? res.pipe(zlib.createInflate()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = (r: Raw) => {
          if (done) return;
          done = true;
          resolve(r);
        };
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > want.maxBytes) {
            res.destroy();
            finish({ status, headers: res.headers, body: null, error: "too_large" });
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => finish({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", () => finish({ status, headers: res.headers, body: null, error: "unreachable" }));
      },
    );
    // `timeout` above only catches an idle socket; this hard limit also stops a server that drips bytes slowly.
    const hard = setTimeout(() => {
      req.destroy();
      resolve({ status: 0, headers: {}, body: null, error: "timeout" });
    }, remaining);
    req.on("close", () => clearTimeout(hard));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, headers: {}, body: null, error: "timeout" });
    });
    req.on("error", (e: NodeJS.ErrnoException) => resolve({ status: 0, headers: {}, body: null, error: e.code === "EBLOCKED" ? "blocked" : "unreachable" }));
    req.end();
  });
}

function decode(body: Buffer, contentType: string) {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 2048).toString("latin1"))?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Follows redirects (each hop re-validated) and returns the final body, or the reason it failed. */
async function safeGet(rawUrl: string, want: Want): Promise<{ status: LandingSnapshot["status"]; finalUrl: string | null; body: Buffer | null; contentType: string }> {
  const start = validateLandingUrl(rawUrl);
  if (!start) return { status: "invalid_url", finalUrl: null, body: null, contentType: "" };
  const deadline = Date.now() + TIMEOUT_MS;
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await requestOnce(url, deadline, want);
    if (r.error) return { status: r.error, finalUrl: url.toString(), body: null, contentType: "" };
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.location;
      const next = loc ? validateLandingUrl(new URL(String(loc), url).toString()) : null;
      if (!next) return { status: loc ? "blocked" : "http_error", finalUrl: url.toString(), body: null, contentType: "" };
      url = next;
      continue;
    }
    if (r.status < 200 || r.status >= 300 || !r.body) return { status: "http_error", finalUrl: url.toString(), body: null, contentType: "" };
    return { status: "ok", finalUrl: url.toString(), body: r.body, contentType: String(r.headers["content-type"] ?? "") };
  }
  return { status: "http_error", finalUrl: url.toString(), body: null, contentType: "" };
}

/** Fetches an HTML page with the same SSRF protection; returns the decoded HTML (untrusted data). */
export async function fetchHtml(rawUrl: string): Promise<{ ok: true; html: string; finalUrl: string } | { ok: false; status: LandingSnapshot["status"] }> {
  const r = await safeGet(rawUrl, HTML);
  if (r.status !== "ok" || !r.body || !r.finalUrl) return { ok: false, status: r.status };
  return { ok: true, html: decode(r.body, r.contentType), finalUrl: r.finalUrl };
}

/** Fetches a PNG/JPEG/WebP image (max 2 MB) with the same SSRF protection. The bytes still need file validation. */
export async function fetchImage(rawUrl: string): Promise<{ ok: true; bytes: Uint8Array; contentType: string } | { ok: false }> {
  const r = await safeGet(rawUrl, IMAGE);
  if (r.status !== "ok" || !r.body) return { ok: false };
  return { ok: true, bytes: new Uint8Array(r.body), contentType: r.contentType.split(";")[0].trim().toLowerCase() };
}

export async function fetchLanding(rawUrl: string): Promise<LandingSnapshot> {
  const fetchedAt = new Date().toISOString();
  const empty = { title: "", description: "", h1: [] as string[], text: "" };
  const start = validateLandingUrl(rawUrl);
  if (!start) {
    return { requestedUrl: rawUrl.slice(0, 2048), finalUrl: null, status: "invalid_url", httpStatus: null, https: false, ...empty, fetchedAt };
  }
  const deadline = Date.now() + TIMEOUT_MS;
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await requestOnce(url, deadline);
    const snapBase = { requestedUrl: start.toString(), finalUrl: url.toString(), httpStatus: r.status || null, https: url.protocol === "https:", fetchedAt };
    if (r.error) return { ...snapBase, status: r.error, ...empty };
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.location;
      const next = loc ? validateLandingUrl(new URL(String(loc), url).toString()) : null;
      if (!next) return { ...snapBase, status: loc ? "blocked" : "http_error", ...empty };
      url = next;
      continue;
    }
    if (r.status < 200 || r.status >= 300 || !r.body) return { ...snapBase, status: "http_error", ...empty };
    const html = decode(r.body, String(r.headers["content-type"] ?? ""));
    return { ...snapBase, status: "ok", source: "fetch", ...extractLanding(html) };
  }
  return { requestedUrl: start.toString(), finalUrl: url.toString(), status: "http_error", httpStatus: null, https: url.protocol === "https:", ...empty, fetchedAt };
}
