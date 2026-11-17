import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildReminderEmail, remindersDue } from "@/lib/calendar/reminder-email";
import { seasonToday, upcomingEvents, utc } from "@/lib/calendar/season";
import { CAMPAIGN_TEMPLATES, findTemplate, templatesFor } from "@/lib/calendar/templates";
import { catalogRules } from "@/lib/data/memory-repo";
import { MemoryOutbox, ResendEmailProvider } from "@/lib/email/provider";
import { extractLanding, landingChecks, mergeScreenshot } from "@/lib/engine/landing";
import { runPipeline } from "@/lib/engine/pipeline";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { seasonFindings } from "@/lib/engine/season-notes";
import { fold } from "@/lib/engine/text";
import type { AdInput, LandingSnapshot } from "@/lib/engine/types";
import { buildVideoReview, videoFindings } from "@/lib/engine/video";
import { RULE_CATALOG, rulesForSector } from "@/lib/rules/catalog";
import { validateWav } from "@/lib/security/audio-validation";
import { OpenAiWhisperProvider } from "@/lib/speech/openai-whisper";
import { encodeWav, frameTimes } from "@/lib/video/extract-frames";

const flags = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };
const video = { mime: "video/mp4" as const, durationSec: 20, width: 1080, height: 1920, sizeBytes: 4_000_000, frameCount: 6 };
const audio = { analyzed: true, present: true, firstSoundSec: 0.2, silentRatio: 0.1, meanDbFirst3s: -20 };
const vInput = (over: Partial<AdInput> = {}): AdInput => ({ sector: "genel", headline: "", primaryText: "Yeni sezon ürünleri mağazada.", description: "", flags, video: { ...video, audio }, ...over });

async function bytes(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}

describe("video frames and audio", () => {
  it("takes three of six frames from the first three seconds", () => {
    const t = frameTimes(30, 6);
    expect(t).toHaveLength(6);
    expect(t.filter((x) => x < 3)).toHaveLength(3);
    expect(t[t.length - 1]).toBeLessThanOrEqual(30);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });

  it("spreads frames evenly for very short clips", () => {
    const t = frameTimes(4, 6);
    expect(t.length).toBeLessThanOrEqual(6);
    expect(t[0]).toBeGreaterThan(0);
    expect(t[t.length - 1]).toBeLessThan(4);
  });

  it("accepts only 16 kHz mono 16-bit PCM WAV within two minutes", async () => {
    const ok = await bytes(encodeWav(new Float32Array(16_000 * 2)));
    expect(validateWav(ok)).toEqual({ ok: true, durationSec: 2 });
    const stereo = ok.slice();
    stereo[22] = 2; // channels
    expect(validateWav(stereo).ok).toBe(false);
    const rate = ok.slice();
    new DataView(rate.buffer).setUint32(24, 44_100, true);
    expect(validateWav(rate).ok).toBe(false);
    expect(validateWav(new TextEncoder().encode("RIFF....WAVEnot really")).ok).toBe(false);
    expect(validateWav(new Uint8Array(44 + 121 * 16_000 * 2)).ok).toBe(false);
  });
});

describe("video hook review", () => {
  it("notes a late sound start and no speech in the first three seconds", () => {
    const input = vInput({
      video: { ...video, audio: { ...audio, firstSoundSec: 2.4 } },
      speech: { text: "Merhaba, yeni sezon geldi.", segments: [{ start: 3.6, end: 5, text: "Merhaba, yeni sezon geldi." }], provider: "test" },
    });
    const review = buildVideoReview(input, null)!;
    expect(review.speechFirst3s).toBeNull();
    const titles = videoFindings(input, review).map((f) => f.title).join(" | ");
    expect(titles).toMatch(/ses/i);
    expect(titles).toMatch(/3 saniye/i);
  });

  it("turns the AI's hook review into creative notes, never violations", () => {
    const input = vInput({ speech: { text: "Sadece bu hafta.", segments: [{ start: 0.4, end: 1.8, text: "Sadece bu hafta." }], provider: "test" } });
    const review = buildVideoReview(input, {
      hook_strength: 3,
      hook_note_tr: "Ürün ilk saniyelerde görünmüyor.",
      has_captions: false,
      works_without_sound: false,
      safe_zone_issue: true,
      frame_notes: [{ frame: 1, note_tr: "Logo üst kenara çok yakın." }, { frame: 9, note_tr: "olmayan kare" }],
    })!;
    expect(review.speechFirst3s).toBe("Sadece bu hafta.");
    expect(review.frameNotes).toEqual([{ frame: 1, note: "Logo üst kenara çok yakın." }]);
    const notes = videoFindings(input, review);
    expect(notes.every((f) => f.domain === "creative_quality" && f.origin === "heuristic")).toBe(true);
    expect(notes.some((f) => f.severity === "red")).toBe(false);
    expect(notes.filter((f) => f.severity === "yellow").length).toBeGreaterThanOrEqual(3);
  });

  it("scans the speech transcript with the rule cards", async () => {
    const input = vInput({ speech: { text: "Bu çay 7 günde 5 kilo verdirir.", segments: [], provider: "test" } });
    const { result } = await runPipeline({ input, rules: catalogRules(), ai: null });
    const hit = result.findings.find((f) => f.field === "speech" && f.severity === "red");
    expect(hit?.matched_text).toBeTruthy();
    expect(result.score_breakdown.video?.speechProvider).toBe("test");
  });
});

describe("landing screenshot fallback and JavaScript pages", () => {
  const fetched = (html: string): LandingSnapshot => ({
    requestedUrl: "https://ornek.com/kis",
    finalUrl: "https://ornek.com/kis",
    status: "ok",
    httpStatus: 200,
    https: true,
    fetchedAt: new Date().toISOString(),
    source: "fetch",
    ...extractLanding(html),
  });
  const ad: AdInput = { sector: "genel", headline: "", primaryText: "Kışa özel %30 indirim, 1.299 TL yerine 909 TL.", description: "", flags, brandName: "Ornek" };

  it("detects a JavaScript-rendered shell and does not compare offers against it", () => {
    const snap = fetched('<html><head><title>Ornek</title></head><body><div id="__next"></div><script src="/app.js"></script></body></html>');
    expect(snap.jsShell).toBe(true);
    expect(extractLanding('<html><body><div id="x"></div><script src="/bundle.js"></script></body></html>').jsShell).toBe(true);
    expect(extractLanding("<html><script>var a=1</script><body><h1>Detoks çayı</h1><p>Şimdi %20 indirimle 499 TL.</p></body></html>").jsShell).toBe(false);
    const { report, findings } = landingChecks(ad, snap);
    const content = report.checks.find((c) => c.key === "content");
    expect(content?.ok).toBe(false);
    expect(report.checks.find((c) => c.key === "discount")).toBeUndefined();
    expect(findings.some((f) => /JavaScript|ekran görüntüsü/i.test(`${f.title} ${f.explanation} ${f.suggestion}`))).toBe(true);
  });

  it("uses the screenshot text when the page could not be read", () => {
    const failed: LandingSnapshot = { requestedUrl: "https://ornek.com/kis", finalUrl: null, status: "timeout", httpStatus: null, https: true, title: "", description: "", h1: [], text: "", fetchedAt: new Date().toISOString() };
    const merged = mergeScreenshot(failed, { title: "Ornek kış", text: "Ornek kış kampanyası: %30 indirim, 1.299 TL yerine 909 TL. 31 Aralık'a kadar.", isPage: true })!;
    expect(merged.status).toBe("ok");
    expect(merged.source).toBe("screenshot");
    const { report } = landingChecks(ad, merged);
    expect(report.source).toBe("screenshot");
    expect(report.checks.find((c) => c.key === "discount")?.ok).toBe(true);
    expect(report.checks.find((c) => c.key === "reachable")?.ok ?? null).toBeNull();
  });

  it("works with only a screenshot and no URL, and ignores images that are not web pages", () => {
    const only = mergeScreenshot(null, { title: "", text: "Ornek kış kampanyası %30 indirim 1.299 TL yerine 909 TL ve daha fazlası burada.", isPage: true })!;
    expect(only.source).toBe("screenshot");
    expect(landingChecks(ad, only).report.checks.find((c) => c.key === "https")?.ok ?? null).toBeNull();
    const notPage = mergeScreenshot(null, { title: "", text: "kedi", isPage: false })!;
    expect(notPage.screenshot).toBe("not_page");
    expect(notPage.status).not.toBe("ok");
    expect(mergeScreenshot(null, "unread")!.screenshot).toBe("unread");
  });
});

describe("speech-to-text adapter", () => {
  let server: Server;
  let base = "";
  let seen: { auth?: string; body?: string } = {};
  beforeAll(async () => {
    server = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      seen = { auth: req.headers.authorization, body: Buffer.concat(chunks).toString("latin1") };
      if (req.url !== "/v1/audio/transcriptions") return void res.writeHead(404).end();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ text: " Merhaba dünya ", segments: [{ start: 0, end: 1.2, text: " Merhaba " }, { start: 1.2, end: 2, text: "dünya" }, { bad: true }] }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("is disabled without a key", async () => {
    const p = new OpenAiWhisperProvider("", "whisper-1", base);
    expect(p.enabled).toBe(false);
    expect((await p.transcribe(new Uint8Array(10), { language: "tr" })).ok).toBe(false);
  });

  it("sends the WAV once and keeps well-formed segments", async () => {
    const p = new OpenAiWhisperProvider("sk-test-key", "whisper-1", base);
    const wav = await bytes(encodeWav(new Float32Array(1600)));
    const r = await p.transcribe(wav, { language: "tr" });
    expect(seen.auth).toBe("Bearer sk-test-key");
    expect(seen.body).toContain('name="language"');
    expect(seen.body).toContain("verbose_json");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.transcript.text).toBe("Merhaba dünya");
      expect(r.transcript.segments).toEqual([{ start: 0, end: 1.2, text: "Merhaba" }, { start: 1.2, end: 2, text: "dünya" }]);
    }
  });

  it("reports an API error without throwing", async () => {
    const p = new OpenAiWhisperProvider("sk-test-key", "whisper-1", `${base}/yok`);
    expect(await p.transcribe(new Uint8Array(100), { language: "tr" })).toMatchObject({ ok: false, reason: "api_error" });
  });
});

describe("season: templates, notes in the analysis, reminders", () => {
  it("has a back-to-school event marked as not verified", () => {
    const e = upcomingEvents({ from: utc(2027, 8, 1), days: 60 }).find((x) => x.id === "okula-donus")!;
    expect(e.kind).toBe("sezon");
    expect(e.verified).toBe(false);
    expect(e.dateRule).toMatch(/MEB/);
    expect(e.start).toBe("2027-09-13"); // second Monday of September 2027
  });

  it("gives every template a real event and keeps it free of red findings", () => {
    const events = new Set(upcomingEvents({ from: utc(2027, 1, 1), days: 730 }).map((e) => e.id));
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(events.has(t.eventId), t.id).toBe(true);
      const rules = catalogRules().filter((r) => rulesForSector(t.sector).some((c) => c.id === r.id));
      const found = runRuleEngine({ headline: t.headline, primaryText: t.primaryText, description: t.description, flags }, rules);
      expect(found.filter((f) => f.severity !== "info"), t.id).toEqual([]);
    }
    expect(findTemplate("efsane-cuma-genel")?.eventId).toBe("efsane-cuma");
    expect(findTemplate("yok")).toBeNull();
    expect(templatesFor("yaz-sezonu", "takviye_gida").map((t) => t.sector)).toEqual(["takviye_gida"]);
  });

  it("adds an info-only season note when the ad runs in a season window", async () => {
    const input: AdInput = { sector: "genel", headline: "", primaryText: "Efsane Cuma'ya özel fiyatlar.", description: "", flags, today: "2027-11-20" };
    const notes = seasonFindings(input);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].title).toMatch(/Efsane Cuma|Öğretmenler/);
    expect(notes.every((n) => n.severity === "info" && n.domain === "creative_quality")).toBe(true);
    const withNote = (await runPipeline({ input, rules: catalogRules(), ai: null })).result;
    const without = (await runPipeline({ input: { ...input, today: "2027-07-15" }, rules: catalogRules(), ai: null })).result;
    expect(withNote.meta_risk_score).toBe(without.meta_risk_score);
    expect(withNote.creative_score).toBe(without.creative_score);
    expect(without.findings.some((f) => f.title.startsWith("Sezon notu"))).toBe(false);
    expect(seasonFindings({ ...input, today: undefined })).toEqual([]);
    expect(seasonToday(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
  });

  it("finds due reminders between preparation start and the ad start", () => {
    const due = remindersDue(utc(2027, 11, 12), "genel").map((e) => e.id);
    expect(due).toContain("efsane-cuma");
    expect(remindersDue(utc(2027, 11, 26), "genel").map((e) => e.id)).not.toContain("efsane-cuma");
  });

  it("builds a reminder e-mail with escaped user text, the disclaimer and an opt-out link", () => {
    const e = remindersDue(utc(2027, 11, 12), "genel").find((x) => x.id === "efsane-cuma")!;
    const m = buildReminderEmail(e, { siteUrl: "https://adscope.example", displayName: '<img src=x onerror="alert(1)">', sector: "genel" });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
    expect(m.text).toContain("hukuki görüş değildir");
    expect(m.html).toContain("/panel/ayarlar");
    expect(m.html).toContain("/panel/yeni?sablon=efsane-cuma-genel");
    expect(m.subject).toMatch(/Efsane Cuma/);
  });
});

describe("e-mail providers", () => {
  let server: Server;
  let base = "";
  let seen: { key?: string; idem?: string; body?: Record<string, unknown> } = {};
  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      seen = { key: req.headers.authorization, idem: String(req.headers["idempotency-key"]), body: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
      res.writeHead(req.url === "/emails" ? 200 : 500, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "em_1" }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  const msg = { to: "a@example.com", subject: "Konu", html: "<p>x</p>", text: "x", idempotencyKey: "season:u1:efsane-cuma-2027" };

  it("sends through Resend with an idempotency key", async () => {
    const r = await new ResendEmailProvider("re_test", "AdScope <bildirim@example.com>", base).send(msg);
    expect(r).toEqual({ ok: true, id: "em_1" });
    expect(seen.key).toBe("Bearer re_test");
    expect(seen.idem).toBe(msg.idempotencyKey);
    expect(seen.body).toMatchObject({ to: ["a@example.com"], subject: "Konu" });
  });

  it("is off without a key and reports API errors", async () => {
    expect(await new ResendEmailProvider("", "x@example.com", base).send(msg)).toEqual({ ok: false, reason: "not_configured" });
    expect(await new ResendEmailProvider("re_test", "x@example.com", `${base}/bozuk`).send(msg)).toEqual({ ok: false, reason: "api_error" });
  });

  it("demo outbox drops a repeated send", async () => {
    const box = new MemoryOutbox();
    const before = MemoryOutbox.messages().length;
    await box.send(msg);
    await box.send(msg);
    expect(MemoryOutbox.messages().length).toBe(before + 1);
  });
});

describe("rule cards", () => {
  it("has about forty cards; new unverified ones never produce red or yellow", () => {
    expect(RULE_CATALOG.length).toBeGreaterThanOrEqual(40);
    const added = RULE_CATALOG.filter((r) => r.lastVerifiedAt === "2026-11-17");
    expect(added.length).toBeGreaterThanOrEqual(17);
    expect(added.every((r) => r.status === "requires_review" || r.status === "draft")).toBe(true);
    const { result } = { result: runRuleEngine({ headline: "", primaryText: "Sağlık Bakanlığı onaylı, %100 organik. Sadece bugün!", description: "", flags }, catalogRules()) };
    expect(result.map((f) => f.ruleId)).toEqual(expect.arrayContaining(["TR-RY-RESMI-ONAY", "TR-ORGANIK", "TR-RY-ACELE-BASKISI"]));
    expect(result.filter((f) => added.some((r) => r.id === f.ruleId)).every((f) => f.severity === "info")).toBe(true);
  });

  it("does not fire on common words that only look alike", () => {
    for (const t of ["Biraz daha bekle", "Rakiplerimizden ayrışan tasarım", "Sıkı tutun, geliyoruz", "Randevu slotu açıldı", "Son kullanma tarihi etikette"]) {
      const f = fold(t);
      const hits = RULE_CATALOG.filter((r) => r.matchPatterns.some((p) => new RegExp(p).test(f))).map((r) => r.id);
      expect(hits, t).toEqual([]);
    }
  });
});
