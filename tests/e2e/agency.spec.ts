import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { DISCLAIMER, FORBIDDEN, fillWizard, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

let graph: Server;
let graphCalls: { auth: string | undefined; url: string }[] = [];

test.beforeAll(async () => {
  // Mock Graph API `ads_archive` (the demo server points META_GRAPH_BASE_URL here).
  graph = createServer((req, res) => {
    if (req.url === "/marka-sitesi") {
      // Brand website fixture for "Web sitesinden doldur". The script must never run or be stored.
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(
        `<html><head><title>Çınar Kahve | Taze kavrum</title><meta name="description" content="Her sabah taze çekilmiş kahve."><meta name="theme-color" content="#7A3E1D"><script>window.hacked=1</script></head><body><h1>Çınar Kahve</h1></body></html>`,
      );
      return;
    }
    graphCalls.push({ auth: req.headers.authorization, url: req.url ?? "" });
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        data: [
          {
            id: "998877665544",
            page_name: "Örnek Takviye",
            ad_creative_bodies: ["7 günde 5 kilo verdiren mucize çay! Garantili sonuç."],
            ad_creative_link_titles: ["Yazın en etkili desteği"],
            ad_delivery_start_time: "2026-10-20",
            publisher_platforms: ["FACEBOOK", "INSTAGRAM"],
            ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=1&access_token=LEAK",
          },
        ],
        paging: { cursors: { after: "QUZURVI" } },
      }),
    );
  });
  await new Promise<void>((r) => graph.listen(3198, "127.0.0.1", r));
});

test.afterAll(async () => {
  await new Promise<void>((r) => graph.close(() => r()));
});

async function axeClean(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("free quick check works without an account and stores nothing", async ({ page }) => {
  await page.goto("/reklamim-reddedilir-mi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reklamım reddedilir mi?");
  await page.getByLabel("Sektör").selectOption("takviye_gida");
  await page.getByLabel("Reklam metni").fill("7 günde 5 kilo ver! Garantili sonuç, %70 indirim.");
  await page.getByRole("button", { name: "Ücretsiz kontrol et" }).click();
  await expect(page.getByText("Türk mevzuatı riski")).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  const body = await page.locator("main").innerText();
  for (const re of FORBIDDEN) expect(body).not.toMatch(re);
  await noHorizontalScroll(page);
  await axeClean(page);
});

test("agency workflow: report exports, DM kit, brands, team, API and inspiration board", async ({ page, baseURL }) => {
  await signUp(page);
  await onboard(page);
  await fillWizard(page);
  await page.getByRole("button", { name: "Analizi başlat" }).click();
  await page.waitForURL(/\/panel\/analiz\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const analysisUrl = page.url();
  const id = analysisUrl.split("/").pop()!;

  // DM kit and feedback controls are part of the report.
  await expect(page.getByText("Bu uyarı doğru mu?").first()).toBeVisible();
  await page.getByRole("tab", { name: "DM şablonu" }).click();
  await expect(page.getByRole("heading", { name: "WhatsApp / DM şablonları" })).toBeVisible();
  await page.getByRole("tab", { name: /^Bulgular/ }).click();
  await page.getByRole("button", { name: "Yararlı" }).first().click();
  await expect(page.getByText("Teşekkürler, kaydettik.").first()).toBeVisible();

  // CSV: BOM, semicolon separated, disclaimer column; PDF: a real PDF.
  const csv = await page.request.get(`/api/analyses/${id}/export?format=csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const csvText = (await csv.body()).toString("utf8");
  expect(csvText.charCodeAt(0)).toBe(0xfeff);
  expect(csvText).toContain(DISCLAIMER);
  const pdf = await page.request.get(`/api/analyses/${id}/export?format=pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await page.request.get(`/api/analyses/${id}/export?format=exe`)).status()).toBe(404);

  // E-mail the PDF (demo outbox in demo mode; production without Resend shows a clear message).
  await page.getByLabel("Alıcının e-postası").fill("musteri@example.com");
  await page.getByRole("button", { name: "PDF'i gönder" }).click();
  await expect(page.getByText(/musteri@example.com/).first()).toBeVisible();

  // Lawyer review link: read-only page without login.
  await page.getByRole("button", { name: "İnceleme bağlantısı oluştur" }).click();
  const reviewLink = await page.locator("code").filter({ hasText: "/inceleme/" }).innerText();
  const anon = await page.context().browser()!.newContext();
  const lawyer = await anon.newPage();
  // The link is built from NEXT_PUBLIC_SITE_URL; point it at the server under test.
  const rl = new URL(reviewLink);
  await lawyer.goto(new URL(rl.pathname, baseURL).toString());
  await expect(lawyer.getByText(DISCLAIMER).first()).toBeVisible();
  await expect(lawyer.getByRole("button", { name: "Analizi sil" })).toHaveCount(0);
  await anon.close();

  // Brands with a banned word.
  await page.goto("/panel/markalar");
  await expect(async () => {
    await page.getByRole("button", { name: "Yeni marka" }).first().click({ timeout: 2000 });
    await expect(page.getByRole("dialog", { name: "Yeni marka" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  const dialog = page.getByRole("dialog", { name: "Yeni marka" });
  // "Web sitesinden doldur" suggests values; nothing is saved until the user saves.
  await dialog.getByLabel("Web sitesi adresi").fill("http://127.0.0.1:3198/marka-sitesi");
  await dialog.getByRole("button", { name: "Web sitesinden doldur" }).click();
  await expect(dialog.getByText("Sitede bulunanlar")).toBeVisible();
  await expect(dialog.getByText("#7a3e1d")).toBeVisible();
  await dialog.getByRole("button", { name: "Önerileri forma aktar" }).click();
  await expect(dialog.getByLabel("Marka adı")).toHaveValue("Çınar Kahve");
  await expect(dialog.getByLabel("Slogan")).toHaveValue("Her sabah taze çekilmiş kahve.");
  await expect(dialog.getByLabel("Ana renk", { exact: true })).toHaveValue("#7a3e1d");
  await expect(dialog.getByText(/kontrast \d/i).first()).toBeVisible();
  // Saved brands keep https websites only, so the local fixture address is cleared before saving.
  await dialog.getByLabel("Web sitesi adresi").fill("");
  await dialog.getByLabel("Marka adı").fill("Ajans Müşterisi");
  await dialog.getByLabel("Yasaklı kelimeler").fill("ucuz, bedava");
  await dialog.getByLabel("Zorunlu ibareler").fill("Kampanya stokla sınırlıdır.");
  await page.getByRole("button", { name: "Marka ekle" }).click();
  await expect(page.getByRole("heading", { name: "Ajans Müşterisi" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Marka renkleri: #7a3e1d/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Kapat" }).click();
  await axeClean(page);

  // Team invite: the link is shown once.
  await page.goto("/panel/ekip");
  await page.getByLabel("Ekip arkadaşının e-postası").fill(`ekip-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Davet et" }).click();
  await expect(page.locator("code").filter({ hasText: "/panel/ekip/katil?davet=" })).toBeVisible();
  await axeClean(page);

  // API key → JSON API.
  await page.goto("/panel/api");
  await page.getByLabel("Anahtar adı").fill("CRM");
  await page.getByRole("button", { name: "Anahtar oluştur" }).click();
  const keyDialog = page.getByRole("dialog", { name: "Yeni API anahtarın" });
  const key = await keyDialog.locator("code").filter({ hasText: /^ads_live_[A-Za-z0-9_-]{30,}$/ }).innerText();
  await keyDialog.getByRole("button", { name: "Kopyaladım, kapat" }).click();
  await expect(keyDialog).toBeHidden();
  const list = await page.request.get(`${baseURL}/api/v1/analyses`, { headers: { Authorization: `Bearer ${key}` } });
  expect(list.status()).toBe(200);
  const json = await list.json();
  expect(JSON.stringify(json)).toContain(id);
  expect((await page.request.get(`${baseURL}/api/v1/analyses`, { headers: { Authorization: "Bearer ads_live_wrong" } })).status()).toBe(401);
  await axeClean(page);

  // Inspiration board against the mock Ad Library.
  graphCalls = [];
  await page.goto("/panel/ilham");
  await page.getByLabel("Arama terimi").fill(`detoks çayı ${Date.now()}`);
  await page.getByRole("button", { name: "Ara" }).click();
  await expect(page.getByText("Örnek Takviye").first()).toBeVisible();
  await expect(page.getByText(/AdScope sinyali/).first()).toBeVisible();
  expect(graphCalls[0]?.auth).toBe("Bearer e2e-fake-token");
  expect(graphCalls[0]?.url).not.toContain("e2e-fake-token");
  expect(await page.content()).not.toContain("LEAK");
  await page.getByRole("button", { name: "Panoya kaydet" }).click();
  await expect(page.getByRole("button", { name: "Panoda", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^Panom/ }).click();
  await expect(page.getByRole("region", { name: "Panom" }).getByText("Örnek Takviye")).toBeVisible();
  await noHorizontalScroll(page);
  await axeClean(page);

  // "Benzerini kontrol et" opens the wizard for the user's own text; the competitor's text is not carried.
  await page.getByRole("region", { name: "Panom" }).getByRole("link", { name: /Benzerini kontrol et/ }).click();
  await page.waitForURL("**/panel/yeni");
  await expect(page.getByText(/başka bir sayfadan aktarıldı/)).toHaveCount(0);
  expect(page.url()).not.toContain("#");
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/ad.png");
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByLabel("Ana metin")).toHaveValue("");

  // Competitor watch: saved terms, limit message, EU-only note; the weekly cron fills the summary.
  await page.goto("/panel/ilham#rakip-izleme");
  await page.getByRole("tab", { name: "Rakip izleme" }).click();
  await expect(page.getByText(/yalnızca Türkiye'de yayınlanan reklamlar bu izlemede görünmez/i)).toBeVisible();
  await page.getByLabel("Sayfa adı ya da anahtar kelime").fill("Örnek Takviye");
  await page.getByRole("button", { name: "İzlemeye al" }).click();
  const watched = page.getByRole("list", { name: "İzlenen aramalar" });
  await expect(watched.getByText("Örnek Takviye")).toBeVisible();
  await expect(watched.getByText("ilk haftalık kontrol bekleniyor")).toBeVisible();
  await page.getByLabel("Sayfa adı ya da anahtar kelime").fill("örnek takviye");
  await page.getByRole("button", { name: "İzlemeye al" }).click();
  await expect(page.getByText("Bu aramayı zaten izliyorsun.")).toBeVisible();
  graphCalls = [];
  expect((await page.request.get(`${baseURL}/api/cron/competitors`)).status()).toBe(401);
  const cron = await page.request.get(`${baseURL}/api/cron/competitors`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? "e2e-cron-secret-0123456789"}` } });
  expect(cron.status()).toBe(200);
  expect((await cron.json()).checked).toBeGreaterThan(0);
  await page.reload();
  await page.getByRole("tab", { name: "Rakip izleme" }).click();
  await expect(watched.getByText(/reklam yayında/)).toBeVisible();
  await expect(watched.getByText("En uzun süredir yayında")).toBeVisible();
  expect(await page.content()).not.toContain("LEAK");
  await axeClean(page);
  await watched.getByRole("button", { name: /izlemesini sil/ }).click();
  await expect(page.getByText("Henüz izlenen arama yok.")).toBeVisible();
});

test("bulk check, account restriction guide and rule-change rescan", async ({ page }) => {
  await signUp(page);
  await page.goto("/panel/toplu");
  await page.getByLabel("Reklam metinleri").fill("7 günde 5 kilo ver! Garantili sonuç.\n\nYeni sezon ürünlerimiz mağazada, bize mesaj gönderin.\n\n---\nSon gün %70 indirim, hemen al!");
  await page.getByRole("button", { name: /3 reklamı kontrol et/ }).click();
  await expect(page.getByRole("heading", { name: /3 reklam/ })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tabloyu indir (CSV)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^adscope-toplu-kontrol-.*\.csv$/);
  await noHorizontalScroll(page);
  await axeClean(page);

  await page.goto("/panel/itiraz");
  await expect(page.getByRole("heading", { name: "Hesabın kısıtlandıysa: adım adım" })).toBeVisible();
  await page.getByLabel(/Neyin kısıtlandığını belirle/).check();
  await expect(page.getByText("1 / 8 tamamlandı")).toBeVisible();
  await axeClean(page);
});
