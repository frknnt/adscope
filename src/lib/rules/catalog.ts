/**
 * Single source of truth for AdScope rule cards.
 *
 * - `scripts/generate-seed.ts` turns this file into `supabase/seed.sql`.
 * - Demo mode reads it directly.
 *
 * Status policy (see docs/SOURCES.md):
 *   active           -> the rule's substance was read on an official source page during verification.
 *                       May produce red/yellow findings.
 *   requires_review  -> plausible and commonly cited, but the official text could not be read here.
 *                       Produces only "info" findings, labelled as unverified, and never counts as a
 *                       legal/policy violation or changes risk levels.
 *   draft            -> never used by the engine.
 *
 * Patterns are JavaScript regular expressions applied to Turkish-folded, lower-cased text
 * (ç->c, ğ->g, ı/i̇->i, ö->o, ş->s, ü->u). Write them in folded form.
 */

export type Sector = "genel" | "takviye_gida" | "estetik_klinik";
export type RuleDomain = "meta_policy" | "tr_law" | "creative_quality";
export type RuleStatus = "active" | "draft" | "requires_review" | "retired";
export type RiskLevel = "high" | "medium" | "low";

export interface SafeReplacement {
  pattern: string;
  replacement: string;
}

export interface RuleCardDef {
  id: string;
  domain: RuleDomain;
  category: string;
  sector: Sector;
  version: number;
  status: RuleStatus;
  riskLevel: RiskLevel;
  title: string;
  description: string;
  riskyExamples: string[];
  matchPatterns: string[];
  safeReplacements: SafeReplacement[];
  safeFix: string;
  sourceOrg: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceReference?: string;
  effectiveDate?: string;
  lastVerifiedAt?: string;
  verificationNote: string;
  legalReviewStatus: "pending" | "reviewed" | "changes_requested";
  /** Optional trigger from a wizard checkbox instead of text. */
  flagTrigger?: "ai_human_character" | "ai_real_person_copy" | "influencer_post";
}

const VERIFIED_ON = "2026-11-16";

export const SOURCES = {
  metaUnrealistic: {
    org: "Meta Platforms",
    title: "Meta Advertising Standards: Unrealistic outcomes",
    url: "https://transparency.meta.com/policies/ad-standards/deceptive-content/unrealistic-outcomes",
  },
  metaPersonalHealth: {
    org: "Meta Platforms",
    title: "Meta Advertising Standards: Personal health and appearance",
    url: "https://transparency.meta.com/policies/ad-standards/objectionable-content/personal-health-and-appearance",
  },
  metaPersonalAttributes: {
    org: "Meta Platforms",
    title: "Meta Advertising Standards: Privacy violations and personal attributes",
    url: "https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes",
  },
  metaHealthWellness: {
    org: "Meta Platforms",
    title: "Meta Advertising Standards: Health and wellness",
    url: "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness",
  },
  trAmendment: {
    org: "T.C. Ticaret Bakanlığı",
    title:
      "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliğinde değişiklik (RG 01.07.2026, sayı 33297) – Bakanlık duyurusu",
    url: "https://ticaret.gov.tr/haberler/ticaret-bakanligi-tarafindan-ticari-reklam-ve-haksiz-ticari-uygulamalar-yonetmeliginde-yapilan-degisikliklerle-tuketicilerin-aldatici-reklam-ve-ticari-uygulamalara-karsi-korunmasi-guclendiriliyor",
  },
  trRegulationText: {
    org: "T.C. Resmî Gazete",
    title: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik",
    url: "https://www.resmigazete.gov.tr/eskiler/2026/07/20260701-9.htm",
  },
  tr6502: {
    org: "T.C. Mevzuat Bilgi Sistemi",
    title: "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
    url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6502&MevzuatTur=1&MevzuatTertip=5",
  },
} as const;

const AMENDMENT_NOTE =
  "Değişikliğin özü Ticaret Bakanlığı'nın 01.07.2026 tarihli resmî duyurusunda okundu. Madde numarası RÖK karşılaştırma tablosundan alındı; Resmî Gazete metni bu ortamdan okunamadı, hukukçu teyidi bekliyor.";
const AMENDMENT_EFFECTIVE = "2026-08-01";

export const RULE_CATALOG: RuleCardDef[] = [
  // ---------------------------------------------------------------- META (active)
  {
    id: "META-UO-TIMEFRAME",
    domain: "meta_policy",
    category: "Gerçekçi olmayan sonuç vaadi",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "high",
    title: "Belirli sürede kesin sonuç vaadi",
    description:
      "Meta, belirli bir süre içinde gerçekçi olmayan sonuç vaat eden reklamlara izin vermez (ör. 'Bir ayda vücut ağırlığının %5'ini kaybet').",
    riskyExamples: ["7 günde 5 kilo ver", "1 haftada kırışıklıklardan kurtulun", "3 günde göbek eritin"],
    matchPatterns: [
      "\\b\\d+\\s*(gun|gunde|hafta|haftada|ay|ayda|saat|saatte)\\w*\\s+(icinde\\s+)?(\\S+\\s+){0,3}\\d+\\s*(kilo|kg|beden|cm|santim)",
      "\\b\\d+\\s*(gun|hafta|ay|saat)\\w*\\s+(icinde\\s+)?(\\S+\\s+){0,2}(zayifla|kilo ver|incel|eri|kurtul|yok ol|gecir)",
    ],
    safeReplacements: [
      {
        pattern:
          "(sadece\\s+)?\\b\\d+\\s*(gun|gunde|hafta|haftada|ay|ayda|saat|saatte)\\w*\\s+(icinde\\s+)?(\\S+\\s+){0,3}\\d+\\s*(kilo|kg|beden|cm|santim)\\s*(ver\\w*|kaybet\\w*|incel\\w*)?",
        replacement: "günün her anına hafif bir eşlik",
      },
    ],
    safeFix:
      "Süre ve miktar içeren sonuç vaadini kaldırın. Ürünün ne olduğunu ve nasıl kullanıldığını anlatın; kişisel sonuç vaat etmeyin.",
    sourceOrg: SOURCES.metaUnrealistic.org,
    sourceTitle: SOURCES.metaUnrealistic.title,
    sourceUrl: SOURCES.metaUnrealistic.url,
    sourceReference: "Unrealistic outcomes – restricted claims (results within specific timeframes)",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Meta sayfasında okundu: 'Ads must not contain promises or suggestions of unrealistic outcomes'.",
    legalReviewStatus: "pending",
  },
  {
    id: "META-UO-HEALTH-QUALIFIER",
    domain: "meta_policy",
    category: "Gerçekçi olmayan sonuç vaadi",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Koşulsuz/kesin sağlık veya sonuç iddiası",
    description:
      "Meta, niteleyici ya da uyarı ifadesi içermeyen spesifik sağlık iddialarını gerçekçi olmayan sağlık iddiası sayar. '%100 etkili', 'garantili sonuç' gibi kesin ifadeler bu riski taşır.",
    riskyExamples: ["%100 garantili sonuç", "kesin çözüm", "mucizevi etki"],
    matchPatterns: [
      "%\\s*100\\s*(etkili|garanti\\w*|sonuc\\w*|basari\\w*|kesin)",
      "garanti(li|lı)?\\s+sonuc",
      "sonuc\\s+garanti",
      "kesin\\s+(sonuc|cozum|etki)",
      "mucize(vi)?\\s*(etki|sonuc|formul|urun)?",
    ],
    safeReplacements: [
      { pattern: "%\\s*100\\s*(etkili|garanti\\w*|sonuc\\w*|basari\\w*|kesin)", replacement: "özenle hazırlanmış" },
      { pattern: "garanti(li|lı)?\\s+sonuc\\w*", replacement: "düzenli kullanım önerisi" },
      { pattern: "sonuc\\s+garanti\\w*", replacement: "kullanım önerisi" },
      { pattern: "kesin\\s+(sonuc|cozum|etki)\\w*", replacement: "destekleyici bir seçenek" },
      { pattern: "mucize(vi)?\\s*(etki\\w*|sonuc\\w*|formul\\w*|urun\\w*)?", replacement: "özenli formül" },
    ],
    safeFix:
      "Kesinlik ve garanti ifadelerini çıkarın. Gerekirse 'kişiden kişiye değişebilir' gibi niteleyici bir ifade ekleyin.",
    sourceOrg: SOURCES.metaUnrealistic.org,
    sourceTitle: SOURCES.metaUnrealistic.title,
    sourceUrl: SOURCES.metaUnrealistic.url,
    sourceReference: "Unrealistic health claims: specific claims without qualifying or disclaimer language",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Meta sayfasında okundu.",
    legalReviewStatus: "pending",
  },
  {
    id: "META-UO-CURE",
    domain: "meta_policy",
    category: "Gerçekçi olmayan sonuç vaadi",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "high",
    title: "Hastalığı tedavi/iyileştirme iddiası",
    description:
      "Meta, tedavisi olmayan hastalıklara çare vaat eden iddiaları kısıtlı iddia olarak sayar. Hastalığı tedavi eder, iyileştirir veya yok eder ifadeleri yüksek risklidir.",
    riskyExamples: ["kanseri yener", "diyabeti tedavi eder", "hastalıklara kesin çare"],
    matchPatterns: [
      "(kanser|diyabet|seker hastaligi|tansiyon|alzheimer|romatizma|hastalik\\w*)\\S*\\s+(\\S+\\s+){0,2}(tedavi eder|iyilestir\\w*|yener|bitirir|yok eder|care)",
      "(tedavi eder|iyilestirir|sifa verir|sifali)",
    ],
    safeReplacements: [
      { pattern: "(tedavi eder|iyilestirir|sifa verir)", replacement: "günlük yaşamınıza eşlik eder" },
      { pattern: "sifali", replacement: "özenle seçilmiş" },
    ],
    safeFix:
      "Hastalık adı ve tedavi/şifa iddiası içeren ifadeleri kaldırın. Ürünün içeriğini ve kullanımını tarafsız anlatın.",
    sourceOrg: SOURCES.metaUnrealistic.org,
    sourceTitle: SOURCES.metaUnrealistic.title,
    sourceUrl: SOURCES.metaUnrealistic.url,
    sourceReference: "Restricted claims: cures for incurable diseases",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Meta sayfasında okundu.",
    legalReviewStatus: "pending",
  },
  {
    id: "META-UO-CLICKBAIT",
    domain: "meta_policy",
    category: "Tık tuzağı / sansasyonel dil",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Sansasyonel veya tık tuzağı dil",
    description:
      "Meta, sansasyonel dil kullanan tık tuzağı taktiklerini gerçekçi olmayan sonuç politikası altında kısıtlar (ör. '1 çılgın ipucu', 'Uyarı!').",
    riskyExamples: ["ŞOK! Doktorlar bunu saklıyor", "Bu tek ipucu her şeyi değiştirecek", "DİKKAT!"],
    matchPatterns: [
      "\\b(sok|soke|inanilmaz|cilgin|akilalmaz)\\b\\s*!",
      "\\bsok\\b",
      "(tek|1)\\s+(\\S+\\s+)?(ipucu|sir|yontem|numara)",
      "(doktorlar\\w*|uzmanlar\\w*)\\s+(\\S+\\s+){0,2}(sakliyor|soylemiyor|istemiyor)",
      "\\b(dikkat|uyari|son dakika)\\s*!",
    ],
    safeReplacements: [
      { pattern: "\\b(sok|soke)\\b\\s*!?", replacement: "" },
      { pattern: "\\b(dikkat|uyari|son dakika)\\s*!", replacement: "" },
    ],
    safeFix: "Sansasyonel kelimeleri ve gizli bilgi imasını çıkarın; ürünün somut faydasını sade bir dille anlatın.",
    sourceOrg: SOURCES.metaUnrealistic.org,
    sourceTitle: SOURCES.metaUnrealistic.title,
    sourceUrl: SOURCES.metaUnrealistic.url,
    sourceReference: "Click-bait tactics, such as the use of sensational language",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Meta sayfasında okundu.",
    legalReviewStatus: "pending",
  },
  {
    id: "META-PHA-NEGATIVE-SELF",
    domain: "meta_policy",
    category: "Kişisel sağlık ve görünüm",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "high",
    title: "Olumsuz beden algısı oluşturan ifade",
    description:
      "Meta, diyet, kilo verme veya sağlıkla ilgili ürünleri tanıtmak için olumsuz öz algı yaratmaya çalışan ya da bunu ima eden içeriğe izin vermez.",
    riskyExamples: ["Sarkık göbeğinden utanma", "Aynaya bakmaktan korkuyor musun?", "Çirkin selülitler"],
    matchPatterns: [
      "(gobeg\\w*|kilo\\w*|selulit\\w*|sivilce\\w*|kirisiklik\\w*|yag\\w*)\\s+(\\S+\\s+){0,3}(utan\\w*|rezil|cirkin|igrenc|nefret)",
      "(sarkik|cirkin|igrenc|bicimsiz)\\s+(gobek|vucut|basen|bacak|cilt|selulit\\w*)",
      "aynaya\\s+bakmaktan",
    ],
    safeReplacements: [
      { pattern: "(sarkik|cirkin|igrenc|bicimsiz)\\s+", replacement: "" },
    ],
    safeFix: "Kişinin bedenini kusurlu gösteren dili kaldırın. Olumlu ve kapsayıcı bir dil kullanın, ürünü merkeze alın.",
    sourceOrg: SOURCES.metaPersonalHealth.org,
    sourceTitle: SOURCES.metaPersonalHealth.title,
    sourceUrl: SOURCES.metaPersonalHealth.url,
    sourceReference: "Negative self-perception to promote diet, weight loss or health-related products",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Meta sayfasında okundu.",
    legalReviewStatus: "pending",
  },
  {
    id: "META-PHA-BEFORE-AFTER",
    domain: "meta_policy",
    category: "Kişisel sağlık ve görünüm",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Önce/sonra karşılaştırması",
    description:
      "Meta, diyet veya kilo verme ürünlerinde önce/sonra görsellerini ve kilo kaybını ima eden görselleri uygun bulmaz. Metinde önce/sonra vurgusu görselde de karşılaştırma olabileceğine işaret eder.",
    riskyExamples: ["Öncesi / sonrası", "Önce ve sonra farkı gör"],
    matchPatterns: ["\\bonce(si)?\\s*(/|-|ve|&)\\s*sonra(si)?\\b", "before\\s*(/|&|and)\\s*after"],
    safeReplacements: [{ pattern: "\\bonce(si)?\\s*(/|-|ve|&)\\s*sonra(si)?\\b", replacement: "" }],
    safeFix: "Önce/sonra karşılaştırması yerine ürünü ve kullanım anını gösteren bir görsel tercih edin.",
    sourceOrg: SOURCES.metaPersonalHealth.org,
    sourceTitle: SOURCES.metaPersonalHealth.title,
    sourceUrl: SOURCES.metaPersonalHealth.url,
    sourceReference: "Image examples: before/after weight-loss images (non-compliant)",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Meta sayfasındaki görsel örneklerinde okundu.",
    legalReviewStatus: "pending",
  },

  // ---------------------------------------------------------------- META (requires review)
  {
    id: "META-PA-PERSONAL-ATTRIBUTES",
    domain: "meta_policy",
    category: "Kişisel özellik imaları",
    sector: "genel",
    version: 1,
    status: "requires_review",
    riskLevel: "high",
    title: "Kişisel özellik iması ('Kilolu musun?')",
    description:
      "Okuyucuya doğrudan kişisel bir özelliği (sağlık durumu, kilo vb.) atfeden sorular Meta tarafından sıkça reddedilir. Politika sayfasının metni bu doğrulamada okunamadı.",
    riskyExamples: ["Kilolu musun?", "Diyabetin mi var?", "Borçlarından bunaldın mı?"],
    matchPatterns: [
      "(kilolu|sisman|diyabet\\w*|depresyon\\w*|borclu|kel|hasta)\\s+(musun|misin|mısın|musunuz|misiniz)",
      "(diyabet\\w*|borc\\w*|sivilce\\w*)\\s+(\\S+\\s+)?mi\\s+var",
    ],
    safeReplacements: [],
    safeFix: "Okuyucuya kişisel özellik atfetmek yerine ürün odaklı, genel bir ifade kullanın ('Sağlıklı rutin arayanlar için').",
    sourceOrg: SOURCES.metaPersonalAttributes.org,
    sourceTitle: SOURCES.metaPersonalAttributes.title,
    sourceUrl: SOURCES.metaPersonalAttributes.url,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Sayfa erişilebilir fakat politika metni istemci tarafında yüklendiği için okunamadı. Elle doğrulanmalı.",
    legalReviewStatus: "pending",
  },
  {
    id: "META-HW-RESTRICTED",
    domain: "meta_policy",
    category: "Sağlık ve zindelik (kısıtlı içerik)",
    sector: "estetik_klinik",
    version: 1,
    status: "requires_review",
    riskLevel: "medium",
    title: "Kozmetik işlem / kilo verme reklamı kısıtları",
    description:
      "Meta, kilo verme ürünleri ve kozmetik işlemler için yaş hedeflemesi gibi ek kısıtlar uygular. Politika metni bu doğrulamada okunamadı.",
    riskyExamples: ["Dudak dolgusu kampanyası", "Liposuction fırsatı"],
    matchPatterns: ["(dolgu|botoks|botox|liposuction|lipo|burun estetigi|meme estetigi|sac ekimi)"],
    safeReplacements: [],
    safeFix: "Kampanyayı 18 yaş üstüne hedefleyin ve işlem sonucunu vaat etmeyin. Güncel Meta politikasını kontrol edin.",
    sourceOrg: SOURCES.metaHealthWellness.org,
    sourceTitle: SOURCES.metaHealthWellness.title,
    sourceUrl: SOURCES.metaHealthWellness.url,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Sayfa başlığı doğrulandı, politika gövdesi okunamadı. Elle doğrulanmalı.",
    legalReviewStatus: "pending",
  },

  // ---------------------------------------------------------------- TR LAW (active, via official Ministry announcement)
  {
    id: "TR-RY-INDIRIM-REFERANS",
    domain: "tr_law",
    category: "İndirimli satış reklamı",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "İndirim oranı ve indirim öncesi fiyat",
    description:
      "İndirim reklamlarında indirimden önceki fiyat, indirimin başlangıç tarihinden önceki son on gün içinde uygulanan en düşük fiyat olarak alınmalıdır (çabuk bozulan mallar ve hizmetlerde indirimden hemen önceki fiyat).",
    riskyExamples: ["%70 indirim", "Son gün %50 indirim", "Yarı fiyatına"],
    matchPatterns: ["%\\s*\\d{1,2}\\s*(ya varan\\s+)?indirim", "\\d{1,2}\\s*%\\s*indirim", "yari fiyat\\w*", "indirim\\w*"],
    safeReplacements: [],
    safeFix:
      "İndirim oranının, son 10 gündeki en düşük fiyata göre hesaplandığından emin olun. Landing page'deki oranla reklamdaki oran aynı olsun; kampanya tarihlerini belirtin.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 14/3 (değişik)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-SARTLI-INDIRIM",
    domain: "tr_law",
    category: "İndirimli satış reklamı",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "low",
    title: "Şartlı kampanya / koşullu indirim",
    description:
      "İndirimin veya faydanın bir şarta bağlandığı satış reklamları da indirimli satış reklamı kurallarına tabidir.",
    riskyExamples: ["2 alana 1 bedava", "500 TL üzeri %20 indirim", "Sepette ek indirim"],
    matchPatterns: [
      "\\d+\\s*(alana|al)\\s*\\d+\\s*(bedava|ode)",
      "\\d+\\s*(tl|₺)\\s*(ve\\s*)?(uzeri|ustu)",
      "sepette\\s+(ek\\s+)?indirim",
    ],
    safeReplacements: [],
    safeFix: "Kampanya koşullarını (alt limit, geçerlilik tarihi, kapsam) reklamda açık ve okunur biçimde belirtin.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 14/7 (yeni)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-ETKILEYICI-IBARE",
    domain: "tr_law",
    category: "Sosyal medya etkileyicisi",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "high",
    title: "Etkileyici paylaşımında 'Reklam' / 'Tanıtım' ibaresi",
    description:
      "Sosyal medya etkileyicisi ödeme, indirimli/ücretsiz ürün veya etkinlik katılımı gibi bir menfaat elde ettiğinde paylaşımda 'reklam' veya 'tanıtım' ibaresinin kullanılması zorunludur. Yalnızca 'iş birliği' yetmez.",
    riskyExamples: ["#işbirliği", "Hediye edildi", "@marka sponsorluğunda"],
    matchPatterns: ["#?\\s*is\\s*birligi", "#?\\s*isbirligi", "hediye edil\\w*", "sponsor\\w*", "#?\\s*ad\\b", "#?\\s*gifted"],
    safeReplacements: [
      { pattern: "#?\\s*is\\s*birligi\\w*", replacement: "Reklam" },
      { pattern: "#?\\s*isbirligi\\w*", replacement: "Reklam" },
    ],
    safeFix:
      "Paylaşımın başında, diğer etiketlerden önce ve kaydırmadan görünecek şekilde 'Reklam' veya 'Tanıtım' ibaresi ve reklam verenin adını kullanın.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 23/A (yeni)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
    flagTrigger: "influencer_post",
  },
  {
    id: "TR-RY-YZ-KARAKTER",
    domain: "tr_law",
    category: "Yapay zekâ içeriği",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Yapay zekâ ile üretilmiş, insandan ayırt edilemeyen karakter",
    description:
      "Reklamda insandan ayırt edilemeyecek yapay zekâ ile üretilmiş dijital karakterlere yer veriliyorsa bu durum açık, anlaşılır ve ayırt edilebilir şekilde belirtilmelidir.",
    riskyExamples: ["Yapay zekâ ile oluşturulmuş model görseli, açıklama yok"],
    matchPatterns: [],
    safeReplacements: [],
    safeFix: "Görselde veya metinde 'Bu görseldeki kişi yapay zekâ ile oluşturulmuştur.' gibi açık bir ibare kullanın.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 18/8 (yeni)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
    flagTrigger: "ai_human_character",
  },
  {
    id: "TR-RY-YZ-DIJITAL-KOPYA",
    domain: "tr_law",
    category: "Yapay zekâ içeriği",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "high",
    title: "Gerçek kişinin yapay zekâ ile üretilmiş dijital kopyası",
    description:
      "Gerçek bir kişinin yapay zekâ ile oluşturulmuş dijital kopyası, o kişi ürünü gerçekten kullanmış veya tavsiye etmiş gibi reklamda kullanılamaz.",
    riskyExamples: ["Ünlü bir kişinin YZ ile üretilmiş görüntüsüyle 'ben de kullanıyorum' mesajı"],
    matchPatterns: [],
    safeReplacements: [],
    safeFix: "Gerçek kişinin dijital kopyasını kaldırın. Gerçek bir tavsiye varsa yazılı izin ve belgesi olmalı.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 27/12 (yeni)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
    flagTrigger: "ai_real_person_copy",
  },
  {
    id: "TR-RY-CEVRE-GENEL",
    domain: "tr_law",
    category: "Çevresel beyan",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Açıklamasız genel çevre ifadesi",
    description:
      "'Çevre dostu' gibi genel içerikli kavram ve ibareler açıklama yapılmadan kullanılamaz; beyanın ürünün yaşam döngüsünün hangi aşamasına ilişkin olduğu belirtilmelidir.",
    riskyExamples: ["Çevre dostu ambalaj", "Doğa dostu ürün", "%100 sürdürülebilir"],
    matchPatterns: ["(cevre|doga)\\s*dostu", "\\b(eko|yesil)\\s+urun", "surdurulebilir"],
    safeReplacements: [
      { pattern: "(cevre|doga)\\s*dostu", replacement: "geri dönüştürülebilir ambalajlı (ayrıntı: web sitemiz)" },
    ],
    safeFix:
      "Genel ifade yerine ölçülebilir ve belgelenebilir bir beyan kullanın (ör. 'Ambalajı %80 geri dönüştürülmüş kartondur') ve belgeyi erişilebilir kılın.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 17/5-6 (yeni)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-AKADEMIK-UNVAN",
    domain: "tr_law",
    category: "Yanıltıcı unvan kullanımı",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Akademik unvanın yanıltıcı kullanımı",
    description: "Ticari reklamlarda akademik unvanlar yanıltıcı ve aldatıcı şekilde kullanılamaz.",
    riskyExamples: ["Prof. Dr. onaylı formül", "Doçentlerin önerdiği çay"],
    matchPatterns: ["\\b(prof|doc)\\.?\\s*(dr\\.?)?\\s*(\\S+\\s+){0,2}(onay\\w*|oner\\w*|tavsiye\\w*)", "(profesor|docent)\\w*\\s+(\\S+\\s+){0,2}(onay\\w*|oner\\w*|tavsiye\\w*)"],
    safeReplacements: [],
    safeFix: "Unvan kullanımı gerçek, belgeli ve ürünle ilişkili değilse kaldırın.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 7/5-g (değişik)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-TUKETICI-YORUM",
    domain: "tr_law",
    category: "Tüketici yorumları",
    sector: "genel",
    version: 1,
    status: "active",
    riskLevel: "low",
    title: "Doğrulanamayan tüketici yorumu",
    description:
      "Satın alma doğrulaması yapılamayan mecralardan alınan tüketici yorumları yayımlanamaz. Reklamda yorum veya memnuniyet iddiası kullanılıyorsa kaynağı doğrulanabilir olmalıdır.",
    riskyExamples: ["Binlerce mutlu müşteri yorumu", "Kullananlar anlatıyor"],
    matchPatterns: ["(mutlu|memnun)\\s+(musteri|kullanici)\\w*\\s*(yorum\\w*)?", "kullananlar\\s+anlatiyor", "musteri\\s+yorum\\w*"],
    safeReplacements: [],
    safeFix: "Yalnızca satın alması doğrulanmış yorumları kullanın ve kaynağını belirtin.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 28/B (değişik)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-TAKVIYE-BESLENME",
    domain: "tr_law",
    category: "Takviye edici gıda",
    sector: "takviye_gida",
    version: 1,
    status: "active",
    riskLevel: "high",
    title: "Takviyenin normal beslenmenin yerine geçtiği izlenimi",
    description:
      "Takviye edici gıdaların reklamı, normal beslenme kapsamında tüketilen gıdaların yerine geçtiği izlenimi uyandıracak şekilde yapılamaz.",
    riskyExamples: ["Öğün yerine bir kapsül", "Yemek yemeden tüm ihtiyacını karşıla"],
    matchPatterns: [
      "(ogun|yemek|kahvalti)\\w*\\s+yerine",
      "(beslenme\\w*|yemeg\\w*)\\s+(\\S+\\s+)?yerini\\s+(alir|tutar)",
      "(tum|butun)\\s+(\\S+\\s+)?ihtiyac\\w*\\s+(\\S+\\s+)?karsila\\w*",
    ],
    safeReplacements: [{ pattern: "(ogun|yemek|kahvalti)\\w*\\s+yerine", replacement: "dengeli beslenmenizin yanında" }],
    safeFix: "Takviyeyi dengeli beslenmenin yanında kullanılan bir ürün olarak konumlayın; öğün yerine geçtiğini ima etmeyin.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 27/10 (yeni)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: AMENDMENT_NOTE,
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-TAKVIYE-KARSILASTIRMA",
    domain: "tr_law",
    category: "Takviye edici gıda",
    sector: "takviye_gida",
    version: 1,
    status: "active",
    riskLevel: "medium",
    title: "Takviyede sağlık beyanı içeren karşılaştırma",
    description:
      "Takviye edici gıdalarda karşılaştırmalı reklam, sağlık beyanı kapsamına giren hususlar hariç olmak üzere yapılabilir. Sağlık etkisi üzerinden rakiple kıyaslama risklidir.",
    riskyExamples: ["Diğer takviyelerden 3 kat daha etkili", "Rakiplerinden daha hızlı zayıflatır"],
    matchPatterns: [
      "(diger|rakip)\\w*\\s+(\\S+\\s+){0,3}(daha|kat)\\s+(\\S+\\s+)?(etkili|hizli|guclu|faydali)",
      "\\d+\\s*kat\\s+daha\\s+(etkili|guclu|hizli)",
    ],
    safeReplacements: [],
    safeFix: "Sağlık etkisi üzerinden kıyaslama yapmayın; karşılaştırma yalnızca fiyat, içerik miktarı gibi doğrulanabilir özelliklere dayanmalı.",
    sourceOrg: SOURCES.trAmendment.org,
    sourceTitle: SOURCES.trAmendment.title,
    sourceUrl: SOURCES.trAmendment.url,
    sourceReference: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 8/3 (değişik)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote:
      AMENDMENT_NOTE +
      " Not: Bakanlık duyurusu sağlık beyanı dışında karşılaştırmaya izin verildiğini söylüyor; ikincil kaynaktaki metin tablosunda yasak ifadesinin sürdüğü görülüyor. Resmî metinle çözülmeli.",
    legalReviewStatus: "pending",
  },

  // ---------------------------------------------------------------- TR LAW (requires review)
  {
    id: "TR-6502-USTUNLUK",
    domain: "tr_law",
    category: "Kanıtsız üstünlük iddiası",
    sector: "genel",
    version: 1,
    status: "requires_review",
    riskLevel: "high",
    title: "Kanıtlanmamış üstünlük / birincilik iddiası",
    description:
      "'En iyi', 'Türkiye'nin 1 numarası', 'en etkili' gibi iddialar belgelendirilmedikçe aldatıcı reklam riski taşır. İlgili kanun/yönetmelik metni bu doğrulamada okunamadı.",
    riskyExamples: ["Türkiye'nin en etkili detoks çayı", "Sektörün 1 numarası", "En iyi fiyat garantisi"],
    matchPatterns: ["\\ben\\s+(iyi|etkili|ucuz|kaliteli|guvenilir|hizli|guclu)\\w*", "(1|bir)\\s*numara\\w*", "\\blider\\b", "turkiye'?nin\\s+(\\S+\\s+)?(en|ilk|1)"],
    safeReplacements: [
      { pattern: "turkiye'?nin\\s+en\\s+(iyi|etkili|kaliteli|guvenilir)\\w*", replacement: "özenle hazırlanan" },
      { pattern: "\\ben\\s+(iyi|etkili|kaliteli|guvenilir|guclu)\\w*", replacement: "özenle seçilmiş" },
      { pattern: "(sektorun\\s+)?(1|bir)\\s*numara\\w*", replacement: "tercih edilen" },
    ],
    safeFix: "Bağımsız ve güncel bir kanıt yoksa üstünlük ifadesini kaldırın veya ölçülebilir bir özellikle değiştirin.",
    sourceOrg: SOURCES.tr6502.org,
    sourceTitle: SOURCES.tr6502.title,
    sourceUrl: SOURCES.tr6502.url,
    sourceReference: "6502 s. Kanun md. 61; Ticari Reklam Yönetmeliği md. 7 (teyit edilmedi)",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî metin (mevzuat.gov.tr) bu ortamdan okunamadı. Hukukçu teyidinden sonra 'active' yapılabilir.",
    legalReviewStatus: "pending",
  },
  {
    id: "TR-RY-SAGLIK-BEYANI",
    domain: "tr_law",
    category: "Sağlık beyanı",
    sector: "genel",
    version: 1,
    status: "requires_review",
    riskLevel: "high",
    title: "Mevzuata aykırı sağlık beyanı",
    description:
      "İlgili mevzuatına aykırı olarak bir mal veya hizmet hakkında sağlık beyanında bulunmak haksız ticari uygulama sayılabilir ('zayıflatır', 'bağışıklığı güçlendirir' vb.). Resmî metin bu doğrulamada okunamadı.",
    riskyExamples: ["Zayıflatır", "Bağışıklığı güçlendirir", "Yağ yakar", "Detoks yapar"],
    matchPatterns: ["zayiflat\\w*", "kilo ver\\w*", "yag yak\\w*", "bagisiklig\\w*\\s+(\\S+\\s+)?(guclendir|arttir)\\w*", "detoks\\w*", "metabolizma\\w*\\s+(\\S+\\s+)?hizlandir\\w*"],
    safeReplacements: [
      { pattern: "zayiflat\\w*", replacement: "dengeli beslenmenize eşlik eder" },
      { pattern: "yag yak\\w*", replacement: "aktif yaşamınıza eşlik eder" },
      { pattern: "kilo ver\\w*", replacement: "kendinize iyi bakın" },
    ],
    safeFix: "Onaylı bir sağlık beyanı yoksa ürünün sağlık etkisini değil, içeriğini ve kullanım anını anlatın.",
    sourceOrg: SOURCES.trRegulationText.org,
    sourceTitle: SOURCES.trRegulationText.title,
    sourceUrl: SOURCES.trRegulationText.url,
    sourceReference: "Yönetmelik eki haksız ticari uygulamalar listesi, madde 13 (ikincil kaynağa göre; teyit edilmedi)",
    effectiveDate: AMENDMENT_EFFECTIVE,
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî Gazete metni bu ortamdan okunamadı; madde yalnızca ikincil kaynakta görüldü.",
    legalReviewStatus: "pending",
  },
  {
    id: "TR-ESTETIK-ONCE-SONRA",
    domain: "tr_law",
    category: "Sağlık hizmetleri tanıtımı",
    sector: "estetik_klinik",
    version: 1,
    status: "requires_review",
    riskLevel: "high",
    title: "Sağlık hizmetinde önce/sonra ve hasta beyanı",
    description:
      "Sağlık kuruluşları ve meslek mensuplarının tanıtımında önce/sonra görselleri, hasta yorumları ve sonuç vaatleri ayrı bir sağlık mevzuatıyla sınırlanır. Bu düzenlemenin resmî metni bu doğrulamada bulunamadı.",
    riskyExamples: ["Hastalarımızın önce/sonra fotoğrafları", "Memnun hastalarımız anlatıyor"],
    matchPatterns: ["hasta\\w*\\s+(\\S+\\s+){0,2}(once|sonra|yorum|anlatiyor|memnun)", "\\bonce(si)?\\s*(/|-|ve|&)\\s*sonra(si)?\\b"],
    safeReplacements: [],
    safeFix: "Önce/sonra ve hasta beyanlarını kullanmayın; hizmeti bilgilendirici ve tarafsız biçimde anlatın. Güncel Sağlık Bakanlığı düzenlemesini kontrol edin.",
    sourceOrg: "T.C. Sağlık Bakanlığı",
    sourceTitle: "Sağlık Bakanlığı yönetmelikler listesi",
    sourceUrl: "https://www.saglik.gov.tr/TR-10413/yonetmelikler.html",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Sağlık hizmetleri tanıtım düzenlemesi resmî listede bu doğrulamada bulunamadı. Hukukçu incelemesi şart.",
    legalReviewStatus: "pending",
  },
  {
    id: "TR-ESTETIK-FIYAT-KAMPANYA",
    domain: "tr_law",
    category: "Sağlık hizmetleri tanıtımı",
    sector: "estetik_klinik",
    version: 1,
    status: "requires_review",
    riskLevel: "medium",
    title: "Sağlık hizmetinde fiyat/kampanya duyurusu",
    description:
      "Sağlık hizmetlerinde indirim ve kampanya ilanı ayrı kısıtlara tabi olabilir. Resmî metin bu doğrulamada okunamadı.",
    riskyExamples: ["Botoksa %40 indirim", "Kampanyalı burun estetiği"],
    matchPatterns: ["(dolgu|botoks|botox|estetig\\w*|lazer|epilasyon|sac ekimi)\\w*\\s+(\\S+\\s+){0,3}(indirim|kampanya|firsat)", "(indirim|kampanya|firsat)\\w*\\s+(\\S+\\s+){0,3}(dolgu|botoks|botox|estetig\\w*|sac ekimi)"],
    safeReplacements: [],
    safeFix: "Sağlık hizmetinde fiyat ve kampanya duyurusu yapmadan önce güncel Sağlık Bakanlığı düzenlemesini ve meslek kuruluşu kurallarını kontrol edin.",
    sourceOrg: "T.C. Sağlık Bakanlığı",
    sourceTitle: "Sağlık Bakanlığı yönetmelikler listesi",
    sourceUrl: "https://www.saglik.gov.tr/TR-10413/yonetmelikler.html",
    lastVerifiedAt: VERIFIED_ON,
    verificationNote: "Resmî metin bulunamadı. Hukukçu incelemesi şart.",
    legalReviewStatus: "pending",
  },

  // ---------------------------------------------------------------- DRAFT (never used)
  {
    id: "TR-RY-UCRETSIZ",
    domain: "tr_law",
    category: "Ücretsiz iddiası",
    sector: "genel",
    version: 1,
    status: "draft",
    riskLevel: "medium",
    title: "'Ücretsiz' / 'bedava' iddiası",
    description: "Ücretsiz iddiasının koşulları açık değilse aldatıcı olabilir. Kaynak bulunamadı; taslak.",
    riskyExamples: ["Ücretsiz kargo*", "Bedava deneme"],
    matchPatterns: ["ucretsiz", "bedava"],
    safeReplacements: [],
    safeFix: "Ücretsizliğin koşullarını açıkça yazın.",
    sourceOrg: SOURCES.tr6502.org,
    sourceTitle: SOURCES.tr6502.title,
    sourceUrl: SOURCES.tr6502.url,
    verificationNote: "Resmî kaynak doğrulanamadı; taslak.",
    legalReviewStatus: "pending",
  },
];

export function rulesForSector(sector: Sector, statuses: RuleStatus[] = ["active", "requires_review"]) {
  return RULE_CATALOG.filter(
    (r) => statuses.includes(r.status) && (r.sector === "genel" || r.sector === sector),
  );
}
