import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { balance, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

// Fake Gemini Interactions API on the port configured in playwright.config.ts.
let server: Server;
const received: { key: string; body: { model: string; input: { type: string; text?: string; mime_type?: string }[]; response_format: Record<string, string> } }[] = [];
const PNG = readFileSync("tests/fixtures/ad.png");
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42"), Buffer.alloc(2000, 1)]);
let failNext = false;

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    received.push({ key: String(req.headers["x-goog-api-key"] ?? ""), body });
    if (failNext) {
      failNext = false;
      return res.writeHead(429, { "content-type": "application/json" }).end("{}");
    }
    const video = body.response_format?.type === "video";
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ id: "i1", object: "interaction", status: "completed", steps: [{ type: "model_output", content: [{ type: video ? "video" : "image", mime_type: video ? "video/mp4" : "image/png", data: (video ? MP4 : PNG).toString("base64") }] }] }),
    );
  });
  await new Promise<void>((r) => server.listen(3196, "127.0.0.1", r));
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

async function axeClean(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
}

test("AI images and AI video: Gemini request shape, per-result credits, nothing charged on failure", async ({ page }) => {
  test.setTimeout(180_000);
  await signUp(page);
  await onboard(page);
  await page.goto("/panel/araclar");
  await expect(page.getByRole("heading", { name: "Yapay zekâ görseli", level: 2 })).toBeVisible();
  await expect(page.getByText("gerçek bir çekim değildir")).toBeVisible();
  await noHorizontalScroll(page);
  await axeClean(page);

  // Two images with a product photo, 4:5.
  await page.getByLabel("Ne görmek istiyorsun?").fill("Mermer tezgâhta sabah ışığında cam şişe, iletişim: ayse@ornek.com");
  await page.locator("#yukle-ai_image").setInputFiles("tests/fixtures/ad.png");
  await page.getByLabel("Dikey 4:5").check();
  await page.getByRole("button", { name: "2 görsel üret · 2 kredi" }).click();
  await expect(page.getByRole("img", { name: /^Üretilen görsel \d$/ })).toHaveCount(2);
  await expect(page.getByText("2 kredi düştü.")).toBeVisible();
  const sent = received.slice(-2);
  for (const r of sent) {
    expect(r.key).toBe("e2e-fake-gemini-key");
    expect(r.body.model).toBe("gemini-nano-banana-2.1");
    expect(r.body.response_format).toMatchObject({ type: "image", aspect_ratio: "4:5", image_size: "1K" });
    expect(r.body.input[0]).toMatchObject({ type: "image", mime_type: "image/png" });
    const text = r.body.input.at(-1)!.text!;
    expect(text).toContain("Mermer tezgâhta");
    expect(text).not.toContain("ayse@ornek.com");
    expect(text).toContain("keep the product exactly as it is");
  }
  expect(await balance(page)).toBe(1);

  // Provider busy: nothing charged.
  await page.goto("/panel/araclar?arac=yz-gorsel");
  await page.getByLabel("Ne görmek istiyorsun?").fill("Sade beyaz zeminde kahve fincanı");
  await page.getByLabel("1", { exact: true }).check();
  failNext = true;
  await page.getByRole("button", { name: "1 görsel üret · 1 kredi" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "kredin düşmedi" })).toBeVisible();
  expect(await balance(page)).toBe(1);

  // Video needs 8 credits.
  await page.goto("/panel/araclar?arac=yz-video");
  await expect(page.getByText("Bu işlem 8 kredi; bakiyen 1.")).toBeVisible();
  await page.goto("/panel/krediler");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: /Demo: 30 kredi ekle/ }).click();
  await expect.poll(() => balance(page)).toBe(31);
  await page.goto("/panel/araclar?arac=yz-video");
  await page.getByLabel("Ne görmek istiyorsun?").fill("Kamera ürüne yavaşça yaklaşıyor, sıcak gün ışığı");
  await page.getByLabel("Dikey 9:16 (Reels, TikTok)").check();
  await page.getByRole("button", { name: "Video üret · 8 kredi" }).click();
  await expect(page.getByLabel("Üretilen video 1")).toBeVisible();
  const v = received.at(-1)!;
  expect(v.body.model).toBe("gemini-omni-1.1-flash");
  expect(v.body.response_format).toMatchObject({ type: "video", aspect_ratio: "9:16", resolution: "720p" });
  const href = await page.locator('a[download$=".mp4"]').getAttribute("href");
  const file = await page.request.get(href!);
  expect(file.headers()["content-type"]).toBe("video/mp4");
  const part = await page.request.get(href!, { headers: { Range: "bytes=0-9" } });
  expect(part.status()).toBe(206);
  expect((await part.body()).byteLength).toBe(10);
  expect(await balance(page)).toBe(23);
});
