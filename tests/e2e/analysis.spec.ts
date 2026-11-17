import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DISCLAIMER, FORBIDDEN, balance, fillWizard, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

test("signup → wizard → result → report → appeal, charging exactly one credit", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("3 analiz kredin hazır");
  await onboard(page);

  // Failed-upload states: wrong content and too small.
  const input = page.locator("input[type=file]");
  await input.setInputFiles({ name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("Görsel okunamadı");
  await input.setInputFiles("tests/fixtures/tiny.png");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("çok küçük");
  await input.setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("Yalnızca JPG, PNG veya WebP");

  // Empty primary text is blocked.
  await input.setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("Reklam ana metni gerekli");
  await page.getByRole("button", { name: "Geri" }).click();

  await page.goto("/panel/yeni");
  await fillWizard(page, { rejection: "Your ad wasn't approved because it doesn't follow our Advertising Standards on unrealistic outcomes." });
  await page.getByRole("button", { name: "Analizi başlat" }).click();
  await page.waitForURL(/\/panel\/analiz\/[0-9a-f-]{36}$/, { timeout: 60_000 });

  await expect(page.getByText("Meta ret riski").first()).toBeVisible();
  await expect(page.getByText("Türk mevzuatı riski")).toBeVisible();
  await expect(page.getByText("Kreatif skoru").first()).toBeVisible();
  await expect(page.getByText("Kırmızı bayrak").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /META-UO-TIMEFRAME/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Güvenli metin önerisi" })).toBeVisible();
  await expect(page.locator("section[aria-labelledby=varyantlar] > ol > li")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "İtiraz asistanı" })).toBeVisible();
  await expect(page.getByText(/Öneri: itiraz yerine/)).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  const body = await page.locator("main").innerText();
  for (const re of FORBIDDEN) expect(body).not.toMatch(re);
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  const img = await page.request.get(page.url().replace("/panel/analiz/", "/api/analyses/") + "/asset");
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");

  const reportUrl = page.url() + "/rapor";
  await page.goto(reportUrl);
  await expect(page.getByRole("heading", { name: "Reklam ön kontrol raporu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /PDF olarak kaydet/ })).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();

  expect(await balance(page)).toBe(2);
});

test("double click and server-side upload validation never double-charge", async ({ page }) => {
  await signUp(page);
  await page.goto("/panel/yeni");
  await fillWizard(page);
  const start = page.getByRole("button", { name: "Analizi başlat" });
  await start.dblclick();
  await page.waitForURL(/\/panel\/analiz\//, { timeout: 60_000 });
  expect(await balance(page)).toBe(2);

  // Spoofed upload straight to the API is rejected and costs nothing.
  const payload = JSON.stringify({ clientRequestId: crypto.randomUUID(), brandId: null, sector: "genel", headline: "", primaryText: "Merhaba", description: "", rejectionMessage: null, flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } });
  const bad = await page.request.post("/api/analyses", { multipart: { payload, image: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") } } });
  expect(bad.status()).toBe(400);
  const badJson = await bad.json();
  expect(JSON.stringify(badJson)).not.toMatch(/stack|Error:|supabase|postgres/i);

  // Same request id twice through the API: one analysis, one charge.
  const id = crypto.randomUUID();
  const same = JSON.stringify({ ...JSON.parse(payload), clientRequestId: id });
  const image = { name: "ad.png", mimeType: "image/png", buffer: readFileSync("tests/fixtures/ad.png") };
  const [r1, r2] = await Promise.all([
    page.request.post("/api/analyses", { multipart: { payload: same, image } }),
    page.request.post("/api/analyses", { multipart: { payload: same, image } }),
  ]);
  const ids = await Promise.all([r1.json(), r2.json()]);
  expect(ids[0].analysisId).toBe(ids[1].analysisId);
  expect(await balance(page)).toBe(1);
});

test("users cannot see each other's analyses or files", async ({ browser }) => {
  const a = await browser.newContext();
  const pa = await a.newPage();
  await signUp(pa);
  await pa.goto("/panel/yeni");
  await fillWizard(pa);
  await pa.getByRole("button", { name: "Analizi başlat" }).click();
  await pa.waitForURL(/\/panel\/analiz\//, { timeout: 60_000 });
  const url = new URL(pa.url());

  const b = await browser.newContext();
  const pb = await b.newPage();
  await signUp(pb);
  const res = await pb.goto(url.pathname);
  expect(res?.status()).toBe(404);
  const asset = await pb.request.get(url.pathname.replace("/panel/analiz/", "/api/analyses/") + "/asset");
  expect(asset.status()).toBe(404);
  await pb.goto("/panel/gecmis");
  await expect(pb.getByText("Geçmişin boş.")).toBeVisible();
  await a.close();
  await b.close();
});

test("history delete, demo credits, appeal from the assistant and account deletion", async ({ page }) => {
  await signUp(page);
  await page.goto("/panel/yeni");
  await fillWizard(page);
  await page.getByRole("button", { name: "Analizi başlat" }).click();
  await page.waitForURL(/\/panel\/analiz\//, { timeout: 60_000 });

  await page.goto("/panel/itiraz");
  await page.getByLabel("Meta'nın ret mesajı").fill("Ad rejected: personal health and appearance policy");
  await page.getByRole("button", { name: "İtiraz taslağını hazırla" }).click();
  await page.waitForURL(/#itiraz$/);
  await expect(page.getByText("İngilizce taslak (Meta destek formu için)")).toBeVisible();

  await page.goto("/panel/krediler");
  const demoButtons = page.getByRole("button", { name: /Demo: 30 kredi ekle/ });
  if (await demoButtons.count()) {
    await demoButtons.click();
    await expect(page.getByRole("status").filter({ hasText: /\S/ }).first()).toContainText("Gerçek ödeme alınmadı");
    expect(await balance(page)).toBe(32);
  }

  await page.goto("/panel/gecmis");
  await page.getByRole("button", { name: "Analizi ve görselini sil" }).first().click();
  await expect(page.getByText("Geçmişin boş.")).toBeVisible();

  await page.goto("/panel/ayarlar");
  await page.getByLabel("Saklama süresi (gün)").fill("30");
  await page.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ }).first()).toContainText("Ayarlar kaydedildi");
  await page.getByLabel("Onaylamak için SİL yaz").fill("sil");
  await page.getByRole("button", { name: /Hesabımı ve tüm verilerimi sil/ }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/giris/);
});

test("panel pages fit the viewport", async ({ page }) => {
  await signUp(page);
  for (const p of ["/panel", "/panel/yeni", "/panel/gecmis", "/panel/itiraz", "/panel/krediler", "/panel/ayarlar"]) {
    await page.goto(p);
    await expect(page.locator("h1")).toBeVisible();
    await noHorizontalScroll(page);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${p} ${v.id}`)).toEqual([]);
  }
});
