import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * Mobile and desktop audit (P6.5): at 360, 768 and 1280 px no page scrolls sideways and every
 * tap target outside running text is at least 44 px high (check boxes and radios 20 px).
 */
const PUBLIC = ["/", "/fiyatlandirma", "/reklamim-reddedilir-mi", "/reklam-butce-hesaplama", "/rehber", "/rehber/takviye-gida", "/kurallar", "/giris", "/kayit", "/gizlilik"];
const PANEL = ["/panel", "/panel/yeni", "/panel/gecmis", "/panel/krediler", "/panel/davet", "/panel/uret", "/panel/takvim", "/panel/ilham", "/panel/performans", "/panel/markalar", "/panel/ayarlar", "/panel/itiraz", "/panel/toplu", "/panel/api", "/panel/ekip", "/panel/araclar"];

async function audit(page: Page) {
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]):not([type=file]), select, textarea, [role=tab], summary")) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue; // visually hidden (skip link, file inputs behind labels)
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || el.closest("[aria-hidden=true], [hidden]")) continue;
      // WCAG 2.5.8 "equivalent" exception: the season timeline dots repeat links listed in full below.
      if (el.dataset.targetExempt === "equivalent") continue;
      // Links inside running text are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === "A" && st.display === "inline") continue;
      const type = (el as HTMLInputElement).type;
      const min = type === "checkbox" || type === "radio" ? 20 : 44;
      if (r.height < min - 0.5) small.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || (el as HTMLInputElement).name || el.outerHTML).trim().slice(0, 60)}" ${Math.round(r.height)}px`);
    }
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)] };
  });
}

for (const width of [360, 768, 1280]) {
  test(`layout audit at ${width}px: no sideways scroll, tap targets at least 44px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    for (const path of PUBLIC) {
      await page.goto(path);
      const r = await audit(page);
      if (r.overflow > 1) problems.push(`${path}: ${r.overflow}px sideways`);
      for (const s of r.small) problems.push(`${path}: ${s}`);
    }
    await signUp(page);
    for (const path of PANEL) {
      await page.goto(path);
      const r = await audit(page);
      if (r.overflow > 1) problems.push(`${path}: ${r.overflow}px sideways`);
      for (const s of r.small) problems.push(`${path}: ${s}`);
    }
    expect(problems).toEqual([]);
  });
}

test("reduced motion: the landing page does not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animated = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("*")].filter((el) => getComputedStyle(el).animationName !== "none").length);
  expect(animated).toBe(0);
});

test("landing: live mini check and sector picker work on the page", async ({ page }) => {
  await page.goto("/");
  const box = page.locator("#dene");
  await box.getByLabel("Reklam metni").fill("7 günde 5 kilo ver! Garantili sonuç, %100 doğal detoks çayı.");
  await box.getByRole("button", { name: "Ücretsiz kontrol et" }).click();
  await expect(box.getByText(/garanti/i).first()).toBeVisible();
  const picker = page.getByRole("tablist", { name: "Sektör seç" });
  await picker.getByRole("tab", { name: "Estetik / klinik" }).click();
  await expect(page.getByRole("link", { name: /rehberinin tamamı/ }).filter({ visible: true })).toHaveAttribute("href", "/rehber/estetik-klinik");
});
