import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { balance, noHorizontalScroll, onboard, signUp } from "./helpers";

test("ads manager report: upload, column mapping, totals, best and worst ads, no raw file kept", async ({ page }) => {
  await signUp(page);
  await onboard(page);
  await page.goto("/panel/performans");
  await expect(page.getByRole("heading", { name: "Performans", level: 1 })).toBeVisible();
  await page.getByLabel("Reklam Yöneticisi dışa aktarımı (CSV ya da XLSX)").setInputFiles("tests/fixtures/meta-rapor.csv");
  await expect(page.getByText(/8 satır okundu/)).toBeVisible();
  await expect(page.getByLabel(/^Reklam adı/)).toHaveValue("2");
  await expect(page.getByLabel(/^Harcanan tutar/)).toHaveValue("3");
  // Unmapping a required column blocks the import.
  await page.getByLabel(/^Gösterim/).selectOption("");
  await expect(page.getByText(/Eşleşmeyen zorunlu sütun: Gösterim/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Raporu içe aktar" })).toBeDisabled();
  await page.getByLabel(/^Gösterim/).selectOption("4");
  await expect(page.getByLabel(/Anonim toplamlarla/)).not.toBeChecked();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.getByLabel("Rapor adı").fill("Kasım kampanyası");
  await page.getByRole("button", { name: "Raporu içe aktar" }).click();
  await expect(page).toHaveURL(/rapor=/);
  const report = page.locator("#rapor");
  await expect(report.getByRole("heading", { name: "Kasım kampanyası" })).toBeVisible();
  await expect(report.getByText(/6 reklam/).first()).toBeVisible();
  await expect(report.getByText(/1 hücrede sayı yerine formül/)).toBeVisible();
  await expect(report.getByRole("heading", { name: /En iyi 5/ })).toBeVisible();
  await expect(report.getByLabel("En iyi 5 reklam").getByText("Termos C")).toBeVisible();
  await expect(report.getByLabel("En kötü 5 reklam").getByText("Kupa F")).toBeVisible();
  await expect(report.getByText("Risk değerlendirmesidir, hukuki görüş değildir.")).toBeVisible();
  await expect(report.getByText(/anonim katkı: kapalı/)).toBeVisible();
  await report.getByRole("button", { name: "Katkıyı aç" }).click();
  await expect(report.getByText(/anonim katkı: açık/)).toBeVisible();
  const axe2 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe2.violations).toEqual([]);
  await report.getByRole("button", { name: "Raporu sil" }).click();
  await expect(page.getByText("Henüz rapor yok.")).toBeVisible();
});

test("admin panel: only app_metadata admins get in; credit adjustments need a reason and are audited", async ({ page }) => {
  // A regular user sees a plain 404.
  await signUp(page);
  expect((await page.goto("/yonetim"))?.status()).toBe(404);
  expect((await page.goto("/yonetim/kullanicilar"))?.status()).toBe(404);
  await page.context().clearCookies();
  expect((await page.goto("/yonetim"))?.status()).toBe(404);

  const email = await signUp(page, `admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@yonetim.adscope.test`);
  const start = await balance(page);
  expect((await page.goto("/yonetim"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Özet", level: 1 })).toBeVisible();
  await expect(page.getByText("Reklam metinleri ve kreatifler bu panelde gösterilmez.")).toBeVisible();
  await page.getByRole("link", { name: "Kullanıcılar ve krediler" }).click();
  await page.getByLabel("E-postaya göre ara").fill(email);
  await page.getByRole("button", { name: "Ara" }).click();
  const row = page.getByRole("list", { name: "Kullanıcılar" }).getByRole("listitem").filter({ hasText: email });
  await row.getByLabel("Kredi (±)").fill("5");
  await row.getByLabel("Gerekçe (zorunlu)").fill("x");
  await row.getByRole("button", { name: /krediyi düzelt/ }).click();
  // The browser blocks a too-short reason before the server sees it.
  expect(await row.getByLabel("Gerekçe (zorunlu)").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  await row.getByLabel("Gerekçe (zorunlu)").fill("Destek talebi: başarısız analiz iadesi");
  await row.getByRole("button", { name: /krediyi düzelt/ }).click();
  await expect(row.getByText("+5 kredi deftere yazıldı.", { exact: false })).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  for (const [link, heading] of [["Satın almalar", "Satın almalar ve webhook olayları"], ["Uyarı geri bildirimleri", "Uyarı geri bildirimleri"], ["Kural kartları", "Kural kartları"], ["Denetim günlüğü", "Denetim günlüğü"]]) {
    await page.getByRole("navigation", { name: "Yönetim" }).getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
  await expect(page.getByText("Kredi düzeltmesi").first()).toBeVisible();
  await expect(page.getByText(/Destek talebi: başarısız analiz iadesi/).first()).toBeVisible();
  expect(await balance(page)).toBe(start + 5);
  await page.goto("/panel/krediler");
  await expect(page.getByText("Destek talebi: başarısız analiz iadesi")).toBeVisible();
});
