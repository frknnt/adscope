import { fold } from "./text";
import type { AppealOut, EngineFinding } from "./types";

/** Keyword map from Meta rejection wording (EN/TR) to the rule-card families we hold. */
const POLICY_KEYWORDS: { family: string; label: string; ruleIds: string[]; keywords: string[] }[] = [
  {
    family: "unrealistic_outcomes",
    label: "Gerçekçi olmayan sonuçlar (Unrealistic outcomes)",
    ruleIds: ["META-UO-TIMEFRAME", "META-UO-HEALTH-QUALIFIER", "META-UO-CURE", "META-UO-CLICKBAIT"],
    keywords: ["unrealistic", "gercekci olmayan", "sensational", "clickbait", "click-bait", "sansasyonel"],
  },
  {
    family: "personal_health",
    label: "Kişisel sağlık ve görünüm (Personal health and appearance)",
    ruleIds: ["META-PHA-NEGATIVE-SELF", "META-PHA-BEFORE-AFTER"],
    keywords: ["personal health", "appearance", "kisisel saglik", "gorunum", "self-perception", "before and after", "once ve sonra"],
  },
  {
    family: "personal_attributes",
    label: "Kişisel özellikler (Personal attributes)",
    ruleIds: ["META-PA-PERSONAL-ATTRIBUTES"],
    keywords: ["personal attribute", "kisisel ozellik"],
  },
  {
    family: "health_wellness",
    label: "Sağlık ve zindelik (Health and wellness)",
    ruleIds: ["META-HW-RESTRICTED", "META-UO-HEALTH-QUALIFIER"],
    keywords: ["health and wellness", "saglik ve zindelik", "weight loss", "kilo verme", "supplement", "takviye", "cosmetic procedure"],
  },
  {
    family: "misleading",
    label: "Yanıltıcı/aldatıcı uygulamalar (Misleading or deceptive)",
    ruleIds: ["META-UO-HEALTH-QUALIFIER", "META-UO-CLICKBAIT"],
    keywords: ["misleading", "deceptive", "yaniltici", "aldatici", "false claim"],
  },
];

export function detectPolicies(rejection: string) {
  const f = fold(rejection);
  return POLICY_KEYWORDS.filter((p) => p.keywords.some((k) => f.includes(k)));
}

export function buildAppeal(params: {
  rejectionMessage: string;
  findings: EngineFinding[];
  safeText: string;
  headline: string;
}): AppealOut {
  const detected = detectPolicies(params.rejectionMessage);
  const relatedRuleIds = new Set(detected.flatMap((d) => d.ruleIds));
  const metaActive = params.findings.filter((f) => f.domain === "meta_policy" && f.ruleStatus === "active");
  const related = metaActive.filter((f) => relatedRuleIds.has(f.ruleId ?? ""));
  const anyRed = metaActive.some((f) => f.severity === "red");
  const recommendation: AppealOut["recommendation"] = related.length > 0 || anyRed ? "new_ad" : "appeal";

  const policyText = detected.length
    ? detected.map((d) => d.label).join(", ")
    : "Ret mesajında tanıdığımız bir politika adı bulunamadı";

  const explanation =
    recommendation === "new_ad"
      ? `Ret gerekçesi: ${policyText}. Reklamınızda bu gerekçeyle örtüşen ifadeler bulduk (${(related.length ? related : metaActive)
          .slice(0, 3)
          .map((f) => `"${f.matchedText ?? f.title}"`)
          .join(", ")}). Bu durumda itiraz yerine önerilen güvenli metinle yeni bir reklam oluşturmak genellikle daha hızlı sonuç verir. Yine de karar Meta'ya aittir; bu bir tahmindir.`
      : `Ret gerekçesi: ${policyText}. Kural kartlarımızda reklamınızda bu gerekçeyle örtüşen belirgin bir ifade bulamadık. Reklamın yanlışlıkla reddedilmiş olma ihtimali var; Hesap Kalitesi (Account Quality) ekranından inceleme talep edebilirsiniz. Sonuç garanti edilemez.`;

  const changes = (related.length ? related : metaActive).slice(0, 4);
  const changeListTr = changes.length
    ? changes.map((f) => `- "${f.matchedText ?? f.title}" ifadesini kaldırdık/değiştirdik (${f.title}).`).join("\n")
    : "- Reklam metnini politikaya uygunluk açısından yeniden gözden geçirdik.";
  const changeListEn = changes.length
    ? changes.map((f) => `- We removed or rephrased "${f.matchedText ?? f.title}".`).join("\n")
    : "- We re-reviewed the ad copy for policy compliance.";

  const draftTr =
    recommendation === "appeal"
      ? `Merhaba Meta Destek Ekibi,\n\n"${params.headline || "Reklamımız"}" başlıklı reklamımız "${policyText}" gerekçesiyle reddedildi. Reklam metnini ve görselini ilgili Reklam Standartları'na göre yeniden inceledik. Reklam; gerçekçi olmayan sonuç vaadi, kişisel özellik iması veya olumsuz beden algısı içermemektedir.\n\nReklamın tekrar incelenmesini rica ederiz. Ek bilgi gerekirse memnuniyetle paylaşırız.\n\nSaygılarımızla`
      : `Merhaba Meta Destek Ekibi,\n\nReklamımızın "${policyText}" gerekçesiyle reddedildiğini gördük. Geri bildiriminiz doğrultusunda reklamı güncelledik:\n${changeListTr}\n\nGüncel metin: "${params.safeText}"\n\nGüncellenmiş reklamın Reklam Standartları'na uygunluk açısından incelenmesini rica ederiz.\n\nSaygılarımızla`;

  const draftEn =
    recommendation === "appeal"
      ? `Hello Meta Support Team,\n\nOur ad "${params.headline || "our ad"}" was rejected under "${detected.map((d) => d.label.split("(")[1]?.replace(")", "") ?? d.label).join(", ") || "an unspecified policy"}". We have reviewed the copy and creative against the Advertising Standards. The ad does not promise unrealistic outcomes, imply personal attributes, or create negative self-perception.\n\nWe kindly request a new review of this ad. We are happy to provide any additional information.\n\nBest regards`
      : `Hello Meta Support Team,\n\nWe noticed our ad was rejected. Following your feedback, we have updated the ad:\n${changeListEn}\n\nWe kindly request a review of the updated ad for compliance with the Advertising Standards.\n\nBest regards`;

  const checklist = [
    { label: "Ret bildirimindeki politika adını not edin.", done: detected.length > 0 },
    { label: "Riskli ifadeleri güvenli metinle değiştirin.", done: false },
    { label: "Görselde önce/sonra, yakın plan beden veya tartı gibi öğeler varsa değiştirin.", done: false },
    { label: "Landing page'deki fiyat, indirim ve vaatlerin reklamla aynı olduğunu kontrol edin.", done: false },
    {
      label:
        recommendation === "appeal"
          ? "Hesap Kalitesi ekranından 'İnceleme iste' adımıyla itirazı gönderin."
          : "Düzeltilmiş metinle yeni reklam oluşturun; aynı reklamı değiştirmeden tekrar göndermeyin.",
      done: false,
    },
    { label: "Hesap kısıtlaması varsa İtiraz asistanı sayfasındaki adım adım kontrol listesini izleyin.", done: false },
  ];

  return {
    rejection_message: params.rejectionMessage.slice(0, 3000),
    detected_policies: detected.map((d) => d.family),
    recommendation,
    explanation_tr: explanation,
    draft_tr: draftTr,
    draft_en: draftEn,
    checklist,
  };
}
