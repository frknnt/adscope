import { appendRequiredPhrases, stripBannedWords } from "@/lib/engine/brand-voice";
import { sanitize } from "@/lib/engine/rewrite";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { fold, tidy } from "@/lib/engine/text";
import type { RuleRecord } from "@/lib/engine/types";
import type { Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { COPY_LIMITS, fitTo } from "./limits";
import type { AiCopy, CopyFramework } from "./schema";

export type CopyField = "headline" | "primaryText" | "description" | "cta";

export interface CopyBrand {
  name: string;
  tone: "samimi" | "kurumsal" | "genc";
  bannedWords: string[];
  requiredPhrases: string[];
  preferredCta: string | null;
  tagline: string | null;
  audienceNote: string | null;
}

export interface CopyAudience {
  name: string;
  ageMin: number;
  ageMax: number;
  need: string;
  objections: string;
  tone: string;
}

export interface CopyContext {
  sector: Sector;
  platform: Platform;
  product: { name: string; summary: string; points: string[] };
  brand: CopyBrand | null;
  audience: CopyAudience | null;
}

export interface CopyLine {
  text: string;
  framework: CopyFramework | null;
  /** Shortened to the platform limit. */
  trimmed: boolean;
  risk: "ok" | "yellow" | "red";
  /** Titles of the rule cards the line matched. */
  issues: string[];
  /** A version with the risky wording replaced, when one passes the re-check. */
  safe: string | null;
}

export interface CopyOutput {
  source: "ai" | "template";
  headlines: CopyLine[];
  primaryTexts: CopyLine[];
  descriptions: CopyLine[];
  ctas: CopyLine[];
  limitNote: string;
}

const NO_FLAGS = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };

function riskOf(text: string, ctx: CopyContext, rules: RuleRecord[]) {
  const findings = runRuleEngine({ headline: "", primaryText: text, description: "", flags: NO_FLAGS }, rules).filter(
    // Only wording the line itself contains; rules that fire on what is missing (labels, flags) do not apply to a single line.
    (f) => f.matchedText && f.severity !== "info",
  );
  const level: CopyLine["risk"] = findings.some((f) => f.severity === "red") ? "red" : findings.length ? "yellow" : "ok";
  return { level, findings };
}

/** Banned words out, platform limit, rule check and a safe alternative for one generated line. */
export function checkLine(raw: string, field: CopyField, framework: CopyFramework | null, ctx: CopyContext, rules: RuleRecord[]): CopyLine | null {
  const limits = COPY_LIMITS[ctx.platform];
  const max = field === "headline" ? limits.headline : field === "primaryText" ? limits.primaryText : field === "description" ? limits.description : limits.cta;
  const banned = ctx.brand?.bannedWords ?? [];
  let text = tidy(stripBannedWords(raw.replace(/\s+/g, " ").trim(), banned));
  if (field === "primaryText" && ctx.brand?.requiredPhrases.length) text = appendRequiredPhrases(text, ctx.brand.requiredPhrases);
  if ([...text].length < 2) return null;
  // Mandatory phrases must survive the cut, so primary texts that would lose them are dropped rather than cut.
  const fit = fitTo(text, max);
  if (fit.trimmed && field === "primaryText" && ctx.brand?.requiredPhrases.length) return null;
  const { level, findings } = riskOf(fit.text, ctx, rules);
  let safe: string | null = null;
  if (level !== "ok") {
    const matched = rules.filter((r) => findings.some((f) => f.ruleId === r.id));
    const candidate = fitTo(stripBannedWords(sanitize(fit.text, matched), banned), max).text;
    if (candidate && fold(candidate) !== fold(fit.text) && riskOf(candidate, ctx, rules).level === "ok") safe = candidate;
  }
  return { text: fit.text, framework, trimmed: fit.trimmed, risk: level, issues: [...new Set(findings.map((f) => f.title))], safe };
}

function dedupe(lines: (CopyLine | null)[], max: number): CopyLine[] {
  const seen = new Set<string>();
  const out: CopyLine[] = [];
  for (const l of lines) {
    if (!l) continue;
    const k = fold(l.text);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

export function processAiCopy(ai: AiCopy, ctx: CopyContext, rules: RuleRecord[]): CopyOutput {
  return {
    source: "ai",
    headlines: dedupe(ai.headlines.map((h) => checkLine(h.text, "headline", h.framework, ctx, rules)), 10),
    primaryTexts: dedupe(ai.primary_texts.map((h) => checkLine(h.text, "primaryText", h.framework, ctx, rules)), 10),
    descriptions: dedupe(ai.descriptions.map((h) => checkLine(h.text, "description", h.framework, ctx, rules)), 5),
    ctas: dedupe(ai.ctas.map((c) => checkLine(c, "cta", null, ctx, rules)), 3),
    limitNote: COPY_LIMITS[ctx.platform].note,
  };
}

const SECTOR_CTAS: Record<Sector, string[]> = {
  genel: ["Hemen incele", "Bilgi al", "Mağazayı ziyaret et"],
  takviye_gida: ["Ürünü incele", "İçeriği gör", "Bilgi al"],
  estetik_klinik: ["Bilgi al", "Ön görüşme planla", "Bize yaz"],
  kozmetik: ["Ürünü incele", "İçeriği gör", "Hemen keşfet"],
  kurs_egitim: ["Programı incele", "Bilgi al", "Kayıt koşulları"],
  emlak: ["Projeyi incele", "Bilgi al", "Bize yaz"],
  finans: ["Koşulları incele", "Bilgi al", "Başvuru sayfası"],
};

/**
 * Template copy used when the AI is off. Built only from what the user or the page said, with
 * neutral wording: no results, prices or guarantees are invented.
 */
export function templateCopy(ctx: CopyContext, rules: RuleRecord[]): CopyOutput {
  const P = ctx.product.name.trim() || ctx.brand?.name || "Ürünümüz";
  const S = ctx.product.summary.trim().replace(/[.!]+$/, "");
  const point = ctx.product.points.find((x) => x && fold(x) !== fold(P)) ?? "";
  const tag = ctx.brand?.tagline?.trim().replace(/[.!]+$/, "") ?? "";
  const cta = ctx.brand?.preferredCta?.trim() || SECTOR_CTAS[ctx.sector][0];
  const who = ctx.audience ? ctx.audience.need.trim().replace(/[.!]+$/, "") : "";
  const h: [string, CopyFramework][] = [
    [P, "dogrudan"],
    [`${P} ile tanış`, "dogrudan"],
    [`${P} hakkında bilmen gerekenler`, "merak"],
    [`${P} neden farklı?`, "merak"],
    [point || `${P} şimdi online`, "fayda"],
    [tag || `${P}: yakından bak`, "fayda"],
    [`Aradığın ${P} burada`, "aida"],
    [`${P} seni bekliyor`, "aida"],
    [who ? `${who}? ${P} burada` : `Doğru seçimi arıyorsan: ${P}`, "pas"],
    [`Yeni: ${P}`, "dogrudan"],
  ];
  const sum = S || `${P} hakkında tüm bilgiler sayfamızda`;
  const p: [string, CopyFramework][] = [
    [`${sum}. ${cta}.`, "dogrudan"],
    [`${P} ile tanış. ${sum}.`, "aida"],
    [`${sum}. Ayrıntılar ve koşullar ürün sayfasında.`, "fayda"],
    [`${P} neyi farklı yapıyor? ${sum}.`, "merak"],
    [tag ? `${tag}. ${sum}.` : `${sum}. Seçmeden önce incele.`, "fayda"],
    [who ? `${who}? ${sum}. ${cta}.` : `Doğru ürünü bulmak zaman alır. ${sum}.`, "pas"],
    [point ? `${point}. ${sum}.` : `${P}: ${sum}.`, "fayda"],
    [`${sum}. Merak ettiklerini bize yaz.`, "dogrudan"],
    [`Bugün ${P} sayfasına göz at. ${sum}.`, "aida"],
    [`${P} hakkında sorun mu var? ${sum}. ${cta}.`, "pas"],
  ];
  const d: [string, CopyFramework][] = [
    [cta, "dogrudan"],
    [tag || `${P} hakkında bilgi al`, "fayda"],
    ["Ayrıntılar ürün sayfasında", "dogrudan"],
    [`${P}: yakından bak`, "merak"],
    ["Koşullar sayfada yazılı", "dogrudan"],
  ];
  const ctas = [cta, ...SECTOR_CTAS[ctx.sector]];
  return {
    source: "template",
    headlines: dedupe(h.map(([t, f]) => checkLine(t, "headline", f, ctx, rules)), 10),
    primaryTexts: dedupe(p.map(([t, f]) => checkLine(t, "primaryText", f, ctx, rules)), 10),
    descriptions: dedupe(d.map(([t, f]) => checkLine(t, "description", f, ctx, rules)), 5),
    ctas: dedupe(ctas.map((c) => checkLine(c, "cta", null, ctx, rules)), 3),
    limitNote: COPY_LIMITS[ctx.platform].note,
  };
}

/** Product facts from a fetched page (untrusted; only short trimmed strings are kept). */
export function productFromPage(page: { title: string; description: string; h1: string[] }, fallbackName = ""): CopyContext["product"] {
  const name = (page.h1[0] || page.title.split(/\s[|\-–—·:]\s/)[0] || fallbackName).trim().slice(0, 60);
  return { name, summary: page.description.trim().slice(0, 300), points: page.h1.slice(1, 4).map((x) => x.slice(0, 80)) };
}
