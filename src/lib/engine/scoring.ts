import { videoSubScores } from "./video";
import { fold } from "./text";
import type { LandingReport } from "./types";
import type { AdInput, CreativeSubScore, EngineFinding, Level, ScoreBreakdown } from "./types";

const SECTOR_BASE: Record<AdInput["sector"], { points: number; reason: string }> = {
  genel: { points: 5, reason: "Genel sektör: düşük başlangıç hassasiyeti (sezgisel)." },
  takviye_gida: {
    points: 15,
    reason: "Takviye gıda: sağlık iddiaları nedeniyle sık incelenen kategori (sezgisel başlangıç puanı).",
  },
  estetik_klinik: {
    points: 15,
    reason: "Estetik/klinik: kozmetik işlem ve görünüm iddiaları nedeniyle hassas kategori (sezgisel başlangıç puanı).",
  },
  kozmetik: { points: 10, reason: "Kozmetik: görünüm ve etki iddiaları nedeniyle orta hassasiyette kategori (sezgisel başlangıç puanı)." },
  kurs_egitim: { points: 10, reason: "Kurs/eğitim: başarı ve iş garantisi iddiaları nedeniyle orta hassasiyette kategori; iş ilanı içeriyorsa özel reklam kategorisi gerekebilir (sezgisel)." },
  emlak: { points: 10, reason: "Emlak: konut reklamları Meta'da özel reklam kategorisine girer ve hedefleme kısıtlıdır (sezgisel başlangıç puanı)." },
  finans: { points: 20, reason: "Finans: kredi ve yatırım reklamları özel kategori, izin ve lisans gerektirebilir; en hassas kategorilerden (sezgisel başlangıç puanı)." },
};

export const META_POINTS = { red: 40, yellow: 20, info: 8 } as const;

export function levelFromScore(score: number): Level {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/** Meta rejection-risk score: sector baseline + points for each ACTIVE meta-policy finding. */
export function metaRisk(sector: AdInput["sector"], findings: EngineFinding[]) {
  const base = SECTOR_BASE[sector];
  const items = findings
    .filter((f) => f.domain === "meta_policy" && f.ruleStatus === "active")
    .map((f) => ({ ruleId: f.ruleId ?? "", title: f.title, points: META_POINTS[f.severity] }));
  const score = Math.min(100, base.points + items.reduce((s, i) => s + i.points, 0));
  return { score, level: levelFromScore(score), base: base.points, baseReason: base.reason, items };
}

/** Legal risk: driven ONLY by active tr_law rules. Unverified rules are counted separately and never raise the level. */
export function legalRisk(findings: EngineFinding[]) {
  const active = findings.filter((f) => f.domain === "tr_law" && f.ruleStatus === "active");
  const unverified = findings.filter((f) => f.domain === "tr_law" && f.ruleStatus !== "active").length;
  let level: Level = "low";
  if (active.some((f) => f.severity === "red")) level = "high";
  else if (active.some((f) => f.severity === "yellow")) level = "medium";
  const reason =
    active.length === 0
      ? "Aktif (doğrulanmış) mevzuat kurallarından eşleşme bulunmadı."
      : `${active.length} aktif mevzuat kuralıyla eşleşme bulundu; en yüksek önem derecesine göre seviye belirlendi.`;
  return { level, count: active.length, unverified, reason };
}

const CTA_PATTERNS = [
  "hemen",
  "simdi",
  "siparis",
  "satin al",
  "incele",
  "kesfet",
  "whatsapp",
  "mesaj gonder",
  "bize yaz",
  "yazin",
  "randevu",
  "basvur",
  "kaydol",
  "dene",
  "tikla",
  "uye ol",
  "bilgi al",
];

const ASPECTS = [
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 0.8 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "1.91:1", ratio: 1.91 },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export interface VisualAssessment {
  textDensity: number; // 0-10, 10 = ideal (little text on image)
  productVisibility: number; // 0-10
  brandConsistency: number; // 0-10
  notes: string;
  /** Video only: strength of the first 3 seconds (0-10). */
  hookStrength?: number;
}

/**
 * Creative quality: deterministic sub-scores. When an AI provider supplies a visual
 * assessment it replaces the "visual" sub-score; otherwise a neutral, clearly labelled value is used.
 */
export function creativeScore(input: AdInput, visual?: VisualAssessment | null): { score: number; parts: CreativeSubScore[] } {
  const parts: CreativeSubScore[] = [];
  const allText = `${input.headline} ${input.primaryText} ${input.description}`;
  const folded = fold(allText);

  // CTA (20)
  const hasCta = CTA_PATTERNS.some((p) => folded.includes(p));
  parts.push({
    key: "cta",
    label: "Harekete geçirici mesaj (CTA)",
    score: hasCta ? 20 : 6,
    max: 20,
    reason: hasCta
      ? "Metinde açık bir eylem çağrısı var."
      : "Açık bir eylem çağrısı bulunamadı. 'Sipariş için WhatsApp'tan yazın' gibi tek ve net bir CTA ekleyin.",
  });

  // Headline length (15)
  const h = input.headline.trim().length;
  let hs = 15;
  let hr = "Başlık uzunluğu ideal aralıkta (15–40 karakter).";
  if (h === 0) {
    hs = 3;
    hr = "Başlık boş. Feed'de görünen kısa bir başlık ekleyin.";
  } else if (h < 15) {
    hs = 10;
    hr = "Başlık çok kısa; ürünü veya faydayı netleştiren birkaç kelime ekleyin.";
  } else if (h > 40) {
    hs = clamp(15 - Math.ceil((h - 40) / 6), 4, 14);
    hr = "Başlık 40 karakteri aşıyor; mobilde kesilebilir.";
  }
  parts.push({ key: "headline", label: "Başlık uzunluğu", score: hs, max: 15, reason: hr });

  // Primary text length (15)
  const p = input.primaryText.trim().length;
  let ps = 15;
  let pr = "Ana metin uzunluğu dengeli; ilk 125 karakter mesajı taşıyor.";
  if (p < 40) {
    ps = 8;
    pr = "Ana metin çok kısa; ürünün ne olduğunu ve kime uygun olduğunu bir cümleyle anlatın.";
  } else if (p > 300) {
    ps = clamp(15 - Math.ceil((p - 300) / 60), 5, 14);
    pr = "Ana metin uzun; ana mesajı ilk 125 karaktere taşıyın.";
  }
  parts.push({ key: "primary_text", label: "Ana metin uzunluğu", score: ps, max: 15, reason: pr });

  // Readability: shouting, exclamation, emoji density (15)
  const letters = allText.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  const upper = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, "").length;
  const upperRatio = letters.length ? upper / letters.length : 0;
  const exclaims = (allText.match(/!/g) ?? []).length;
  const emojis = (allText.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  let rs = 15;
  const rReasons: string[] = [];
  if (upperRatio > 0.35) {
    rs -= 6;
    rReasons.push("büyük harf kullanımı yoğun");
  }
  if (exclaims > 2) {
    rs -= Math.min(5, exclaims - 2);
    rReasons.push(`${exclaims} ünlem işareti var`);
  }
  if (emojis > 4) {
    rs -= 3;
    rReasons.push("emoji sayısı fazla");
  }
  parts.push({
    key: "readability",
    label: "Okunabilirlik ve ton",
    score: clamp(rs, 0, 15),
    max: 15,
    reason: rReasons.length ? `Dikkat: ${rReasons.join(", ")}. Daha sakin bir ton güven verir.` : "Ton sakin ve okunabilir.",
  });

  // Image resolution (10) + aspect ratio (10); videos use duration/resolution/Reels format instead
  if (input.video) {
    parts.push(...videoSubScores(input));
  } else if (input.image) {
    const minSide = Math.min(input.image.width, input.image.height);
    const res = minSide >= 1080 ? 10 : minSide >= 600 ? 6 : 2;
    parts.push({
      key: "resolution",
      label: "Görsel çözünürlüğü",
      score: res,
      max: 10,
      reason:
        res === 10
          ? `Çözünürlük yeterli (${input.image.width}×${input.image.height}).`
          : `Kısa kenar ${minSide}px. Feed için en az 1080px önerilir.`,
    });
    const ratio = input.image.width / input.image.height;
    const best = ASPECTS.map((a) => ({ ...a, diff: Math.abs(ratio - a.ratio) / a.ratio })).sort((a, b) => a.diff - b.diff)[0];
    const ok = best.diff <= 0.03;
    parts.push({
      key: "aspect",
      label: "Format uyumu",
      score: ok ? 10 : best.diff <= 0.1 ? 6 : 3,
      max: 10,
      reason: ok
        ? `Oran ${best.label} formatına uygun.`
        : `Oran standart formatlara (1:1, 4:5, 9:16, 1.91:1) uymuyor; en yakın ${best.label}. Kırpma önerilir.`,
    });
  } else {
    parts.push({ key: "resolution", label: "Görsel çözünürlüğü", score: 0, max: 10, reason: "Görsel yüklenmedi." });
    parts.push({ key: "aspect", label: "Format uyumu", score: 0, max: 10, reason: "Görsel yüklenmedi." });
  }

  // Visual content (15): AI or neutral placeholder
  if (visual) {
    const parts10 = [visual.textDensity, visual.productVisibility, visual.brandConsistency, ...(visual.hookStrength !== undefined ? [visual.hookStrength] : [])];
    const v = Math.round((parts10.reduce((s, x) => s + x, 0) / (parts10.length * 10)) * 15);
    parts.push({ key: "visual", label: input.video ? "Video içeriği (YZ incelemesi)" : "Görsel içerik (YZ incelemesi)", score: clamp(v, 0, 15), max: 15, reason: visual.notes });
  } else {
    parts.push({
      key: "visual",
      label: input.video ? "Video içeriği" : "Görsel içerik",
      score: 9,
      max: 15,
      reason: input.video
        ? "Video kareleri bu modda otomatik incelenmedi; nötr puan verildi. İlk 3 saniyede ürünü ve ana mesajı gösterin, ekran yazılarını kısa tutun."
        : "Görseldeki metin yoğunluğu ve ürün görünürlüğü bu modda otomatik incelenmedi; nötr puan verildi. Görselde metni kısa tutun, ürünü net gösterin.",
    });
  }

  const score = clamp(Math.round(parts.reduce((s, x) => s + x.score, 0)), 0, 100);
  return { score, parts };
}

export function buildBreakdown(
  input: AdInput,
  findings: EngineFinding[],
  visual?: VisualAssessment | null,
  landing?: LandingReport | null,
): { breakdown: ScoreBreakdown; meta: ReturnType<typeof metaRisk>; legal: ReturnType<typeof legalRisk>; creative: number } {
  const meta = metaRisk(input.sector, findings);
  const legal = legalRisk(findings);
  const creative = creativeScore(input, visual);
  return {
    meta,
    legal,
    creative: creative.score,
    breakdown: {
      meta: { base: meta.base, baseReason: meta.baseReason, items: meta.items },
      legal: { activeFindings: legal.count, unverifiedFlags: legal.unverified, reason: legal.reason },
      creative: creative.parts,
      visualReviewedByAi: Boolean(visual),
      media: input.video ? "video" : "image",
      landing: landing ?? null,
    },
  };
}
