/* AdScope service worker (P7.4).
 * - Caches only fingerprinted build assets and icons. HTML, the panel, the API and anything behind a
 *   session are never cached, so no report or account data is stored on the device by this worker.
 * - Offline navigations get a small static offline page.
 * - Share target: POST /paylas (from the OS share sheet) is kept in a short-lived local cache and the
 *   user is sent to the new-analysis wizard, which reads it once and deletes it.
 */
const VERSION = "v1";
const STATIC = `adscope-static-${VERSION}`;
const SHARE = "adscope-share";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("adscope-static-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function stashShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE);
    await Promise.all((await cache.keys()).map((k) => cache.delete(k)));
    const meta = {
      title: String(form.get("title") || "").slice(0, 300),
      text: String(form.get("text") || "").slice(0, 2200),
      url: String(form.get("url") || "").slice(0, 2048),
      at: Date.now(),
      file: null,
    };
    const file = form.get("media");
    if (file && typeof file === "object" && file.size > 0 && file.size <= 200 * 1024 * 1024 && /^(image|video)\//.test(file.type)) {
      meta.file = { name: String(file.name || "paylasim").slice(0, 120), type: file.type };
      await cache.put("/__share/file", new Response(file, { headers: { "Content-Type": file.type } }));
    }
    await cache.put("/__share/meta", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
  } catch (e) {
    /* nothing is stored when the shared item cannot be read */
  }
  return Response.redirect("/panel/yeni?paylasim=1", 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.method === "POST" && url.pathname === "/paylas") {
    event.respondWith(stashShare(req));
    return;
  }
  if (req.method !== "GET") return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  }
});
