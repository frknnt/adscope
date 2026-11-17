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
  await expect(page.getByRole("heading", { name: "Önce bunu düzelt" })).toBeVisible();
  // Level filter: "Sarı" hides the red group.
  const reds = page.locator("[data-sev=red]");
  // Retried: a click that lands before hydration does nothing.
  await expect(async () => {
    await page.getByRole("button", { name: /^Sarı \d/ }).click();
    await expect(reds).toBeHidden({ timeout: 1000 });
  }).toPass();
  await page.getByRole("button", { name: /^Tümü \d/ }).click();
  await expect(reds).toBeVisible();
  await page.getByRole("tab", { name: "Güvenli metin ve varyantlar" }).click();
  await expect(page.getByRole("heading", { name: "Güvenli metin önerisi" })).toBeVisible();
  await expect(page.getByText("Önce: senin metnin")).toBeVisible();
  await expect(page.locator("section[aria-labelledby=guvenli] del").first()).toBeVisible();
  await expect(page.locator("section[aria-labelledby=varyantlar] > ol > li")).toHaveCount(5);
  await page.getByRole("tab", { name: "İtiraz" }).click();
  await expect(page.getByRole("heading", { name: "İtiraz asistanı" })).toBeVisible();
  await expect(page.getByText(/Öneri: itiraz yerine/)).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  const body = (await page.locator("main").textContent()) ?? "";
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
  await expect(pb.getByText("Henüz rapor yok.")).toBeVisible();
  await pb.goto("/panel");
  await expect(pb.getByRole("heading", { name: "Başlarken" })).toBeVisible();
  await a.close();
  await b.close();
});

test("history delete, demo credits, appeal from the assistant and account deletion", async ({ page }) => {
  const email = await signUp(page);
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
  await page.getByRole("button", { name: /^İşlemler: / }).first().click();
  await page.getByRole("menuitem", { name: "Sil" }).click();
  const dialog = page.getByRole("dialog", { name: "Rapor silinsin mi?" });
  await expect(dialog).toContainText("Düşülen kredi geri yüklenmez");
  await dialog.getByRole("button", { name: "Kalıcı olarak sil" }).click();
  await expect(page.getByText("Henüz rapor yok.")).toBeVisible();

  await page.goto("/panel/ayarlar");
  await page.getByLabel("Saklama süresi (gün)").fill("30");
  await page.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ }).first()).toContainText("Ayarlar kaydedildi");
  await page.getByRole("button", { name: "Hesabımı sil…" }).click();
  const del = page.getByRole("dialog", { name: "Hesap kalıcı olarak silinsin mi?" });
  await del.getByLabel("Onaylamak için e-posta adresini yaz").fill("baska@example.com");
  await del.getByRole("button", { name: /Hesabımı ve tüm verilerimi sil/ }).click();
  await expect(del.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("e-posta adresini aynen");
  await del.getByLabel("Onaylamak için e-posta adresini yaz").fill(email);
  await del.getByRole("button", { name: /Hesabımı ve tüm verilerimi sil/ }).click();
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

test("dashboard and reports: real numbers, URL filters, list view, bulk CSV and delete", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  for (const text of ["7 günde 5 kilo ver! Garantili sonuç, %70 indirim.", "Yeni sezon bitki çaylarımız mağazada."]) {
    await page.goto("/panel/yeni");
    await page.locator("input[type=file]").setInputFiles("tests/fixtures/ad.png");
    await page.getByRole("button", { name: "Devam" }).click();
    await page.getByLabel("Ana metin").fill(text);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Devam" }).click();
    await page.getByRole("button", { name: "Atla" }).click();
    await page.getByRole("button", { name: "Analizi başlat" }).click();
    await page.waitForURL(/\/panel\/analiz\//, { timeout: 60_000 });
  }

  await page.goto("/panel");
  const summary = page.getByRole("region", { name: "Özet" });
  await expect(summary.getByRole("link", { name: /Kalan kredi\s*1/ })).toBeVisible();
  await expect(summary).toContainText(/Bu ay yapılan analiz\s*2/);
  await expect(page.getByRole("heading", { name: "Son raporlar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Başlarken" })).toHaveCount(0);

  await page.goto("/panel/gecmis?q=bitki");
  await expect(page.getByText("2 rapordan 1 tanesi süzgece uyuyor.")).toBeVisible();
  await expect(page.locator("article h3")).toHaveText(["Yeni sezon bitki çaylarımız mağazada."]);
  await page.goto("/panel/gecmis?platform=tiktok");
  await expect(page.getByText("Bu süzgece uyan rapor yok.")).toBeVisible();
  await page.goto("/panel/gecmis?risk=bogus&platform=x");
  await expect(page.getByText("2 rapor", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Liste" }).click();
  await expect(page).toHaveURL(/gorunum=liste/);
  await expect(page.getByRole("region", { name: "Raporlar tablosu" }).locator("tbody tr")).toHaveCount(2);
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.getByRole("checkbox", { name: "Tümünü seç (2)" }).check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Seçilenleri CSV indir" }).click()]);
  const csv = readFileSync(await download.path(), "utf8");
  expect(csv.split("\r\n").filter(Boolean)).toHaveLength(3);
  expect(csv).toContain("Risk değerlendirmesidir, hukuki görüş değildir.");

  await page.getByRole("button", { name: "Seçilenleri sil" }).click();
  await page.getByRole("dialog", { name: "2 rapor silinsin mi?" }).getByRole("button", { name: "Kalıcı olarak sil" }).click();
  await expect(page.getByText("Henüz rapor yok.")).toBeVisible();
});

test("new analysis: text draft is offered back, preview follows the platform", async ({ page, isMobile }) => {
  await signUp(page);
  await page.goto("/panel/yeni");
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Ana metin").fill("Taslak metnim: yeni sezon çayları.");
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByRole("button", { name: "Taslağı geri yükle" }).click();
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByLabel("Ana metin")).toHaveValue("Taslak metnim: yeni sezon çayları.");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("radio", { name: "TikTok" }).check({ force: true });
  if (isMobile) await page.getByText("Önizlemeyi göster").click();
  await expect(page.getByText("TikTok akışında yaklaşık görünüm").locator("visible=true")).toBeVisible();
  await noHorizontalScroll(page);
});
