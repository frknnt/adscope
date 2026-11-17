import { stripBannedWords } from "@/lib/engine/brand-voice";
import { sanitize } from "@/lib/engine/rewrite";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import { fold, tidy } from "@/lib/engine/text";
import type { RuleRecord } from "@/lib/engine/types";
import type { Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import type { AiScript, ScriptDuration } from "./schema";

export interface ScriptContext {
  sector: Sector;
  platform: Platform;
  duration: ScriptDuration;
  product: { name: string; summary: string };
  brand: { name: string; bannedWords: string[]; preferredCta: string | null; tagline: string | null } | null;
  audience: { name: string; need: string } | null;
  /** The video will use an AI-generated person or voice. */
  aiPersonOrVoice: boolean;
}

export interface ScriptLineCheck {
  risk: "ok" | "yellow" | "red";
  issues: string[];
  /** Replacement when the line was risky and a safer wording passes the re-check. */
  safe: string | null;
}

export interface ScriptScene {
  start: number;
  end: number;
  visual: string;
  onScreen: string;
  voiceover: string;
  check: ScriptLineCheck;
  /** The model wrote something that reads like a customer testimonial; it was removed. */
  testimonialRemoved: boolean;
}

export interface ScriptOutput {
  source: "ai" | "template";
  duration: ScriptDuration;
  scenes: ScriptScene[];
  warnings: string[];
}

/** Wording that presents the ad as a real customer's own experience or review. */
const TESTIMONIAL = [
  /\b(gerçek )?müşteri(miz|lerimiz)? (yorumu|yorumları|deneyimi|diyor|anlatıyor)/,
  /\bkullanıcı yorum/,
  /\b(ben de|ben) (kullandım|denedim)/,
  /\b(kullandım|denedim) ve\b/,
  /\b(hanım|bey|abla|abi) (diyor|anlatıyor)/,
  /\bmüşterimiz [a-zçğıöşü]+/,
  /\byorum(lar)?a göre\b/,
  /\bşikayetim (kalmadı|yok)/,
];

export function looksLikeTestimonial(text: string): boolean {
  const f = fold(text);
  return TESTIMONIAL.some((re) => re.test(f) || re.test(text.toLocaleLowerCase("tr-TR")));
}

const NO_FLAGS = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };

function riskOf(text: string, rules: RuleRecord[]) {
  const findings = runRuleEngine({ headline: "", primaryText: text, description: "", flags: NO_FLAGS }, rules).filter((f) => f.matchedText && f.severity !== "info");
  return { level: (findings.some((f) => f.severity === "red") ? "red" : findings.length ? "yellow" : "ok") as ScriptLineCheck["risk"], findings };
}

export function checkScriptText(text: string, rules: RuleRecord[]): ScriptLineCheck {
  if (!text.trim()) return { risk: "ok", issues: [], safe: null };
  const { level, findings } = riskOf(text, rules);
  let safe: string | null = null;
  if (level !== "ok") {
    const candidate = tidy(sanitize(text, rules.filter((r) => findings.some((f) => f.ruleId === r.id))));
    if (candidate && fold(candidate) !== fold(text) && riskOf(candidate, rules).level === "ok") safe = candidate;
  }
  return { risk: level, issues: [...new Set(findings.map((f) => f.title))], safe };
}

const clip = (s: string, max: number) => [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("");

/** Scales scene lengths to the chosen total, rounds to half seconds and makes times contiguous. */
export function timeScenes(lengths: number[], total: number): { start: number; end: number }[] {
  const sum = lengths.reduce((a, b) => a + Math.max(0.5, b), 0);
  const out: { start: number; end: number }[] = [];
  let t = 0;
  lengths.forEach((l, i) => {
    const end = i === lengths.length - 1 ? total : Math.min(total, Math.max(t + 0.5, Math.round(((t + (Math.max(0.5, l) / sum) * total) * 2)) / 2));
    out.push({ start: t, end });
    t = end;
  });
  return out;
}

function sceneFrom(raw: { visual: string; onScreen: string; voiceover: string }, time: { start: number; end: number }, ctx: ScriptContext, rules: RuleRecord[]): ScriptScene {
  const banned = ctx.brand?.bannedWords ?? [];
  const tidyLine = (s: string, max: number) => tidy(stripBannedWords(clip(s, max), banned));
  let onScreen = tidyLine(raw.onScreen, 120);
  let voiceover = tidyLine(raw.voiceover, 300);
  const testimonial = looksLikeTestimonial(onScreen) || looksLikeTestimonial(voiceover);
  if (testimonial) {
    if (looksLikeTestimonial(onScreen)) onScreen = "";
    if (looksLikeTestimonial(voiceover)) voiceover = "";
  }
  const check = checkScriptText([onScreen, voiceover].filter(Boolean).join(" "), rules);
  return { ...time, visual: clip(raw.visual, 300), onScreen, voiceover, check, testimonialRemoved: testimonial };
}

export function scriptWarnings(ctx: ScriptContext, scenes: ScriptScene[]): string[] {
  const w: string[] = [];
  if (ctx.aiPersonOrVoice) {
    w.push(
      "Yapay zekâ ile üretildiğini belirt: bu videoda yapay zekâyla üretilmiş bir kişi ya da ses kullanılacak. Videonun içinde ve açıklamasında bunu açıkça yaz. Meta, gerçekçi görünen yapay zekâ içeriklerinde “Yapay zekâ bilgisi” etiketini gösterir ve reklamverenden bu tür içerikleri bildirmesini bekler; TikTok da yapay zekâ ile üretilen içerik için etiket ister.",
    );
  }
  if (scenes.some((s) => s.testimonialRemoved)) w.push("Gerçek müşteri yorumu gibi görünen satırlar çıkarıldı. Gerçek bir yorum kullanacaksan izinli ve doğrulanabilir olmalı; uydurma yorum yanıltıcı reklamdır.");
  if (scenes.some((s) => s.check.risk !== "ok")) w.push("Bazı satırlar kural kartlarıyla eşleşti; yanlarındaki güvenli sürümü kullanmayı düşün.");
  return w;
}

export function processAiScript(raw: AiScript, ctx: ScriptContext, rules: RuleRecord[]): ScriptOutput {
  const times = timeScenes(raw.scenes.map((s) => s.seconds), ctx.duration);
  const scenes = raw.scenes.map((s, i) => sceneFrom({ visual: s.visual, onScreen: s.on_screen_text, voiceover: s.voiceover }, times[i], ctx, rules));
  return { source: "ai", duration: ctx.duration, scenes, warnings: scriptWarnings(ctx, scenes) };
}

/** Deterministic script when AI is off: hook, problem/need, product, detail, call to action. */
export function templateScript(ctx: ScriptContext, rules: RuleRecord[]): ScriptOutput {
  const P = ctx.product.name.trim() || ctx.brand?.name || "Ürünümüz";
  const S = ctx.product.summary.trim().replace(/[.!]+$/, "") || `${P} hakkında bilmen gerekenler`;
  const need = ctx.audience?.need.trim().replace(/[.!?]+$/, "") ?? "";
  const cta = ctx.brand?.preferredCta?.trim() || "Ayrıntılar sayfada";
  const brand = ctx.brand?.name ?? P;
  const base = [
    { s: 3, visual: `Ürün yakın çekim, ilk karede net görünür. Köşede ${brand} adı.`, onScreen: P, voiceover: `${P} ile tanış.` },
    { s: 4, visual: "Ürünün kullanıldığı gündelik bir an; kişi göstermeden eller ve ortam.", onScreen: need ? `${need}?` : "Doğru seçimi arıyorsan", voiceover: need ? `${need}? ${P} burada.` : `Doğru seçimi arıyorsan ${P} burada.` },
    { s: 5, visual: "Ürünün ayrıntıları; ambalaj ve etiket okunur şekilde.", onScreen: clip(S, 60), voiceover: `${S}.` },
    { s: 3, visual: `${brand} logosu ve ürün sayfasının adresi.`, onScreen: cta, voiceover: `${cta}.` },
  ];
  const extra =
    ctx.duration >= 30
      ? [
          { s: 6, visual: "Ürünün farklı açılardan gösterimi, yavaş kaydırma.", onScreen: "Yakından bak", voiceover: `${P} hakkında merak ettiklerin ürün sayfasında.` },
          { s: 5, visual: "Kutudan çıkarma ya da hazırlanış adımları.", onScreen: "Nasıl kullanılır?", voiceover: "Kullanım bilgisi ve koşullar sayfada yazılı." },
        ]
      : [];
  const extra45 = ctx.duration >= 45 ? [{ s: 8, visual: "Ürünün günün farklı anlarındaki kullanımı.", onScreen: ctx.brand?.tagline || P, voiceover: ctx.brand?.tagline ? `${ctx.brand.tagline}.` : `${P}, gününe uyar.` }, { s: 6, visual: "Teslimat ya da mağaza bilgisi ekranı.", onScreen: "Sipariş ve teslimat bilgisi sayfada", voiceover: "Sipariş ve teslimat bilgisi ürün sayfasında." }] : [];
  const all = [base[0], base[1], ...extra, base[2], ...extra45, base[3]];
  const times = timeScenes(all.map((x) => x.s), ctx.duration);
  const scenes = all.map((x, i) => sceneFrom(x, times[i], ctx, rules));
  return { source: "template", duration: ctx.duration, scenes, warnings: scriptWarnings(ctx, scenes) };
}

export { toSrt } from "./srt";
