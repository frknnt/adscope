import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DISCLAIMER, FORBIDDEN, balance, noHorizontalScroll, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

let server: Server;
let origin = "";

test.beforeAll(async () => {
  // A tiny landing page the app's server can fetch (private addresses are allowed only in the demo test server).
  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><head><title>Vita Plus detoks çayı</title><script>window.secret = 1</script></head>
      <body><h1>Detoks çayı</h1><p>Şimdi %20 indirimle 499 TL. Ücretsiz kargo.</p></body></html>`);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((r) => server.close(r));
});

test("video/Reels analysis: frames only, transcript scanned, landing page checked", async ({ page }, info) => {
  const withLanding = info.project.name.startsWith("demo");
  await signUp(page);
  await page.goto("/panel/yeni");

  await page.getByRole("radio", { name: "Video / Reels" }).check({ force: true });
  await expect(page.getByText("video cihazından çıkmaz")).toBeVisible();

  // A file the browser cannot decode gets a clear, non-technical message.
  const input = page.locator("input[type=file]");
  await input.setInputFiles({ name: "bozuk.mp4", mimeType: "video/mp4", buffer: Buffer.from("not a video at all") });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("MP4 (H.264)");

  await input.setInputFiles("tests/fixtures/reel.webm");
  await expect(page.getByAltText(/^Kare 1,/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByAltText(/^Kare \d,/)).toHaveCount(5);
  await expect(page.getByText(/5 kare analiz edilecek/)).toBeVisible();

  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Ana metin").fill("Yeni detoks çayımız Reels’te! Hemen sipariş ver.");
  await page.getByLabel(/Videodaki konuşma ve ekran yazıları/).fill("Bu çay ile 7 günde 5 kilo verin, garantili sonuç! Şimdi %50 indirim.");
  // Client-side URL check.
  await page.getByLabel(/Açılış sayfası bağlantısı/).fill("bu bir adres değil");
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByText("Geçerli bir web adresi gir")).toBeVisible();
  await page.getByLabel(/Açılış sayfası bağlantısı/).fill(withLanding ? `${origin}/kampanya` : "");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Atla" }).click();
  await expect(page.getByText(/Video · 4 sn · 5 kare/)).toBeVisible();
  await page.getByRole("button", { name: "Analizi başlat" }).click();
  await page.waitForURL(/\/panel\/analiz\/[0-9a-f-]{36}$/, { timeout: 60_000 });

  // Report: frames instead of an image, transcript findings, video notes.
  await expect(page.getByAltText(/saniyesindeki kare/)).toBeVisible();
  await expect(page.getByText("Videodaki konuşma ve ekran yazıları")).toBeVisible();
  await expect(page.getByText(/· Video metni/).first()).toBeVisible();
  await expect(page.getByText("Video çözünürlüğü düşük").first()).toBeVisible();
  await expect(page.getByText("Reels formatı").first()).toBeVisible();
  if (withLanding) {
    const landing = page.getByRole("region", { name: "Açılış sayfası taraması" });
    await expect(landing).toBeVisible();
    await expect(landing).toContainText("Sayfa okundu");
    await expect(landing).toContainText("İndirim oranı sayfada da var");
    await expect(landing).toContainText("Vita Plus detoks çayı");
    await expect(landing).not.toContainText("secret");
  }
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  const body = await page.locator("main").innerText();
  for (const re of FORBIDDEN) expect(body).not.toMatch(re);
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  const assetBase = page.url().replace("/panel/analiz/", "/api/analyses/") + "/asset";
  const frame = await page.request.get(`${assetBase}?frame=0`);
  expect(frame.status()).toBe(200);
  expect(frame.headers()["content-type"]).toBe("image/jpeg");
  expect((await page.request.get(`${assetBase}?frame=9`)).status()).toBe(404);
  expect((await page.request.get(`${assetBase}?frame=abc`)).status()).toBe(404);
  expect((await page.request.get(assetBase)).status()).toBe(404); // a video analysis has no creative image

  await page.goto("/panel/gecmis");
  await expect(page.getByText(/^Video · /).first()).toBeVisible();
  expect(await balance(page)).toBe(2);
});

test("video and landing inputs are validated on the server and cost nothing", async ({ page }) => {
  await signUp(page);
  const base = { brandId: null, sector: "genel", headline: "", primaryText: "Merhaba", description: "", rejectionMessage: null, flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } };
  const jpeg = { name: "kare.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not a jpeg") };
  const video = { mime: "video/mp4", durationSec: 10, width: 1080, height: 1920, sizeBytes: 1000, frameTimesMs: [0] };

  // Frames that are not real images.
  const r1 = await page.request.post("/api/analyses", { multipart: { payload: JSON.stringify({ ...base, clientRequestId: crypto.randomUUID(), mediaType: "video", video }), frames: jpeg } });
  expect(r1.status()).toBe(400);
  // A video without its metadata.
  const r2 = await page.request.post("/api/analyses", { multipart: { payload: JSON.stringify({ ...base, clientRequestId: crypto.randomUUID(), mediaType: "video", video: null }), frames: jpeg } });
  expect(r2.status()).toBe(400);
  // A landing URL that is not http(s).
  const r3 = await page.request.post("/api/analyses", {
    multipart: { payload: JSON.stringify({ ...base, clientRequestId: crypto.randomUUID(), landingUrl: "javascript:alert(1)" }), image: { name: "ad.png", mimeType: "image/png", buffer: (await import("node:fs")).readFileSync("tests/fixtures/ad.png") } },
  });
  expect(r3.status()).toBe(400);
  expect((await r3.json()).code).toBe("invalid_landing_url");
  for (const r of [r1, r2, r3]) expect(JSON.stringify(await r.json())).not.toMatch(/stack|Error:|supabase|postgres/i);
  expect(await balance(page)).toBe(3);
});

test("season calendar lists upcoming periods and exports .ics", async ({ page }) => {
  await signUp(page);
  await page.goto("/panel/takvim");
  await expect(page.getByRole("heading", { level: 1, name: "Sezon takvimi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sezon takvimi" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByText(/Diyanet’in resmî takvimiyle doğrulanmadı/)).toBeVisible();
  await expect(page.getByRole("link", { name: /TR-RY-INDIRIM-REFERANS/ }).first()).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();

  await page.getByRole("link", { name: "Estetik / klinik" }).click();
  await expect(page).toHaveURL(/sektor=estetik_klinik/);
  await expect(page.getByRole("link", { name: "Estetik / klinik" })).toHaveAttribute("aria-current", "page");

  const ics = await page.request.get("/panel/takvim/ics?sektor=estetik_klinik");
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const text = await ics.text();
  expect(text.startsWith("BEGIN:VCALENDAR")).toBe(true);
  expect(text).toContain("BEGIN:VEVENT");

  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.goto("/panel");
  await expect(page.getByText(/Sıradaki dönem:/)).toBeVisible();
});

test("calendar export requires a session", async ({ request }) => {
  const r = await request.get("/panel/takvim/ics", { maxRedirects: 0 });
  expect([307, 308, 401]).toContain(r.status());
});
