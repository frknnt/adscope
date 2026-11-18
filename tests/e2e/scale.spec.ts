import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

async function axeClean(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
}

test("enterprise API: usage chart, webhooks with a one-time signing secret, OpenAPI document", async ({ page, baseURL }) => {
  await signUp(page);
  await page.goto("/panel/api");
  await expect(page.getByRole("heading", { name: "İstek sayısı" })).toBeVisible();
  await expect(page.getByText("Son 14 günde")).toContainText("0 istek");

  await page.getByLabel("Anahtar adı").fill("CRM");
  await page.getByRole("button", { name: "Anahtar oluştur" }).click();
  const keyDialog = page.getByRole("dialog", { name: "Yeni API anahtarın" });
  const key = await keyDialog.locator("code").filter({ hasText: /^ads_live_/ }).innerText();
  await keyDialog.getByRole("button", { name: "Kopyaladım, kapat" }).click();
  for (let i = 0; i < 2; i++) expect((await page.request.get(`${baseURL}/api/v1/analyses`, { headers: { Authorization: `Bearer ${key}` } })).status()).toBe(200);
  await page.reload();
  await expect(page.getByText("Son 14 günde")).toContainText("2 istek");

  // Webhooks: only public https addresses; the secret is shown once.
  await page.getByLabel("Webhook adresi").fill("http://127.0.0.1:9/hook");
  await page.getByRole("button", { name: "Webhook ekle" }).click();
  await expect(page.getByText(/https:\/\/ ile başlamalı/)).toBeVisible();
  await page.getByLabel("Webhook adresi").fill("https://hooks.ornek.com.tr/adscope");
  await page.getByRole("button", { name: "Webhook ekle" }).click();
  const hookDialog = page.getByRole("dialog", { name: "Webhook imza anahtarı" });
  await expect(hookDialog.locator("code").filter({ hasText: /^whsec_[A-Za-z0-9_-]{32}$/ })).toBeVisible();
  await hookDialog.getByRole("button", { name: "Kopyaladım, kapat" }).click();
  await expect(hookDialog).toBeHidden();
  const item = page.getByRole("listitem").filter({ hasText: "https://hooks.ornek.com.tr/adscope" });
  await expect(item).toContainText("henüz gönderim yok");
  await page.reload();
  await expect(page.locator("body")).not.toContainText("whsec_");
  await page.getByText("İmzayı doğrulama").click();
  await expect(page.getByLabel("Doğrulama örneği")).toContainText("createHmac");
  await axeClean(page);
  await page.getByRole("listitem").filter({ hasText: "https://hooks.ornek.com.tr/adscope" }).getByRole("button", { name: "Sil" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "https://hooks.ornek.com.tr/adscope" })).toHaveCount(0);

  const doc = await page.request.get(`${baseURL}/api/v1/openapi.json`);
  expect(doc.status()).toBe(200);
  const spec = await doc.json();
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.paths["/api/v1/analyses"].post).toBeTruthy();
  expect(spec.webhooks["analysis.completed"]).toBeTruthy();

  // The job worker needs the cron secret.
  expect((await page.request.get(`${baseURL}/api/cron/jobs`)).status()).toBe(401);
  const cron = await page.request.get(`${baseURL}/api/cron/jobs`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? "e2e-cron-secret-0123456789"}` } });
  expect(cron.status()).toBe(200);
  expect(await cron.json()).toMatchObject({ ok: true });
});

test("installable app: manifest, offline page, and a shared text lands in the wizard", async ({ page, baseURL }) => {
  const manifest = await (await page.request.get(`${baseURL}/manifest.webmanifest`)).json();
  expect(manifest).toMatchObject({ short_name: "AdScope", display: "standalone", start_url: "/panel", share_target: { action: "/paylas", method: "POST" } });
  for (const icon of manifest.icons) expect((await page.request.get(`${baseURL}${icon.src}`)).headers()["content-type"]).toBe("image/png");
  expect((await page.request.get(`${baseURL}/sw.js`)).status()).toBe(200);
  const offline = await page.request.get(`${baseURL}/offline.html`);
  expect(await offline.text()).toContain("İnternet bağlantısı yok");
  // Without the worker, a share POST reaching the server is ignored and redirected.
  const fallback = await page.request.post(`${baseURL}/paylas`, { multipart: { text: "gizli" }, maxRedirects: 0 });
  expect(fallback.status()).toBe(303);
  expect(fallback.headers().location).toMatch(/\/panel\/yeni$/);

  await signUp(page);
  // The worker registers itself in production builds; the dev server used here registers it by hand.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // What the OS share sheet sends: a multipart POST to the share target.
  await page.evaluate(() => {
    const f = document.createElement("form");
    f.method = "POST";
    f.action = "/paylas";
    f.enctype = "multipart/form-data";
    for (const [k, v] of [["title", "Yaz kampanyası"], ["text", "Yazın en hafif desteği: günlük rutinine eşlik eden bitki çayı."]]) {
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = k;
      i.value = v;
      f.appendChild(i);
    }
    document.body.appendChild(f);
    f.submit();
  });
  await page.waitForURL("**/panel/yeni**");
  await expect(page.getByText("Telefonundan paylaştığın içerik aktarıldı")).toBeVisible();
  await expect(page).toHaveURL(/\/panel\/yeni$/);
  // Read once: the local copy is gone.
  expect(await page.evaluate(async () => Boolean(await (await caches.open("adscope-share")).match("/__share/meta")))).toBe(false);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.unregister());
});
