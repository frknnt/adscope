import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DISCLAIMER, FORBIDDEN, noHorizontalScroll } from "./helpers";

const PAGES = ["/", "/nasil-calisir", "/fiyatlandirma", "/kurallar", "/rehber", "/rehber/takviye-gida", "/rehber/estetik-klinik", "/rehber/kozmetik", "/rehber/kurs-egitim", "/rehber/emlak", "/rehber/finans", "/gizlilik", "/kvkk", "/kullanim-kosullari", "/mesafeli-satis-sozlesmesi", "/on-bilgilendirme-formu", "/giris", "/kayit"];

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
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) expect(href).toMatch(/^https:\/\/(transparency\.meta\.com|ticaret\.gov\.tr|www\.resmigazete\.gov\.tr|www\.mevzuat\.gov\.tr|www\.saglik\.gov\.tr|support\.google\.com|ads\.tiktok\.com|www\.titck\.gov\.tr)/);
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

test("distance sales documents name the right-of-withdrawal exception and stay marked as drafts", async ({ page }) => {
  for (const path of ["/mesafeli-satis-sozlesmesi", "/on-bilgilendirme-formu"]) {
    await page.goto(path);
    const text = await page.locator("main").innerText();
    expect(text).toContain("cayma hakkı");
    expect(text).toContain("15. maddesinin birinci fıkrasının (ğ) bendi");
    expect(text).toContain("avukata kontrol ettirilecek");
    expect(text).toContain("[ŞAHIS ŞİRKETİ UNVANI]");
  }
  await page.goto("/");
  await expect(page.locator("footer").getByRole("link", { name: "Mesafeli satış sözleşmesi" })).toHaveAttribute("href", "/mesafeli-satis-sozlesmesi");
});

test("ad budget calculator works in the browser, with structured data and no stored data", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
  await page.goto("/reklam-butce-hesaplama");
  await expect(page.getByRole("heading", { name: "Reklam bütçe ve kâr hesaplayıcı", level: 1 })).toBeVisible();
  await expect(page.getByText("Başa baş ROAS", { exact: true })).toBeVisible();
  await expect(page.getByText("1,89x")).toBeVisible();
  await page.getByLabel("Ürün maliyeti").fill("700");
  await expect(page.getByText(/Ürün reklamsız da zarar ediyor/)).toBeVisible();
  await page.getByLabel("Ürün maliyeti").fill("220");
  await page.getByLabel("Hedef ROAS (isteğe bağlı)").fill("3");
  await expect(page.getByText(/Hedef ROAS ile sipariş başına en fazla/)).toBeVisible();
  await expect(page.getByText("Sonuçlar tahmindir.")).toBeVisible();
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(ld["@graph"].map((x: { "@type": string }) => x["@type"])).toEqual(["WebApplication", "FAQPage"]);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/reklam-butce-hesaplama$/);
  await expect(page.getByRole("link", { name: "Reklamımı ücretsiz kontrol et" })).toHaveAttribute("href", "/reklamim-reddedilir-mi");
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  expect(posts).toEqual([]);
});

test("sector guides: sourced cards, unverified label, free check with the sector, SEO files", async ({ page, request }) => {
  await page.goto("/rehber/takviye-gida");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Takviye gıda reklamlarında");
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resmî kaynaklar" })).toBeVisible();
  await expect(page.getByLabel("Sektör")).toHaveValue("takviye_gida");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/rehber\/takviye-gida$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  const og = await request.get((await page.locator('meta[property="og:image"]').getAttribute("content"))!.replace(/^https?:\/\/[^/]+/, ""));
  expect(og.headers()["content-type"]).toContain("image/png");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const s of ["takviye-gida", "estetik-klinik", "kozmetik", "kurs-egitim", "emlak", "finans"]) expect(sitemap).toContain(`/rehber/${s}`);
  // Private by default: robots.txt blocks everything until SITE_INDEXABLE=true in production.
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  expect((await request.get("/rehber/yok")).status()).toBe(404);
});
