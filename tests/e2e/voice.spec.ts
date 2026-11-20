import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { balance, noHorizontalScroll, onboard, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

// Fake Gemini Interactions API (speech) on the port configured in playwright.config.ts.
let server: Server;
const received: { key: string; raw: string; body: { model: string; input: { content: { text: string; annotations: { style: string }[] }[] }[]; response_format: Record<string, unknown>; generation_config: { speech_config: { voice: string }[] } } }[] = [];
let failNext = false;

/** A 24 kHz mono WAV of the given seconds (a quiet tone), as the provider would return it. */
function wav(seconds: number) {
  const rate = 24_000;
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 3000), 44 + i * 2);
  return b;
}

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    const body = JSON.parse(raw);
    received.push({ key: String(req.headers["x-goog-api-key"] ?? ""), raw, body });
    if (failNext) {
      failNext = false;
      return res.writeHead(503, { "content-type": "application/json" }).end("{}");
    }
    const words = String(body.input?.[0]?.content?.[0]?.text ?? "").split(/\s+/).length;
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ id: "i1", status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: wav(Math.min(12, 0.5 + words * 0.4)).toString("base64") }] }] }),
    );
  });
  await new Promise<void>((r) => server.listen(3196, "127.0.0.1", r));
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

async function axeClean(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
}

export async function makeScript(page: Page, name: string, seconds: "15 sn" | "30 sn" = "15 sn") {
  await page.goto("/panel/uret?sekme=senaryo");
  await page.getByLabel("Ürün ya da hizmet adı").fill(name);
  await page.getByLabel("Kısa açıklama").fill("Akşam için hafif bitki karışımı");
  await page.getByText(seconds, { exact: true }).click();
  await expect(async () => {
    await page.getByRole("button", { name: "Senaryoyu üret" }).click({ timeout: 2000 });
    await expect(page).toHaveURL(/sekme=senaryo&sonuc=/, { timeout: 8000 });
  }).toPass();
}

test("Turkish voice-over: free preview, red line blocks, one credit for all scenes, AI notice", async ({ page }) => {
  test.setTimeout(150_000);
  const email = await signUp(page);
  await onboard(page);
  const start = await balance(page);
  await makeScript(page, "Bitki çayı");
  const panel = page.getByRole("region", { name: "Türkçe dış ses" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("ünlü ya da gerçek bir kişinin sesini taklit etme seçeneği yoktur")).toBeVisible();
  await expect(panel.getByRole("radio")).toHaveCount(4 + 3);

  // Free five-second preview of scene 1 with a chosen voice and speed.
  await panel.getByLabel("Erkek sesi, bilgilendirici").check();
  await panel.getByText("Hızlı", { exact: true }).click();
  // A long line: the provider reads more than five seconds and the preview is cut to five.
  await panel.getByRole("textbox", { name: /^1\. sahne dış sesi/ }).fill("Bitki çayı akşamları sakin bir mola için hazırlandı; içinde papatya, ıhlamur, melisa ve biraz limon kabuğu var.");
  await panel.getByRole("button", { name: /^5 sn ön dinle\s?: 1\. sahne$/ }).click();
  const sample = panel.getByLabel("1. sahne ön dinleme");
  await expect(sample).toBeVisible();
  await expect.poll(() => sample.evaluate((a: HTMLAudioElement) => (Number.isFinite(a.duration) ? Math.round(a.duration) : 0))).toBe(5);
  const first = received.at(-1)!;
  expect(first.key).toBe("e2e-fake-gemini-key");
  expect(first.body.model).toBe("gemini-3.8-flash-tts");
  expect(first.body.generation_config.speech_config[0].voice).toBe("Charon");
  expect(first.body.input[0].content[0].annotations[0].style).toContain("brisk");
  expect(first.raw).not.toContain(email);
  expect(await balance(page)).toBe(start);

  // A red phrase blocks the voice-over until the line is fixed.
  await page.goBack();
  const line = panel.getByRole("textbox", { name: /^1\. sahne dış sesi/ });
  const original = await line.inputValue();
  await line.fill("Bu çay kanseri tedavi eder, garantili sonuç.");
  await expect(panel.getByText("Yüksek riskli ifade var")).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Tüm dış sesi seslendir/ })).toBeDisabled();
  await expect(panel.getByRole("button", { name: /^5 sn ön dinle\s?: 1\. sahne$/ })).toBeDisabled();
  await noHorizontalScroll(page);
  await axeClean(page);
  await line.fill(original);
  await expect(panel.getByText("Yüksek riskli ifade var")).toHaveCount(0);

  // Provider down: nothing charged.
  failNext = true;
  const before = received.length;
  await panel.getByRole("button", { name: /^Tüm dış sesi seslendir · 1 kredi/ }).click();
  await expect(panel.getByRole("alert")).toContainText("kredin düşmedi");
  expect(await balance(page)).toBe(start);
  await page.goBack();

  // All scenes for one credit; the AI notice appears on the script and the audio is listed.
  await panel.getByRole("button", { name: /^Tüm dış sesi seslendir · 1 kredi/ }).click();
  await expect(panel.getByRole("status")).toContainText("1 kredi düştü");
  expect(received.length).toBeGreaterThan(before + 1);
  for (const r of received.slice(before)) expect(r.raw).not.toContain(email);
  const notice = page.getByRole("note").filter({ hasText: "Yapay zekâ ile üretilmiş ses" });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("link", { name: "TR-RY-YZ-KARAKTER" })).toBeVisible();
  await expect(panel.getByLabel("1. sahne seslendirmesi")).toBeVisible();
  const download = page.waitForEvent("download");
  await panel.getByRole("link", { name: /^WAV indir\s?: 1\. sahne$/ }).click();
  expect((await download).suggestedFilename()).toBe("adscope-dis-ses-sahne-1.wav");
  await axeClean(page);
  expect(await balance(page)).toBe(start - 1);
});

/** Reads the recorded file: its length and whether it carries an audio track. */
async function recorded(page: Page) {
  const link = page.getByRole("link", { name: /Videoyu indir \((MP4|WebM)\)/ });
  await expect(link).toBeVisible({ timeout: 60_000 });
  const duration = await page.getByLabel("Oluşturulan video").evaluate(async (v: HTMLVideoElement) => {
    // MediaRecorder files often report Infinity until the browser seeks to the end.
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e6;
      await new Promise((r) => v.addEventListener("timeupdate", r, { once: true }));
    }
    return v.duration;
  });
  const download = page.waitForEvent("download");
  await link.click();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile((await (await download).path())!);
  const text = bytes.toString("latin1");
  return { duration, hasAudio: text.includes("A_OPUS") || text.includes("mp4a") || text.includes("Opus"), name: await link.getAttribute("download") };
}

test("video with my own sound: 6 second voiced recording, burnt-in SRT, music, AI notice, free", async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page);
  await onboard(page);
  const start = await balance(page);
  await page.goto("/panel/uret?sekme=video");
  await page.locator("#video-gorsel").setInputFiles("tests/fixtures/ad.png");
  await page.getByLabel("Ekranda görünecek marka adı").fill("Vita Plus");
  await page.getByLabel("Teklif (ilk 3 saniye)").fill("Yeni sezon setleri sitede");
  await page.getByLabel("Kapanış çağrısı (isteğe bağlı)").fill("Hemen incele");
  await page.getByLabel(/Süre: \d+ saniye/).fill("6");
  await page.getByText("Kendi sesim", { exact: true }).click();
  await page.getByLabel("Ses dosyası (en fazla 10 MB)").setInputFiles({ name: "dis-ses.wav", mimeType: "audio/wav", buffer: wav(5) });
  await page.getByLabel("Altyazı dosyası (SRT, isteğe bağlı)").setInputFiles({ name: "altyazi.srt", mimeType: "application/x-subrip", buffer: Buffer.from("1\n00:00:00,000 --> 00:00:02,500\nYeni sezon setleri\n\n2\n00:00:02,500 --> 00:00:05,000\nAyrıntılar sayfada\n") });
  await expect(page.getByText("2 altyazı satırı okundu")).toBeVisible();
  await page.getByLabel(/Bu ses yapay zekâ ile üretildi/).check();
  await page.getByLabel("Fon müziği").selectOption({ label: "Sakin" });
  await noHorizontalScroll(page);
  await axeClean(page);

  await page.getByRole("button", { name: /Videoyu oluştur/ }).click();
  const r = await recorded(page);
  expect(r.name).toMatch(/^adscope-video-6sn\.(mp4|webm)$/);
  expect(r.duration).toBeGreaterThan(4.5);
  expect(r.duration).toBeLessThan(8);
  expect(r.hasAudio).toBe(true);
  await expect(page.getByLabel("Video açıklaması önerisi")).toHaveValue(/Bu videodaki ses yapay zekâ ile üretilmiştir\.$/);
  await expect(page.getByLabel("Video açıklaması önerisi")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Video kontrolü")).toContainText("altyazı videoya yakılı", { timeout: 15_000 });
  await axeClean(page);
  expect(await balance(page)).toBe(start);
});

test("script voice-over in the video: length from the script, AI notice cannot be turned off", async ({ page }) => {
  test.setTimeout(180_000);
  await signUp(page);
  await onboard(page);
  await makeScript(page, "Kahve seti");
  const panel = page.getByRole("region", { name: "Türkçe dış ses" });
  await panel.getByRole("button", { name: /^Tüm dış sesi seslendir · 1 kredi/ }).click();
  await expect(panel.getByRole("status")).toContainText("1 kredi düştü");
  const afterVoice = await balance(page);

  await page.goto("/panel/uret?sekme=video");
  await page.locator("#video-gorsel").setInputFiles("tests/fixtures/ad.png");
  await page.getByLabel("Ekranda görünecek marka adı").fill("Vita Plus");
  await page.getByLabel("Teklif (ilk 3 saniye)").fill("Taze kahve sitede");
  await page.getByText("Senaryo dış sesi", { exact: true }).click();
  await expect(page.getByLabel("Seslendirme")).toContainText("Kahve seti · 15 sn");
  await expect(page.getByText("Süre: 15 saniye")).toBeVisible();
  await expect(page.getByLabel(/Süre: \d+ saniye/)).toBeDisabled();
  await expect(page.getByText(/kapatılamaz/)).toBeVisible();
  await page.getByRole("button", { name: /Videoyu oluştur/ }).click();
  const r = await recorded(page);
  expect(r.name).toMatch(/^adscope-video-15sn\.(mp4|webm)$/);
  expect(r.duration).toBeGreaterThan(13.5);
  expect(r.duration).toBeLessThan(17);
  expect(r.hasAudio).toBe(true);
  await expect(page.getByLabel("Video açıklaması önerisi")).toHaveValue(/yapay zekâ ile üretilmiştir/);
  // Using the voice-over in a video is free.
  expect(await balance(page)).toBe(afterVoice);
});
