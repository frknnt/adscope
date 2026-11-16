import { runRuleEngine } from "./rule-engine";
import { findMatches, fold, replaceFolded, sentenceCase, tidy, truncateWords } from "./text";
import type { AdInput, EngineFinding, RuleRecord, VariantOut } from "./types";

const SECTOR_CTA: Record<AdInput["sector"], string> = {
  genel: "Detaylar için bize mesaj gönderin.",
  takviye_gida: "İçerik ve kullanım bilgisi için ürün sayfasını inceleyin.",
  estetik_klinik: "Bilgi almak ve ön görüşme planlamak için bize yazın.",
};

function hasCta(text: string) {
  return /(hemen|siparis|satin al|incele|whatsapp|mesaj|yazin|randevu|basvur|bilgi al|kesfet)/.test(fold(text));
}

/** Applies the safe replacements of every matched rule (active or unverified) to a text. */
export function sanitize(text: string, rules: RuleRecord[]): string {
  let out = text;
  for (const rule of rules) {
    for (const r of rule.safeReplacements) out = replaceFolded(out, r.pattern, r.replacement);
  }
  // Remove leftover risky patterns from active high-risk rules that have no replacement.
  for (const rule of rules) {
    if (rule.safeReplacements.length || rule.riskLevel !== "high") continue;
    for (const p of rule.matchPatterns) {
      if (findMatches(out, p, 1).length) out = replaceFolded(out, p, "");
    }
  }
  return tidy(out);
}

export function buildSafeText(input: AdInput, findings: EngineFinding[], rules: RuleRecord[]): string {
  const hit = new Set(findings.map((f) => f.ruleId));
  const relevant = rules.filter((r) => hit.has(r.id));
  let text = sanitize(input.primaryText, relevant);
  if (!text) text = sentenceCase(input.headline || "Ürünümüzü keşfedin.");

  const extras: string[] = [];
  if (hit.has("TR-RY-ETKILEYICI-IBARE") && !/^(reklam|tanitim)/.test(fold(text))) text = `Reklam | ${text}`;
  if (hit.has("TR-RY-YZ-KARAKTER")) extras.push("Görseldeki kişi yapay zekâ ile oluşturulmuştur.");
  if (hit.has("TR-RY-INDIRIM-REFERANS") || hit.has("TR-RY-SARTLI-INDIRIM"))
    extras.push("Kampanya koşulları ve tarihleri ürün sayfasındadır.");
  if (!hasCta(text)) extras.push(SECTOR_CTA[input.sector]);
  return tidy([text, ...extras].join(" "));
}

function subjectFrom(input: AdInput, rules: RuleRecord[]): string {
  const h = sanitize(input.headline, rules).replace(/[!?.]+$/, "");
  if (h && h.split(/\s+/).length <= 7) return sentenceCase(h);
  const first = sanitize(input.primaryText, rules).split(/[.!?]/)[0] ?? "";
  return sentenceCase(truncateWords(first, 40).replace(/[!?.…]+$/, "")) || "Yeni ürünümüz";
}

const BOILERPLATE = [
  /Görseldeki kişi yapay zekâ ile oluşturulmuştur\./,
  /Kampanya koşulları ve tarihleri ürün sayfasındadır\./,
  /Detaylar için bize mesaj gönderin\./,
  /İçerik ve kullanım bilgisi için ürün sayfasını inceleyin\./,
  /Bilgi almak ve ön görüşme planlamak için bize yazın\./,
];

/** Split the safe text into meaningful sentences: lead, supporting body and an optional offer. */
export function parts(safeText: string) {
  let t = safeText.replace(/^Reklam \|\s*/, "");
  for (const b of BOILERPLATE) t = t.replace(b, "");
  const sentences = (t.match(/[^.!?…]+[.!?…]*/g) ?? []).map((x) => x.trim()).filter((x) => x.length > 2);
  const isOffer = (x: string) => /(indirim|kampanya|firsat|ucretsiz kargo|hediye)/.test(fold(x));
  const offer = sentences.find(isOffer) ?? "";
  const rest = sentences.filter((x) => x !== offer);
  const unique = rest.filter((x, i) => rest.findIndex((y) => fold(y) === fold(x)) === i);
  return { lead: unique[0] ?? "", body: unique.slice(1, 3).join(" "), offer };
}

function join(...xs: (string | undefined | null | false)[]) {
  return tidy(xs.filter(Boolean).join(" "));
}

/**
 * Five deterministic Turkish variants with different tones. Each one is re-checked with the
 * rule engine; counts are stored so the UI can show "mevzuat ön kontrolünden geçti".
 */
export function buildVariants(input: AdInput, safeText: string, rules: RuleRecord[]): VariantOut[] {
  const subject = subjectFrom(input, rules);
  const { lead, body, offer } = parts(safeText);
  const brand = input.brandName?.trim();
  const influencer = /^Reklam \|/.test(safeText);
  const prefix = influencer ? "Reklam | " : "";
  const cta = SECTOR_CTA[input.sector];
  const offerNote = offer ? `${offer.replace(/!+$/, ".")} Kampanya koşulları ürün sayfasında.` : "";

  const raw: Omit<VariantOut, "recheck_red" | "recheck_yellow">[] = [
    {
      kind: "variant",
      position: 1,
      tone: "Samimi",
      headline: truncateWords(`${subject} ile tanış`, 40),
      primary_text: prefix + join(lead, body, offerNote, "Aklına takılan bir şey olursa yaz, hemen yanıtlayalım."),
      description: "Sorularını bekliyoruz",
    },
    {
      kind: "variant",
      position: 2,
      tone: "Kurumsal",
      headline: truncateWords(brand ? `${brand} | ${subject}` : subject, 40),
      primary_text: prefix + join(brand ? `${brand} güvencesiyle:` : "", body || lead, offerNote, "Ürün içeriği ve kullanım bilgisi web sitemizde yer alır."),
      description: "Ayrıntılı bilgi web sitemizde",
    },
    {
      kind: "variant",
      position: 3,
      tone: "Genç",
      headline: truncateWords(`Yeni favorin: ${subject}`, 40),
      primary_text: prefix + join(lead, offerNote, "Profilimize uğra, sana uygun olanı keşfet."),
      description: "Şimdi keşfet",
    },
    {
      kind: "variant",
      position: 4,
      tone: "WhatsApp / DM",
      headline: truncateWords(`${subject} için bize yazın`, 40),
      primary_text: prefix + join(body || lead, offerNote, "Sipariş ve sorularınız için WhatsApp'tan mesaj gönderin, ekibimiz hemen dönüş yapsın."),
      description: "WhatsApp'tan yazın",
    },
    {
      kind: "variant",
      position: 5,
      tone: "Kısa ve net",
      headline: truncateWords(subject, 32),
      primary_text: prefix + join(truncateWords(lead, 90), cta),
      description: "Hemen inceleyin",
    },
  ];

  // Image-only issues (real-person AI copy) cannot be fixed by text, so the text re-check ignores them.
  const recheckFlags = { influencerPost: false, aiRealPersonCopy: false, aiHumanCharacter: input.flags.aiHumanCharacter };
  const aiNote = input.flags.aiHumanCharacter ? " Görseldeki kişi yapay zekâ ile oluşturulmuştur." : "";

  return raw.map((v) => {
    let headline = tidy(v.headline);
    let primary = tidy(v.primary_text + aiNote);
    let found = runRuleEngine(
      { headline, primaryText: primary, description: v.description, flags: recheckFlags },
      rules.filter((r) => r.status === "active"),
    );
    if (found.some((f) => f.severity === "red")) {
      headline = sanitize(headline, rules);
      primary = sanitize(primary, rules);
      found = runRuleEngine(
        { headline, primaryText: primary, description: v.description, flags: recheckFlags },
        rules.filter((r) => r.status === "active"),
      );
    }
    return {
      ...v,
      headline,
      primary_text: primary,
      recheck_red: found.filter((f) => f.severity === "red").length,
      recheck_yellow: found.filter((f) => f.severity === "yellow").length,
    };
  });
}
