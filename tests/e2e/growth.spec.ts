import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { balance, noHorizontalScroll, signUp } from "./helpers";

async function axeClean(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
}

test("coupons, campaign strip and invite rewards", async ({ page }) => {
  const tag = `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  const coupon = `E2E-${tag}`;

  // Admin creates a bonus credit coupon with a campaign label, limited to the Profesyonel package.
  await signUp(page, `admin-${tag.toLowerCase()}@yonetim.adscope.test`);
  await page.goto("/yonetim/kuponlar");
  await page.getByLabel("Kod", { exact: true }).fill(coupon.toLowerCase());
  await page.getByLabel("Değer", { exact: true }).fill("7");
  await page.getByLabel("Kampanya adı (isteğe bağlı)").fill(`Kasım kampanyası ${tag}`);
  await page.getByLabel("Profesyonel").check();
  await page.getByRole("button", { name: "Kupon oluştur" }).click();
  await expect(page.getByText(`${coupon} kuponu oluşturuldu.`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Kupon listesi" }).getByText(coupon)).toBeVisible();
  await noHorizontalScroll(page);
  await axeClean(page);

  // The pricing page shows the strip only while the coupon is active.
  await page.goto("/fiyatlandirma");
  await expect(page.getByRole("complementary", { name: "Aktif kampanya" }).filter({ hasText: coupon })).toContainText("+7");

  // The inviter opens the invite page.
  const agencyEmail = `ajans-${tag.toLowerCase()}@example.com`;
  await page.context().clearCookies();
  await signUp(page, agencyEmail);
  await page.goto("/panel/davet");
  const inviteCode = (await page.getByText(/^Davet kodun:/).innerText()).replace("Davet kodun:", "").trim();
  expect(inviteCode).toMatch(/^AD-[A-Z0-9]{7}$/);
  await expect(page.getByRole("textbox", { name: "Davet bağlantın" })).toHaveValue(new RegExp(`/kayit\\?davet=${inviteCode}$`));
  await axeClean(page);

  // A friend signs up with the invite link, reserves the coupon and buys the Profesyonel package (demo).
  await page.context().clearCookies();
  await signUp(page, undefined, `/kayit?davet=${inviteCode}`);
  const before = await balance(page);
  await page.getByLabel("Kupon kodu").fill(coupon);
  await page.getByLabel("Paket", { exact: true }).selectOption("baslangic");
  await page.getByRole("button", { name: "Kuponu uygula" }).click();
  await expect(page.getByText("Bu kupon seçtiğin pakette kullanılamıyor.")).toBeVisible();
  await expect(page.getByLabel("Kupon kodu")).toHaveValue(coupon); // kept after the error
  await page.getByLabel("Paket", { exact: true }).selectOption("profesyonel");
  await page.getByRole("button", { name: "Kuponu uygula" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ayrıldı" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/ayrıldı: Profesyonel paketini aldığında/)).toBeVisible();
  await axeClean(page);
  await page.getByRole("button", { name: /Demo: \d+ kredi ekle/ }).nth(1).click();
  await expect(page.getByText(/Kupon ile 7 ek kredi eklendi/)).toBeVisible();
  const pro = Number((await page.getByRole("button", { name: /Demo: \d+ kredi ekle/ }).nth(1).innerText()).match(/\d+/)![0]);
  expect(await balance(page)).toBe(before + pro + 7 + 5);
  await expect(page.getByRole("cell", { name: /Kupon/ }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /Davet ödülü/ }).first()).toBeVisible();
  // The coupon cannot be used twice by the same person.
  await page.getByLabel("Kupon kodu").fill(coupon);
  await page.getByLabel("Paket", { exact: true }).selectOption("profesyonel");
  await page.getByRole("button", { name: "Kuponu uygula" }).click();
  await expect(page.getByText("Bu kuponu kullanım hakkını doldurdun.")).toBeVisible();

  // The inviter sees the reward.
  await page.context().clearCookies();
  await page.goto("/giris");
  await page.getByLabel("E-posta", { exact: true }).fill(agencyEmail);
  await page.getByLabel("Şifre").fill("Test-sifre-123");
  await page.getByRole("button", { name: /Giriş yap/ }).click();
  await page.waitForURL("**/panel**");
  await page.goto("/panel/davet");
  await expect(page.getByText("Kazandığın kredi").locator("..")).toContainText("5");
});

test("welcome series cron needs the secret; e-mail preference links are verified", async ({ page, baseURL }) => {
  expect((await page.request.get(`${baseURL}/api/cron/welcome`)).status()).toBe(401);
  const res = await page.request.get(`${baseURL}/api/cron/welcome`, { headers: { Authorization: "Bearer e2e-cron-secret-0123456789" } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });
  await page.goto("/e-posta-tercihleri?u=6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b&t=0000000000000000000000000000000000000000");
  await expect(page.getByRole("heading", { name: "E-posta tercihleri", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tüm e-postalardan çık" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ayarlar" })).toBeVisible();
  await axeClean(page);
});
