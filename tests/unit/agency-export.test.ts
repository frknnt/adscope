import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogRules } from "@/lib/data/memory-repo";
import { brandVoiceFindings, normalizeBannedWords, stripBannedWords } from "@/lib/engine/brand-voice";
import { buildDmKit } from "@/lib/engine/dm";
import { runPipeline } from "@/lib/engine/pipeline";
import type { AdInput } from "@/lib/engine/types";
import { csvCell, toCsv, variantRows, VARIANT_CSV_HEADER } from "@/lib/export/csv";
import { buildReportPdf, PDF_DISCLAIMER } from "@/lib/export/pdf";
import { ruleAppliesTo, rulePlatform } from "@/lib/platforms";
import { RULE_CATALOG } from "@/lib/rules/catalog";
import { SECTOR_IDS } from "@/lib/sectors";
import { upcomingEvents } from "@/lib/calendar/season";
import type { AnalysisDetail } from "@/lib/data/types";

const rules = catalogRules().filter((r) => r.status !== "draft");
const FORBIDDEN = [/kesin onay/i, /hukuken uygun/i, /reklam reddedilmez/i];
const flags = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };
const base = (over: Partial<AdInput>): AdInput => ({
  sector: "genel",
  headline: "",
  primaryText: "",
  description: "",
  flags,
  image: { mime: "image/png", width: 1080, height: 1080, sizeBytes: 300_000 },
  ...over,
});

describe("sector packages", () => {
  it("every sector has rule cards and only unverified ones for the new sectors", () => {
    for (const s of ["kozmetik", "kurs_egitim", "emlak", "finans"] as const) {
      const own = RULE_CATALOG.filter((r) => r.sector === s);
      expect(own.length, s).toBeGreaterThanOrEqual(2);
      for (const r of own) expect(["requires_review", "draft"], r.id).toContain(r.status);
    }
  });

  it("flags sector risks as info (requires_review) findings, never as violations", async () => {
    const cases: [AdInput["sector"], string, string][] = [
      ["emlak", "Satılık 3+1 daire, kira getirisi garantili!", "TR-EMLAK-GETIRI"],
      ["finans", "Faizsiz kredi fırsatı, hemen başvur.", "TR-KREDI-MALIYET"],
      ["kurs_egitim", "Sınavı garanti geçin, iş garantili sertifika programı.", "TR-EGITIM-BASARI-GARANTI"],
      ["kozmetik", "Akneyi tedavi eden krem.", "TR-KOZMETIK-TIBBI"],
    ];
    for (const [sector, primaryText, ruleId] of cases) {
      const { result } = await runPipeline({ input: base({ sector, primaryText }), rules: rules.filter((r) => r.sector === "genel" || r.sector === sector) });
      const card = rules.find((r) => r.id === ruleId)!;
      const f = result.findings.find((x) => x.rule_version_id === card.versionId);
      expect(f, `${sector} → ${ruleId}`).toBeTruthy();
      expect(f!.severity).toBe("info");
    }
  });

  it("season calendar covers the new sectors", () => {
    const from = new Date(Date.UTC(2026, 0, 1));
    for (const s of ["kozmetik", "kurs_egitim", "emlak", "finans"] as const) {
      expect(upcomingEvents({ from, days: 365, sector: s }).length, s).toBeGreaterThan(2);
    }
    expect(SECTOR_IDS).toHaveLength(7);
  });
});

describe("WhatsApp / DM kit", () => {
  it("builds first message, starter questions and greetings that pass the rule re-check", () => {
    const kit = buildDmKit(base({ sector: "takviye_gida", headline: "Yazın en etkili desteği", primaryText: "7 günde 5 kilo ver! %70 indirim.", brandName: "Lavanta" }), rules);
    expect(kit.first_message).toMatch(/^Merhaba/);
    expect(kit.first_message).not.toMatch(/kilo ver/i);
    expect(kit.starter_questions.length).toBeGreaterThanOrEqual(3);
    expect(kit.starter_questions.length).toBeLessThanOrEqual(4);
    expect(kit.starter_questions[0]).toMatch(/Kampanya/);
    expect(kit.auto_greeting).toContain("Lavanta");
    expect(kit.auto_greeting).toContain("[aydınlatma metni bağlantısı]");
    expect(kit.recheck_red).toBe(0);
    for (const t of [kit.first_message, kit.auto_greeting, kit.away_message, ...kit.notes]) for (const re of FORBIDDEN) expect(t).not.toMatch(re);
  });

  it("adds sector safety lines and is stored in the score breakdown", async () => {
    const clinic = buildDmKit(base({ sector: "estetik_klinik", headline: "Burun estetiği", primaryText: "Ön görüşme için yazın.", tone: "kurumsal" }), rules);
    expect(clinic.auto_greeting).toMatch(/tanı konulmaz/);
    const fin = buildDmKit(base({ sector: "finans", primaryText: "Kredi başvurusu" }), rules);
    expect(fin.auto_greeting).toMatch(/kart bilgisi/);
    const { result } = await runPipeline({ input: base({ primaryText: "Yeni sezon ürünlerimiz geldi." }), rules });
    expect(result.score_breakdown.dm?.first_message).toBeTruthy();
  });
});

describe("brand voice (agency mode)", () => {
  it("normalizes the banned word list", () => {
    expect(normalizeBannedWords("ucuz, Ucuz ,  bedava\nx, süper fırsat")).toEqual(["ucuz", "bedava", "süper fırsat"]);
    expect(normalizeBannedWords(Array.from({ length: 80 }, (_, i) => `kelime${i}`))).toHaveLength(50);
  });

  it("flags banned words as creative findings and strips them from generated text", async () => {
    const input = base({ primaryText: "Ucuz ve süper fırsat! Ürünlerimizi keşfedin.", brandVoice: { bannedWords: ["ucuz", "süper fırsat"], preferredCta: "Mağazamızı ziyaret edin." } });
    const f = brandVoiceFindings(input);
    expect(f.map((x) => x.matchedText)).toEqual(["Ucuz", "süper fırsat"]);
    for (const x of f) {
      expect(x.domain).toBe("creative_quality");
      expect(x.ruleVersionId).toBeNull();
    }
    // word boundaries: "ucuzluk" is not "ucuz"
    expect(brandVoiceFindings(base({ primaryText: "Ucuzluk festivali", brandVoice: { bannedWords: ["ucuz"] } }))).toHaveLength(0);
    expect(stripBannedWords("Ucuz ve güzel.", ["ucuz"])).toBe("Ve güzel.");
    const { result } = await runPipeline({ input, rules });
    for (const v of result.variants) {
      expect(`${v.headline} ${v.primary_text}`).not.toMatch(/ucuz|süper fırsat/i);
    }
    expect(result.variants.find((v) => v.tone === "Kısa ve net")?.primary_text).toContain("Mağazamızı ziyaret edin.");
  });
});

describe("platform rule sets", () => {
  it("assigns platforms and keeps Google Ads / TikTok cards unverified", () => {
    const g = RULE_CATALOG.filter((r) => rulePlatform(r) === "google_ads");
    const t = RULE_CATALOG.filter((r) => rulePlatform(r) === "tiktok");
    expect(g.length).toBeGreaterThanOrEqual(4);
    expect(t.length).toBeGreaterThanOrEqual(4);
    for (const r of [...g, ...t]) {
      expect(r.status, r.id).toBe("requires_review");
      expect(r.sourceUrl).toMatch(/^https:\/\/(support\.google\.com|ads\.tiktok\.com)\//);
    }
    expect(rulePlatform(RULE_CATALOG.find((r) => r.id === "META-UO-TIMEFRAME")!)).toBe("meta");
    expect(RULE_CATALOG.filter((r) => r.domain === "tr_law").every((r) => rulePlatform(r) === "all")).toBe(true);
  });

  it("runs only the selected platform's cards plus Turkish law", async () => {
    const text = "Mucize formül!!! 7 günde 5 kilo ver, %100 garantili.";
    const meta = await runPipeline({ input: base({ sector: "takviye_gida", primaryText: text }), rules });
    const google = await runPipeline({ input: base({ sector: "takviye_gida", primaryText: text, platform: "google_ads" }), rules });
    const tiktok = await runPipeline({ input: base({ sector: "takviye_gida", primaryText: text, platform: "tiktok" }), rules });
    const ids = (r: typeof meta) => new Set(r.result.findings.map((f) => rules.find((x) => x.versionId === f.rule_version_id)?.id));
    expect(ids(meta).has("META-UO-TIMEFRAME")).toBe(true);
    expect(ids(google).has("META-UO-TIMEFRAME")).toBe(false);
    expect(ids(google).has("GADS-GUVENILMEZ-IDDIA")).toBe(true);
    expect(ids(google).has("GADS-EDITORYAL-NOKTALAMA")).toBe(true);
    expect(ids(tiktok).has("TT-KILO-YONETIMI")).toBe(true);
    expect(ids(tiktok).has("GADS-GUVENILMEZ-IDDIA")).toBe(false);
    for (const r of [google, tiktok]) {
      for (const f of r.result.findings) if (f.domain === "meta_policy") expect(f.severity).toBe("info");
    }
    expect(ruleAppliesTo({ domain: "tr_law" }, "tiktok")).toBe(true);
  });
});

function fakeDetail(over: Partial<AnalysisDetail> = {}): AnalysisDetail {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    status: "completed",
    failureCode: null,
    sector: "takviye_gida",
    headline: "Yazın en etkili desteği",
    primaryText: "=HYPERLINK(\"http://x\") 7 günde 5 kilo ver; %70 indirim, \"garantili\" sonuç. Çğıöşü İŞ",
    metaRiskScore: 80,
    metaRiskLevel: "high",
    legalRiskLevel: "medium",
    legalFindingCount: 1,
    creativeScore: 62,
    mediaType: "image",
    platform: "meta",
    createdAt: "2026-11-17T08:00:00Z",
    expiresAt: null,
    ownedByMe: true,
    description: "",
    rejectionMessage: null,
    safeText: "Güvenli metin.",
    scoreBreakdown: null,
    engineVersion: "adscope-engine/1.0.0",
    aiProvider: "deterministic",
    demo: true,
    completedAt: "2026-11-17T08:00:05Z",
    findings: [
      {
        id: "f1",
        domain: "meta_policy",
        severity: "red",
        field: "primary_text",
        matchedText: "7 günde 5 kilo ver",
        title: "Belirli sürede kesin sonuç vaadi",
        explanation: "Açıklama metni ğüşiöç.",
        suggestion: "Öneri metni.",
        origin: "rule_engine",
        rule: null,
      },
    ],
    variants: [
      { kind: "variant", position: 2, tone: "Kurumsal", headline: "B", primaryText: "-1 kampanya", description: "", recheckRed: 0, recheckYellow: 1 },
      { kind: "safe", position: 0, tone: "Güvenli metin", headline: "A", primaryText: "Güvenli; metin", description: "x", recheckRed: 0, recheckYellow: 0 },
    ],
    appeal: null,
    asset: null,
    frames: [],
    videoMeta: null,
    transcript: null,
    landingUrl: null,
    speechTranscript: null,
    hasLandingScreenshot: false,
    creditCost: 1,
    brandId: null,
    ...over,
  };
}

describe("exports", () => {
  it("CSV escapes separators and quotes and neutralizes formulas", () => {
    expect(csvCell("=SUM(A1)", ";")).toBe("'=SUM(A1)");
    expect(csvCell("+90 555", ";")).toBe("'+90 555");
    expect(csvCell('a;"b"', ";")).toBe('"a;""b"""');
    expect(csvCell("a,b", ",")).toBe('"a,b"');
    const csv = toCsv([VARIANT_CSV_HEADER, ...variantRows(fakeDetail())]);
    expect(csv.startsWith("﻿Sıra;Tür;Ton")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Güvenli metin");
    expect(lines[1]).toContain('"Güvenli; metin"');
    expect(lines[2]).toContain("'-1 kampanya");
    expect(csv).toContain("Risk değerlendirmesidir, hukuki görüş değildir.");
  });

  it("builds a PDF with embedded fonts, the disclaimer and the brand", async () => {
    const pdf = await buildReportPdf(fakeDetail(), { brandName: "Lavanta", agencyName: "Ajans X", logo: null });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const raw = pdf.toString("latin1");
    expect(raw).toMatch(/FontFile2/);
    expect(raw).toMatch(/Manrope/);
    expect(raw).not.toMatch(/Helvetica/);
    expect(PDF_DISCLAIMER).toBe("Risk değerlendirmesidir, hukuki görüş değildir.");
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  });
});
