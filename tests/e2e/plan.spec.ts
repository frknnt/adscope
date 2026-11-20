import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { balance, noHorizontalScroll, onboard, signUp } from "./helpers";

async function axeClean(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("agency monthly package: per-brand prices, a period with its own ledger reason, one-click renewal", async ({ page, baseURL }) => {
  // Public pages list the tiers and say the package never renews by itself.
  await page.goto("/fiyatlandirma");
  const agency = page.getByRole("region", { name: "Ajans paketi: aylık, marka başına" });
  await expect(agency.getByRole("table", { name: "Ajans paketi fiyatları" })).toContainText("10 marka");
  await expect(agency).toContainText("kendiliğinden yenilenmez");
  await noHorizontalScroll(page);
  await page.goto("/mesafeli-satis-sozlesmesi");
  await expect(page.getByRole("columnheader", { name: "Süre ve yenileme" })).toBeVisible();
  await expect(page.getByText(/Ajans · 3 marka/)).toBeVisible();

  await signUp(page);
  await onboard(page);
  await page.goto("/panel/krediler");
  await expect(page.getByRole("region", { name: "Ajans paketin" })).toHaveCount(0);
  const start = await balance(page);
  await page.getByRole("button", { name: "Demo: 3 marka, bir ay (ödeme yok)" }).click();
  await expect(page.getByText("390 demo kredisi eklendi.")).toBeVisible();
  await page.reload();
  expect(await balance(page)).toBe(start + 390);
  const plan = page.getByRole("region", { name: "Ajans paketin" });
  await expect(plan).toContainText("Ajans · 3 marka · bu dönem");
  await expect(plan).toContainText("kendiliğinden yenilenmez");
  await expect(page.getByRole("cell", { name: /Ajans aylık kredisi/ })).toBeVisible();
  await axeClean(page);
  await noHorizontalScroll(page);

  // The reminder link opens the renewal for its tier; renewing early adds the next month after this one.
  await page.goto("/panel/krediler?yenile=ajans_5#ajans-paketi");
  await expect(page.getByRole("heading", { name: "Ajans paketini yenile" })).toBeVisible();
  await page.getByRole("button", { name: /Demo: bir ay yenile, 650 kredi/ }).click();
  await expect(page.getByText("650 demo kredisi eklendi.")).toBeVisible();
  await page.goto("/panel/krediler");
  await expect(page.getByRole("region", { name: "Ajans paketin" })).toContainText("Sonraki ay da alındı");
  expect(await balance(page)).toBe(start + 390 + 650);

  // The daily cron answers with counts only.
  const cron = await page.request.get(`${baseURL}/api/cron/plan-reminders`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? "e2e-cron-secret-0123456789"}` } });
  expect(cron.status()).toBe(200);
  expect(Object.keys(await cron.json()).sort()).toEqual(["failed", "ok", "sent"]);
  expect((await page.request.get(`${baseURL}/api/cron/plan-reminders`)).status()).toBe(401);
});
