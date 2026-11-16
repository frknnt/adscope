import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DISCLAIMER, FORBIDDEN, noHorizontalScroll } from "./helpers";

const PAGES = ["/", "/nasil-calisir", "/fiyatlandirma", "/kurallar", "/gizlilik", "/kvkk", "/kullanim-kosullari", "/giris", "/kayit"];

for (const path of PAGES) {
  test(`${path} renders, is accessible and makes no guarantees`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    const text = await page.locator("body").innerText();
    for (const re of FORBIDDEN) expect(text).not.toMatch(re);
    await noHorizontalScroll(page);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  });
}

test("home shows the disclaimer and a real sample report", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  await expect(page.getByText("Meta ret riski").first()).toBeVisible();
});

test("rule cards list official sources", async ({ page }) => {
  await page.goto("/kurallar");
  const links = page.getByRole("link", { name: /Resmî kaynak/ });
  expect(await links.count()).toBeGreaterThan(10);
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) expect(href).toMatch(/^https:\/\/(transparency\.meta\.com|ticaret\.gov\.tr|www\.resmigazete\.gov\.tr|www\.mevzuat\.gov\.tr|www\.saglik\.gov\.tr)/);
});

test("keyboard: skip link and sign-in form are reachable without a mouse", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow checked on desktop");
  await page.goto("/giris");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "İçeriğe geç" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("E-posta", { exact: true }).focus();
  await page.keyboard.type("yok@example.com");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Şifre")).toBeFocused();
  await page.keyboard.type("yanlis-sifre-1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toContainText("E-posta veya şifre hatalı");
});

test("panel requires sign-in", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/giris/);
  const api = await page.request.post("/api/analyses", { multipart: { payload: "{}" } });
  expect(api.status()).toBe(401);
});
