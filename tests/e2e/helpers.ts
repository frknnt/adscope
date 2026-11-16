import { expect, type Page } from "@playwright/test";

export const FORBIDDEN = [/kesin onay/i, /hukuken uygundur/i, /reklam reddedilmez/i];
export const DISCLAIMER = "Risk değerlendirmesidir, hukuki görüş değildir";

export async function signUp(page: Page, email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`) {
  await page.goto("/kayit");
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Şifre").fill("Test-sifre-123");
  await page.locator("input[name=terms]").check();
  await page.locator("input[name=kvkk]").check();
  await page.getByRole("button", { name: /Hesap oluştur/ }).click();
  await page.waitForURL("**/panel/baslangic");
  return email;
}

export async function onboard(page: Page) {
  await page.getByLabel("Marka adı (isteğe bağlı)").fill("Vita Plus");
  await page.locator("input[name=sector][value=takviye_gida]").check({ force: true });
  await page.getByRole("button", { name: "Kaydet ve ilk analize geç" }).click();
  await page.waitForURL("**/panel/yeni");
}

export async function fillWizard(page: Page, opts: { rejection?: string } = {}) {
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/ad.png");
  await expect(page.getByAltText(/Yüklenecek reklam görselinin/)).toBeVisible();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Ana metin").fill("7 günde 5 kilo ver! Garantili sonuç, %70 indirim. En etkili detoks çayı. Hemen sipariş ver.");
  await page.getByLabel("Başlık (isteğe bağlı)").fill("Yazın en etkili desteği");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  if (opts.rejection) {
    await page.getByLabel("Meta ret mesajı (isteğe bağlı)").fill(opts.rejection);
    await page.getByRole("button", { name: "Devam" }).click();
  } else {
    await page.getByRole("button", { name: "Atla" }).click();
  }
  await expect(page.getByRole("heading", { name: /Kontrol et ve başlat/ })).toBeVisible();
}

export async function balance(page: Page) {
  await page.goto("/panel/krediler");
  const text = await page.locator("main p").first().innerText();
  return Number(text.match(/Bakiye:\s*(\d+)/)?.[1] ?? NaN);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}
