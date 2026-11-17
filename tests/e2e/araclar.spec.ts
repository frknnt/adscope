import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { balance, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

// Fake Photoroom on the port configured in playwright.config.ts. It records what it receives.
let server: Server;
const received: { path: string; key: string; body: string }[] = [];
const PNG = readFileSync("tests/fixtures/ad.png");

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    received.push({ path: req.url ?? "", key: String(req.headers["x-api-key"] ?? ""), body: Buffer.concat(chunks).toString("latin1") });
    res.writeHead(200, { "content-type": "image/png" }).end(PNG);
  });
  await new Promise<void>((r) => server.listen(3197, "127.0.0.1", r));
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

async function axeClean(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
}

test("local tools resize, crop and watermark in the browser for free", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  const start = await balance(page);
  await page.goto("/panel/araclar?arac=boyut");
  await expect(page.getByRole("heading", { name: "Boyutlandır ve kırp", level: 2 })).toBeVisible();
  await page.locator("#yukle-boyut").setInputFiles("tests/fixtures/ad.png");
  await page.getByLabel("Dikey 4:5").check();
  await page.getByLabel("Genişlik (piksel)").fill("540");
  await page.getByRole("button", { name: "Görseli hazırla · ücretsiz" }).click();
  await expect(page.getByRole("img", { name: "Hazırlanan görsel, 540×675" })).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("link", { name: "İndir (540×675)" }).click();
  expect((await dl).suggestedFilename()).toBe("adscope-540x675.png");
  await noHorizontalScroll(page);
  await axeClean(page);

  await page.goto("/panel/araclar?arac=filigran");
  await page.locator("#yukle-filigran").setInputFiles("tests/fixtures/ad.png");
  await page.getByLabel("Metin", { exact: true }).check();
  await page.getByLabel("Filigran metni").fill("@çınar");
  await page.getByRole("button", { name: "Filigranı ekle · ücretsiz" }).click();
  await expect(page.getByRole("img", { name: "Hazırlanan görsel, 1080×1080" })).toBeVisible();
  await axeClean(page);
  // Nothing was sent to the provider and nothing was charged.
  expect(received).toHaveLength(0);
  expect(await balance(page)).toBe(start);
});

test("provider tools: background removal and four product scenes with credits", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  await page.goto("/panel/araclar?arac=sahne");
  await expect(page.getByText("Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği")).toBeVisible();
  // Three signup credits are not enough for a five-credit scene.
  await expect(page.getByText("Bu işlem 5 kredi; bakiyen 3.")).toBeVisible();
  await noHorizontalScroll(page);
  await axeClean(page);

  await page.goto("/panel/araclar?arac=arka-plan");
  await page.locator("#yukle-remove_background").setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Arka planı kaldır · 1 kredi" }).click();
  await expect(page.getByRole("img", { name: "Sonuç 1" })).toBeVisible();
  await expect(page.getByText("1 kredi düştü.")).toBeVisible();
  expect(received.at(-1)).toMatchObject({ path: "/v1/segment", key: "e2e-fake-key" });
  expect(received.at(-1)!.body).toContain('filename="urun.png"');
  expect(await balance(page)).toBe(2);

  await page.goto("/panel/araclar?arac=buyut");
  await page.locator("#yukle-upscale").setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Büyüt · 2 kredi" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "en fazla 1000×1000 piksel olmalı" })).toBeVisible();

  await page.goto("/panel/krediler");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: /Demo: 30 kredi ekle/ }).click();
  await expect.poll(() => balance(page)).toBe(32);

  await page.goto("/panel/araclar?arac=sahne");
  await page.locator("#yukle-product_scene").setInputFiles("tests/fixtures/ad.png");
  await page.getByLabel("Mermer").check();
  await page.getByLabel("Kısa sahne açıklaması (isteğe bağlı)").fill("yanında limon, bilgi: ayse@ornek.com");
  const before = received.length;
  await page.getByRole("button", { name: "4 sahne üret · 5 kredi" }).click();
  await expect(page.getByRole("img", { name: /^Sonuç \d$/ })).toHaveCount(4);
  const sent = received.slice(before);
  expect(sent).toHaveLength(4);
  for (const r of sent) {
    expect(r.path).toBe("/v2/edit");
    expect(r.body).toContain("polished white marble");
    expect(r.body).not.toContain("ayse@ornek.com");
  }
  await axeClean(page);
  expect(await balance(page)).toBe(27);
});
