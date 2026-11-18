import "server-only";
import type { lookup as dnsLookup } from "node:dns";
import https from "node:https";
import { guardedLookup } from "@/lib/landing/fetch";
import { SIGNATURE_HEADER, signWebhook, validateWebhookUrl } from "./sign";

export type DeliveryResult = { ok: true; status: number } | { ok: false; status: number | null; code: "invalid_url" | "blocked" | "timeout" | "network" | "http" };

/**
 * POSTs one signed JSON event to a customer URL. SSRF-safe: https on 443 only, every DNS answer is
 * checked against private ranges at connect time, no redirects are followed, 5 s timeout, the
 * response body is discarded (at most 16 KB is read). Nothing about the request is logged.
 */
export function deliverWebhook(rawUrl: string, secret: string, body: string, deliveryId: string): Promise<DeliveryResult> {
  const url = validateWebhookUrl(rawUrl);
  if (!url) return Promise.resolve({ ok: false, status: null, code: "invalid_url" });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: DeliveryResult) => {
      if (done) return;
      done = true;
      resolve(r);
    };
    const req = https.request(
      url,
      {
        method: "POST",
        lookup: guardedLookup as unknown as typeof dnsLookup,
        timeout: 5000,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "AdScope-Webhooks/1.0",
          [SIGNATURE_HEADER]: signWebhook(secret, body),
          "X-AdScope-Delivery": deliveryId,
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        let read = 0;
        res.on("data", (c: Buffer) => {
          read += c.length;
          if (read > 16 * 1024) res.destroy();
        });
        res.on("close", () => finish(status >= 200 && status < 300 ? { ok: true, status } : { ok: false, status, code: "http" }));
        res.on("error", () => finish(status >= 200 && status < 300 ? { ok: true, status } : { ok: false, status, code: "http" }));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, status: null, code: "timeout" });
    });
    req.on("error", (e: NodeJS.ErrnoException) => finish({ ok: false, status: null, code: e.code === "EBLOCKED" ? "blocked" : "network" }));
    req.end(body);
  });
}
