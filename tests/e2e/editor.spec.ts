import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { balance, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

async function openStudio(page: Page, brand: boolean) {
  await page.goto("/panel/uret?sekme=gorsel");
  await page.getByLabel("Başlık").fill("Sabah kahven artık evde");
  await page.getByLabel("Kısa metin (isteğe bağlı)").fill("Taze çekilmiş çekirdekler, ılık ve yoğun aroma.");
  await page.getByLabel("Çağrı (isteğe bağlı)").fill("Hemen incele");
  if (brand) await page.getByLabel("Marka kiti").selectOption({ label: "Vita Plus" });
  await page.getByRole("button", { name: "Önizlemeleri göster" }).click();
  await expect(page.locator("#gorseller").getByRole("heading", { name: "Manşet", level: 3 })).toBeVisible();
}

async function previewReady(page: Page) {
  const img = page.getByRole("img", { name: /önizleme$/ });
  await expect.poll(async () => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), { timeout: 20000 }).toBeGreaterThan(0);
  return img;
}

const num = async (page: Page, label: string) => Number(await page.getByLabel(label, { exact: true }).inputValue());

test("layered editor: drag, keyboard move, live rule hint, apply to all sizes, undo, paid download", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  const start = await balance(page);
  await openStudio(page, false);
  await page.getByRole("link", { name: /Düzenle\s*: Manşet/ }).click();
  await page.waitForURL(/\/panel\/uret\/duzenle\?/);
  await expect(page.getByRole("heading", { name: "Görseli düzenle" })).toBeVisible();
  const first = await (await previewReady(page)).getAttribute("src");

  // Select the headline on the canvas and drag it down by about a tenth of the canvas.
  const box = page.getByRole("button", { name: "Başlık katmanı" });
  await box.click();
  const x0 = await num(page, "X");
  const y0 = await num(page, "Y");
  const bb = (await box.boundingBox())!;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 - 20, bb.y + bb.height / 2 - 30, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => num(page, "Y")).toBeLessThan(y0 - 10);
  const xDragged = await num(page, "X");
  expect(xDragged).toBeLessThan(x0);
  // The server redraws the preview from the moved layer.
  await expect.poll(async () => page.getByRole("img", { name: /önizleme$/ }).getAttribute("src"), { timeout: 20000 }).not.toBe(first);

  // Keyboard: arrow keys move the focused layer.
  await box.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => num(page, "X")).toBe(Math.round(xDragged + 10));

  // Live rule hint while typing; the safe version is one click away. No credit is spent.
  const text = page.getByLabel("Metin", { exact: true });
  await text.fill("Garantili sonuç, en etkili kahve");
  const hints = page.getByRole("list", { name: "Canlı kural uyarıları" });
  await expect(hints).toBeVisible();
  await expect(hints.getByText(/Kırmızı bayrak|Sarı bayrak|Bilgilendirme/).first()).toBeVisible();
  const before = await text.inputValue();
  await hints.locator("summary").first().click();
  const apply = hints.getByRole("button", { name: /Güvenli sürümü uygula/ }).first();
  if (await apply.count()) {
    await apply.click();
    await expect.poll(() => text.inputValue()).not.toBe(before);
  }

  // Apply to all sizes, then the story size has no safe-area warning.
  await page.getByRole("button", { name: "Tüm boyutlara uygula" }).click();
  await page.getByRole("button", { name: "Hikâye 9:16" }).click();
  await previewReady(page);
  await expect(page.getByRole("region", { name: "Denetim" }).or(page.locator("section", { has: page.getByRole("heading", { name: "Denetim" }) }))).not.toContainText("güvenli alanın dışında");

  // Undo steps back through the history.
  const storyHeadlineText = await page.getByRole("button", { name: "Başlık katmanı" }).count();
  expect(storyHeadlineText).toBe(1);
  await page.getByRole("button", { name: "Geri al" }).click();
  await expect(page.getByRole("button", { name: "Yinele" })).toBeEnabled();

  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  // Download: one credit, a PNG of the story size.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG indir (Hikâye 9:16)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("adscope-manset-1080x1920.png");
  expect(await balance(page)).toBe(start - 1);
});

test("brand template: save from the editor, reuse with new copy on the creative tab", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  await openStudio(page, true);
  await expect(page.getByText("Bu markanın kayıtlı şablonu yok.")).toBeVisible();
  await page.getByRole("link", { name: /Düzenle\s*: Etiket/ }).click();
  await page.waitForURL(/\/panel\/uret\/duzenle\?/);
  await previewReady(page);
  // Hide the body layer and save the layout as the brand's template.
  await page.getByRole("button", { name: "Metin: gizle" }).click();
  await page.getByLabel("Şablon adı").fill("Kahve duyurusu");
  await page.getByRole("button", { name: "Şablonu kaydet" }).click();
  await expect(page.getByText(/"Kahve duyurusu" şablonu kaydedildi/)).toBeVisible();

  await openStudio(page, true);
  await page.getByLabel("Başlık").fill("Yeni hasat çekirdekler geldi, şimdi denemenin tam zamanı");
  await page.getByRole("button", { name: "Önizlemeleri göster" }).click();
  const section = page.locator("#marka-sablonlari").locator("..");
  await expect(page.getByRole("heading", { name: "Kahve duyurusu", level: 4 })).toBeVisible();
  const img = page.getByRole("img", { name: /Kahve duyurusu şablonu/ });
  await img.scrollIntoViewIfNeeded();
  await expect.poll(async () => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), { timeout: 20000 }).toBe(432);
  const start = await balance(page);
  await openStudio(page, true);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /PNG indir \(Kare 1:1\)\s*: Kahve duyurusu/ }).click();
  expect((await download).suggestedFilename()).toBe("adscope-kahve-duyurusu-1080x1080.png");
  expect(await balance(page)).toBe(start - 1);
  // The template opens in the editor again.
  await openStudio(page, true);
  await page.getByRole("link", { name: /Düzenle\s*: Kahve duyurusu/ }).click();
  await expect(page.getByText("Başlangıç: Kahve duyurusu.")).toBeVisible();
  await previewReady(page);
  void section;
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("live rule hints in the analysis wizard: underline, count for screen readers, safe version", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Devam" }).click();
  const field = page.getByLabel("Ana metin");
  await field.fill("7 günde 5 kilo ver! Garantili sonuç, en etkili detoks çayı.");
  const hints = page.getByRole("list", { name: "Canlı kural uyarıları" }).first();
  await expect(hints).toBeVisible();
  await expect(page.locator("[aria-live=polite]").filter({ hasText: /Ana metin: \d+ riskli ifade/ })).toHaveCount(1);
  await expect(page.locator(".live-u-red, .live-u-yellow, .live-u-info").first()).toBeAttached();
  const before = await field.inputValue();
  await hints.locator("summary").first().click();
  await expect(hints.getByRole("link", { name: /Kural kartı/ }).first()).toBeVisible();
  const applyAll = hints.getByRole("button", { name: /Güvenli sürümü uygula/ });
  await expect(applyAll.first()).toBeAttached();
  // Open each item until one offers a ready replacement.
  const items = hints.locator("details");
  for (let i = 0; i < (await items.count()); i++) await items.nth(i).locator("summary").click();
  await applyAll.first().click();
  await expect.poll(() => field.inputValue()).not.toBe(before);
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});
