import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { daysUntil, lastWeekday, nthWeekday, iso, phaseOf, toIcs, upcomingEvents, utc } from "@/lib/calendar/season";
import { catalogRules } from "@/lib/data/memory-repo";
import { extractLanding, landingChecks } from "@/lib/engine/landing";
import { runPipeline } from "@/lib/engine/pipeline";
import type { AdInput, LandingSnapshot } from "@/lib/engine/types";
import { aspectLabel, videoFindings, videoSubScores } from "@/lib/engine/video";
import { fetchLanding, isBlockedAddress, validateLandingUrl } from "@/lib/landing/fetch";
import { RULE_CATALOG } from "@/lib/rules/catalog";

const flags = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };
const base: AdInput = { sector: "genel", headline: "", primaryText: "Kış koleksiyonunda %30 indirim, 1.299 TL yerine 909 TL.", description: "", flags, brandName: "Ornek Giyim" };

function snap(html: string, over: Partial<LandingSnapshot> = {}): LandingSnapshot {
  const x = extractLanding(html);
  return { requestedUrl: "https://ornek.com/kis", finalUrl: "https://ornek.com/kis", status: "ok", httpStatus: 200, https: true, fetchedAt: new Date().toISOString(), ...x, ...over };
}

describe("landing page extraction and checks", () => {
  it("extracts title, h1 and visible text but not scripts or styles", () => {
    const x = extractLanding(`<html><head><title>Kış &amp; İndirim</title><meta name="description" content="Yeni sezon"><script>var x="gizli";</script></head>
      <body><style>.a{}</style><h1>Kış <b>koleksiyonu</b></h1><p>%30 indirim</p><script>alert("x")</script><!-- yorum --></body></html>`);
    expect(x.title).toBe("Kış & İndirim");
    expect(x.description).toBe("Yeni sezon");
    expect(x.h1).toEqual(["Kış koleksiyonu"]);
    expect(x.text).toContain("%30 indirim");
    expect(x.text).not.toContain("gizli");
    expect(x.text).not.toContain("alert");
    expect(x.text).not.toContain("yorum");
  });

  it("passes when discount, price and brand match the page", () => {
    const s = snap("<title>Ornek Giyim kış koleksiyonu</title><h1>Kış koleksiyonu</h1><p>Ornek Giyim kış koleksiyonunda %30 indirim: 1.299 TL yerine 909 TL. Kampanya 31 Aralık’a kadar geçerlidir.</p>");
    const { report, findings } = landingChecks(base, s);
    const byKey = Object.fromEntries(report.checks.map((c) => [c.key, c.ok]));
    expect(byKey.reachable).toBe(true);
    expect(byKey.https).toBe(true);
    expect(byKey.discount).toBe(true);
    expect(byKey.price).toBe(true);
    expect(byKey.brand).toBe(true);
    expect(findings.filter((f) => f.severity !== "info")).toHaveLength(0);
  });

  it("flags a discount that the page does not show, as a creative note (never legal/policy)", () => {
    const s = snap("<title>Kış</title><h1>Kış koleksiyonu</h1><p>Yeni sezon ürünleri %10 indirimle. Mont, kazak ve botlarda yeni renkler mağazada ve sitede.</p>");
    const { report, findings } = landingChecks(base, s);
    expect(report.checks.find((c) => c.key === "discount")?.ok).toBe(false);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.domain).toBe("creative_quality");
      expect(f.field).toBe("landing_page");
      expect(f.ruleId).toBeNull();
      expect(f.severity).not.toBe("red");
    }
  });

  it("reports an unreachable page without failing", () => {
    const { report, findings } = landingChecks(base, { ...snap(""), status: "unreachable", httpStatus: null, finalUrl: null });
    expect(report.checks.find((c) => c.key === "reachable")?.ok).toBe(false);
    expect(findings.some((f) => f.field === "landing_page")).toBe(true);
  });
});

describe("landing page SSRF guard", () => {
  it("blocks private, loopback, link-local, metadata and mapped addresses", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isBlockedAddress(a), a).toBe(true);
    }
    for (const a of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isBlockedAddress(a), a).toBe(false);
  });

  it("accepts only public http(s) URLs without credentials or odd ports", () => {
    delete process.env.LANDING_SCAN_ALLOW_PRIVATE;
    expect(validateLandingUrl("https://ornek.com.tr/kampanya?x=1#a")?.toString()).toBe("https://ornek.com.tr/kampanya?x=1");
    for (const u of ["file:///etc/passwd", "javascript:alert(1)", "ftp://ornek.com", "https://user:pw@ornek.com", "http://localhost/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "https://ornek.com:8443/", "http://intranet.local/", "not a url"]) {
      expect(validateLandingUrl(u), u).toBeNull();
    }
  });

  it("does not fetch blocked targets", async () => {
    delete process.env.LANDING_SCAN_ALLOW_PRIVATE;
    expect((await fetchLanding("http://127.0.0.1/")).status).toBe("invalid_url");
    expect((await fetchLanding("gopher://ornek.com")).status).toBe("invalid_url");
  });

  describe("against a local fixture server (private access allowed only for tests)", () => {
    let server: Server;
    let origin = "";
    beforeAll(async () => {
      process.env.LANDING_SCAN_ALLOW_PRIVATE = "true";
      server = createServer((req, res) => {
        if (req.url === "/yonlendir") return void res.writeHead(302, { Location: "/kampanya" }).end();
        if (req.url === "/kotu-yonlendirme") return void res.writeHead(302, { Location: "file:///etc/passwd" }).end();
        if (req.url === "/pdf") return void res.writeHead(200, { "Content-Type": "application/pdf" }).end("%PDF-1.4");
        if (req.url === "/yavas") {
          res.writeHead(200, { "Content-Type": "text/html" });
          const t = setInterval(() => res.write("<p>.</p>"), 300);
          res.on("close", () => clearInterval(t));
          return;
        }
        if (req.url === "/yok") return void res.writeHead(404, { "Content-Type": "text/html" }).end("<title>Yok</title>");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end("<title>Kampanya</title><h1>Kış</h1><p>%30 indirim</p>");
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(async () => {
      delete process.env.LANDING_SCAN_ALLOW_PRIVATE;
      await new Promise((r) => server.close(r));
    });

    it("follows redirects and extracts the page", async () => {
      const s = await fetchLanding(`${origin}/yonlendir`);
      expect(s.status).toBe("ok");
      expect(s.finalUrl).toBe(`${origin}/kampanya`);
      expect(s.title).toBe("Kampanya");
      expect(s.text).toContain("%30 indirim");
    });

    it("rejects redirects to non-http targets, non-HTML bodies and error pages", async () => {
      expect((await fetchLanding(`${origin}/kotu-yonlendirme`)).status).toBe("blocked");
      expect((await fetchLanding(`${origin}/pdf`)).status).toBe("not_html");
      const e = await fetchLanding(`${origin}/yok`);
      expect(e.status).toBe("http_error");
      expect(e.httpStatus).toBe(404);
    });

    it("gives up on a page that drips bytes past the overall deadline", async () => {
      const t0 = Date.now();
      expect((await fetchLanding(`${origin}/yavas`)).status).toBe("timeout");
      expect(Date.now() - t0).toBeLessThan(10_000);
    });
  });
});

describe("video heuristics and scoring", () => {
  const video = (w: number, h: number, d: number) => ({ mime: "video/mp4" as const, durationSec: d, width: w, height: h, sizeBytes: 1_000_000, frameCount: 5 });

  it("labels common aspect ratios", () => {
    expect(aspectLabel(1080, 1920)).toBe("9:16");
    expect(aspectLabel(1080, 1350)).toBe("4:5");
    expect(aspectLabel(1920, 1080)).toBe("16:9");
    expect(aspectLabel(1000, 1000)).toBe("1:1");
  });

  it("adds notes for non-vertical, low-res, long videos without a transcript", () => {
    const f = videoFindings({ ...base, video: video(640, 360, 95) });
    expect(f.map((x) => x.title)).toEqual(expect.arrayContaining(["Video dikey (9:16) değil", "Video çözünürlüğü düşük", "Video uzun", "Konuşma ve ekran yazıları girilmedi"]));
    for (const x of f) expect(x.domain).toBe("creative_quality");
  });

  it("gives a good vertical Reels full format points", () => {
    expect(videoFindings({ ...base, video: video(1080, 1920, 20), transcript: "Merhaba" })).toHaveLength(0);
    const sub = videoSubScores({ ...base, video: video(1080, 1920, 20) });
    expect(sub.reduce((s, x) => s + x.score, 0)).toBe(20);
    expect(sub.reduce((s, x) => s + x.max, 0)).toBe(20);
  });

  it("scans the transcript with the same rule cards and keeps the 100-point creative scale", async () => {
    const { result } = await runPipeline({
      input: { ...base, primaryText: "Yeni sezon burada.", video: video(1080, 1920, 20), transcript: "Bu takviye ile 7 günde 5 kilo verin, garantili!" },
      rules: catalogRules(),
      ai: null,
    });
    const tr = result.findings.filter((f) => f.field === "transcript");
    expect(tr.length).toBeGreaterThan(0);
    expect(tr.every((f) => f.rule_version_id !== null)).toBe(true);
    expect(result.score_breakdown.media).toBe("video");
    expect(result.score_breakdown.creative.reduce((s, c) => s + c.max, 0)).toBe(100);
  });

  it("stores a landing report in the breakdown", async () => {
    const { result } = await runPipeline({ input: { ...base, landing: snap("<title>Ornek Giyim</title><p>%30 indirim 909 TL</p>") }, rules: catalogRules(), ai: null });
    expect(result.score_breakdown.landing?.status).toBe("ok");
    expect(result.score_breakdown.landing?.checks.length).toBeGreaterThan(3);
  });
});

describe("season calendar", () => {
  it("computes rule-based dates", () => {
    expect(iso(nthWeekday(2027, 5, 0, 2))).toBe("2027-05-09"); // Anneler Günü
    expect(iso(nthWeekday(2026, 5, 0, 2))).toBe("2026-05-10");
    expect(iso(nthWeekday(2027, 6, 0, 3))).toBe("2027-06-20"); // Babalar Günü
    expect(iso(lastWeekday(2026, 11, 5))).toBe("2026-11-27"); // Efsane Cuma
    expect(iso(lastWeekday(2027, 11, 5))).toBe("2027-11-26");
  });

  it("lists the next 12 months in order and marks lunar holidays as unverified", () => {
    const list = upcomingEvents({ from: utc(2026, 11, 16), days: 365 });
    expect(list[0].key).toBe("ogretmenler-gunu-2026");
    expect(list.map((e) => e.start)).toEqual([...list.map((e) => e.start)].sort());
    const bf = list.find((e) => e.key === "efsane-cuma-2026")!;
    expect(bf.start).toBe("2026-11-27");
    expect(list.find((e) => e.key === "siber-pazartesi-2026")?.start).toBe("2026-11-30");
    const ramazan = list.find((e) => e.id === "ramazan-bayrami")!;
    expect(ramazan.start).toBe("2027-03-09");
    expect(ramazan.end).toBe("2027-03-11");
    expect(ramazan.verified).toBe(false);
    expect(list.find((e) => e.id === "kurban-bayrami")?.start).toBe("2027-05-16");
    expect(list.filter((e) => e.kind !== "dini" && e.id !== "okula-donus").every((e) => e.verified)).toBe(true);
    expect(list.some((e) => e.start < "2026-11-16")).toBe(false);
  });

  it("orders milestones and reports the current phase", () => {
    const bf = upcomingEvents({ from: utc(2026, 11, 1), days: 60 }).find((e) => e.id === "efsane-cuma")!;
    expect(bf.prepStart < bf.submitBy && bf.submitBy < bf.adStart && bf.adStart < bf.start).toBe(true);
    expect(phaseOf(bf, utc(2026, 10, 1))).toBe("yaklasiyor");
    const [y, m, d] = bf.prepStart.split("-").map(Number);
    expect(phaseOf(bf, utc(y, m, d))).toBe("hazirlik");
    expect(phaseOf(bf, utc(2026, 11, 26))).toBe("yayinda");
    expect(daysUntil("2026-11-27", utc(2026, 11, 16))).toBe(11);
  });

  it("filters by sector and only references existing rule cards", () => {
    const ids = new Set(RULE_CATALOG.map((r) => r.id));
    const list = upcomingEvents({ from: utc(2026, 11, 16), days: 365, sector: "estetik_klinik" });
    expect(list.every((e) => e.sectors.includes("estetik_klinik"))).toBe(true);
    for (const e of upcomingEvents({ from: utc(2026, 11, 16), days: 365 })) for (const r of e.reminders) for (const id of r.ruleIds) expect(ids.has(id), id).toBe(true);
  });

  it("exports valid iCalendar text", () => {
    const ics = toIcs(upcomingEvents({ from: utc(2026, 11, 16), days: 365 }), new Date("2026-11-16T10:00:00Z"));
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261127");
    expect(ics).toContain("UID:efsane-cuma-2026@adscope");
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe((ics.match(/END:VEVENT/g) ?? []).length);
  });
});

describe("landing checks with a video transcript", () => {
  it("compares offers spoken in the video with the page", () => {
    const s = snap("<title>Ornek Giyim</title><p>Ornek Giyim kış ürünlerinde %20 indirim. Mont, kazak ve botlarda yeni sezon renkleri sitede.</p>");
    const { report } = landingChecks({ ...base, primaryText: "Yeni sezon burada.", transcript: "Şimdi %50 indirim!" }, s);
    const c = report.checks.find((x) => x.key === "discount")!;
    expect(c.ok).toBe(false);
    expect(c.detail).toContain("%50");
  });
});
