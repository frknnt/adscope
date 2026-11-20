import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DISCLAIMER, FORBIDDEN, balance, fillWizard, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

async function axeClean(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

async function runAnalysis(page: Page) {
  await fillWizard(page);
  await page.getByRole("button", { name: "Analizi başlat" }).click();
  await page.waitForURL(/\/panel\/analiz\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  return page.url().split("/").pop()!;
}

test("client approval: the customer decides per item without an account; the owner sees badges", async ({ page, baseURL }) => {
  await signUp(page);
  await onboard(page);
  const id = await runAnalysis(page);

  await page.getByLabel("Müşteriye not (isteğe bağlı)").fill("Cuma gününe kadar dönebilir misiniz?");
  await page.getByRole("button", { name: "Onay bağlantısı oluştur" }).click();
  const link = new URL(await page.locator("code").filter({ hasText: "/onay/" }).innerText());
  const path = link.pathname;

  // The customer: no session, no e-mail asked.
  const anon = await page.context().browser()!.newContext();
  const customer = await anon.newPage();
  await customer.goto(new URL(path, baseURL).toString());
  await expect(customer.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(customer.getByText(DISCLAIMER).first()).toBeVisible();
  await expect(customer.getByText("Cuma gününe kadar dönebilir misiniz?")).toBeVisible();
  await expect(customer.getByRole("img", { name: "Reklam görseli" })).toBeVisible();
  await expect(customer.getByLabel(/e-posta/i)).toHaveCount(0);
  const body = await customer.locator("main").innerText();
  for (const f of FORBIDDEN) expect(body).not.toMatch(f);
  await axeClean(customer);
  await noHorizontalScroll(customer);

  // A change request needs a comment.
  await customer.getByLabel("Adın").fill("Ayşe Yılmaz");
  const original = customer.getByRole("group", { name: /Gönderilen metin/ });
  await original.getByText("Onayla", { exact: true }).click();
  const image = customer.getByRole("group", { name: /Görsel/ });
  await image.getByText("Değişiklik iste", { exact: true }).click();
  await customer.getByRole("button", { name: "Kararlarımı gönder" }).click();
  await expect(customer.getByRole("alert").filter({ hasText: "yorum" })).toBeVisible();
  // The choices survive a rejected submission.
  await expect(image.getByRole("radio", { name: "Değişiklik iste" })).toBeChecked();
  await image.getByLabel("Yorum").fill("Ürün daha büyük görünsün.");
  await customer.getByRole("button", { name: "Kararlarımı gönder" }).click();
  await expect(customer.getByRole("status").filter({ hasText: "kararların ajansa iletildi" })).toBeVisible();
  await expect(customer.getByText("Müşteri değişiklik istedi").first()).toBeVisible();
  // The asset route works only behind a valid token.
  expect((await anon.request.get(new URL(`${path}/gorsel`, baseURL).toString())).status()).toBe(200);
  expect((await anon.request.get(new URL("/onay/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/gorsel", baseURL).toString())).status()).toBe(404);

  // The owner sees the decisions on the report and a badge in the list.
  await page.goto(`/panel/analiz/${id}`);
  const section = page.locator("#musteri");
  await expect(section.getByText("Müşteri değişiklik istedi")).toBeVisible();
  await expect(section.getByText("Ürün daha büyük görünsün.")).toBeVisible();
  await expect(section.getByText(/Ayşe Yılmaz/).first()).toBeVisible();
  await page.goto("/panel/gecmis");
  await expect(page.getByText("Değişiklik istendi").first()).toBeVisible();
  await page.goto("/panel/gecmis?gorunum=liste");
  await expect(page.getByText("Değişiklik istendi").first()).toBeVisible();

  // Revoking the link closes the page.
  await page.goto(`/panel/analiz/${id}`);
  await page.locator("#musteri").getByRole("button", { name: "İptal et" }).click();
  await expect(page.locator("#musteri").getByText("İptal edildi")).toBeVisible();
  const gone = await customer.goto(new URL(path, baseURL).toString());
  expect(gone?.status()).toBe(404);
  await anon.close();
});

test("team editor: works in the owner's workspace and spends the owner's credits only", async ({ page, baseURL }) => {
  await signUp(page);
  await onboard(page);
  const editorEmail = `e2e-editor-${Date.now()}@example.com`;
  await page.goto("/panel/ekip");
  await page.getByLabel("Ekip arkadaşının e-postası").fill(editorEmail);
  await page.getByLabel("Rol").selectOption("editor");
  await page.getByRole("button", { name: "Davet et" }).click();
  const invite = new URL(await page.locator("code").filter({ hasText: "/panel/ekip/katil" }).innerText());
  expect(await balance(page)).toBe(3);

  const ctx = await page.context().browser()!.newContext();
  const editor = await ctx.newPage();
  await signUp(editor, editorEmail);
  await editor.goto(new URL(invite.pathname + invite.search, baseURL).toString());
  await editor.getByRole("button", { name: "Daveti kabul et" }).click();
  await editor.waitForURL(/\/panel\/ekip\?davet=kabul/);
  await expect(editor.getByText("Düzenleyici").first()).toBeVisible();
  await editor.getByRole("button", { name: /Bu ekibin alanında çalış/ }).click();
  await editor.waitForURL(/\/panel$/);
  await expect(editor.getByRole("note", { name: "Çalışma alanı" })).toContainText("düzenleyici");

  await editor.goto("/panel/yeni");
  const id = await runAnalysis(editor);
  await expect(editor.getByText(/ekip alanı · düzenleyici/)).toBeVisible();
  await expect(editor.getByRole("button", { name: "Analizi sil" })).toHaveCount(0);
  await expect(editor.locator("#musteri")).toHaveCount(0);
  await axeClean(editor);

  // The owner's balance paid; the editor's own balance did not change.
  expect(await balance(page)).toBe(2);
  expect(await balance(editor)).toBe(3);
  await page.goto("/panel/gecmis");
  await expect(page.locator(`a[href="/panel/analiz/${id}"]`).first()).toBeVisible();

  // Back to the own account: the owner's report is a read-only team report again.
  await editor.goto("/panel");
  await editor.getByRole("button", { name: "Kendi hesabıma dön" }).click();
  await editor.waitForURL(/\/panel$/);
  await expect(editor.getByRole("note", { name: "Çalışma alanı" })).toHaveCount(0);
  await editor.goto(`/panel/analiz/${id}`);
  await expect(editor.getByText("Ekip analizi · salt okunur")).toBeVisible();

  // Demoted to viewer: the workspace cookie no longer works.
  await page.goto("/panel/ekip");
  await page.getByRole("button", { name: /Salt okunur yap/ }).click();
  await expect(page.getByRole("button", { name: /Düzenleyici yap/ })).toBeVisible();
  await editor.goto("/panel/ekip");
  await expect(editor.getByRole("button", { name: /Bu ekibin alanında çalış/ })).toHaveCount(0);
  await ctx.close();
});
