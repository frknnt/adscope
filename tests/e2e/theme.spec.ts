import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fillWizard, signUp } from "./helpers";

// The dark theme follows the OS setting. Every token pair must keep WCAG AA contrast there too.
test.use({ colorScheme: "dark" });

const SHOTS = process.env.THEME_SHOTS_DIR;

async function check(page: Page, name: string) {
  // After a client-side navigation the menu item animates to its active colours (150 ms); measure the end state.
  await page.waitForTimeout(400);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).slice(0, 3).join(", ")}`), name).toEqual([]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("dark theme: public pages and the panel stay readable", async ({ page }) => {
  test.setTimeout(120_000);
  const bg = async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  for (const [path, name] of [["/", "home"], ["/fiyatlandirma", "pricing"], ["/reklamim-reddedilir-mi", "quick"]] as const) {
    await page.goto(path);
    await check(page, name);
  }
  expect(await bg()).toBe("rgb(14, 22, 38)");

  await signUp(page);
  await page.goto("/panel");
  await check(page, "panel-empty");
  await page.goto("/panel/yeni");
  await check(page, "wizard");
  await fillWizard(page);
  await page.getByRole("button", { name: "Analizi başlat" }).click();
  await page.waitForURL(/\/panel\/analiz\//, { timeout: 60_000 });
  await check(page, "report");
  await page.goto("/panel/krediler");
  await check(page, "credits");
  await page.goto("/panel/markalar");
  await check(page, "brands");
});

test("print always uses the light sheet", async ({ page }) => {
  await page.goto("/");
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#f7f4ee");
});
