import { runRuleEngine } from "./rule-engine";
import { sanitize } from "./rewrite";
import { fold, sentenceCase, tidy, truncateWords } from "./text";
import type { AdInput, RuleRecord } from "./types";

/**
 * WhatsApp / Instagram DM kit for "mesaj gönder" ads: the message a customer sends first
 * (pre-filled), short starter questions, and the business's automatic greeting.
 * Everything is built from the safe text and re-checked with the same rule cards.
 */
export interface DmKit {
  first_message: string;
  starter_questions: string[];
  auto_greeting: string;
  away_message: string;
  notes: string[];
  recheck_red: number;
  recheck_yellow: number;
}

const SECTOR_QUESTIONS: Record<AdInput["sector"], string[]> = {
  genel: ["Fiyat ve stok bilgisi alabilir miyim?", "Kargo ne kadar sürer?", "İade ve değişim koşulları neler?"],
  takviye_gida: ["İçerik listesini paylaşır mısınız?", "Nasıl kullanılıyor?", "Kargo ne kadar sürer?"],
  estetik_klinik: ["Ön görüşme için uygun gün var mı?", "Klinik nerede?", "Görüşmeye ne getirmeliyim?"],
  kozmetik: ["İçerik listesini paylaşır mısınız?", "Hangi cilt tipine uygun?", "Kargo ne kadar sürer?"],
  kurs_egitim: ["Program içeriğini paylaşır mısınız?", "Ders saatleri ve süre nedir?", "Kayıt koşulları neler?"],
  emlak: ["Proje konumu ve teslim tarihi nedir?", "Yerinde görme randevusu alabilir miyim?", "Yetki belgesi numaranızı paylaşır mısınız?"],
  finans: ["Başvuru için hangi belgeler gerekiyor?", "Ücret ve masraflar neler?", "Şubeniz veya web siteniz hangisi?"],
};

const SECTOR_GREETING_NOTE: Partial<Record<AdInput["sector"], string>> = {
  estetik_klinik: "Mesajla tanı konulmaz ve tedavi önerilmez; değerlendirme yalnızca hekim muayenesinden sonra yapılır.",
  takviye_gida: "Sağlık sorunlarınız için lütfen hekiminize danışın; takviye gıdalar ilaç değildir.",
  finans: "Güvenliğiniz için kimlik numarası, kart bilgisi veya şifre gibi bilgileri bu kanaldan paylaşmayın.",
  emlak: "Görüşme öncesi proje ve yetki belgesi bilgilerini sizinle paylaşırız.",
  kurs_egitim: "Program, süre ve ücret bilgilerini yazılı olarak iletiriz.",
};

function subject(input: AdInput, rules: RuleRecord[]) {
  const h = sanitize(input.headline, rules).replace(/[!?.…]+$/, "").trim();
  if (h && h.split(/\s+/).length <= 6) return h;
  const first = sanitize(input.primaryText, rules).split(/[.!?]/)[0] ?? "";
  return truncateWords(first, 36).replace(/[!?.…]+$/, "").trim();
}

/** Lowercase first letter for use mid-sentence, unless it looks like a name/acronym. */
function mid(s: string) {
  if (!s) return s;
  if (/^[A-ZÇĞİÖŞÜ]{2,}/.test(s)) return s;
  return s.charAt(0).toLocaleLowerCase("tr-TR") + s.slice(1);
}

export function buildDmKit(input: AdInput, rules: RuleRecord[]): DmKit {
  const s = subject(input, rules);
  const brand = input.brandName?.trim();
  const tone = input.tone ?? "samimi";
  const you = tone === "kurumsal" ? "size" : "sana";

  const first = s ? `Merhaba, reklamınızı gördüm. ${sentenceCase(s)} hakkında bilgi almak istiyorum.` : "Merhaba, reklamınızı gördüm. Bilgi almak istiyorum.";
  const hello = tone === "kurumsal" ? "Merhaba, mesajınız için teşekkür ederiz." : "Merhaba, yazdığın için teşekkürler!";
  const team = brand ? `${brand} ekibi olarak` : "Ekibimiz olarak";
  const ask =
    tone === "kurumsal"
      ? "Size daha hızlı yardımcı olabilmemiz için sorunuzu kısaca yazabilirsiniz."
      : `${sentenceCase(you)} daha hızlı yardımcı olabilmemiz için sorunu kısaca yazabilirsin.`;
  const greeting = tidy(
    [
      hello,
      `${team} ${s ? `${mid(s)} ile ilgili ` : ""}${tone === "kurumsal" ? "mesajınızı" : "mesajını"} aldık.`,
      ask,
      SECTOR_GREETING_NOTE[input.sector] ?? "",
      "Kişisel verileriniz yalnızca talebinizi yanıtlamak için kullanılır: [aydınlatma metni bağlantısı]",
    ].join(" "),
  );
  const away = tidy(
    `${hello} Şu an çalışma saatlerimiz dışındayız; ${tone === "kurumsal" ? "mesajınızı aldık, ilk iş gününde size" : "mesajını aldık, ilk iş gününde sana"} dönüş yapacağız. Çalışma saatlerimiz: [çalışma saatleri]`,
  );

  const questions = SECTOR_QUESTIONS[input.sector].slice(0, 3);
  if (/(indirim|kampanya|firsat)/.test(fold(`${input.headline} ${input.primaryText}`))) questions.unshift("Kampanya koşulları ve bitiş tarihi nedir?");

  const notes = [
    "Bu şablonlar müşterinin başlattığı yazışmayı yanıtlamak içindir. Sonradan kampanya veya tanıtım mesajı göndereceksen ticari ileti onayı ve İYS kaydı gerekebilir; uzmanına danış.",
    "Karşılama mesajında reklamdaki vaatlerin ötesine geçme; fiyat, stok ve teslim bilgisini reklamla aynı tut.",
    "Köşeli parantez içindeki alanları (aydınlatma metni bağlantısı, çalışma saatleri) yayından önce kendi bilgilerinle doldur.",
  ];

  const active = rules.filter((r) => r.status === "active");
  const clean = (text: string) => {
    const flags = { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false };
    let t = text;
    let f = runRuleEngine({ headline: "", primaryText: t, description: "", flags }, active);
    if (f.some((x) => x.severity === "red")) {
      t = sanitize(t, rules);
      f = runRuleEngine({ headline: "", primaryText: t, description: "", flags }, active);
    }
    return { t, f };
  };
  const a = clean(first);
  const b = clean(greeting);
  const c = clean(away);
  const qs = questions.map((q) => clean(q));
  const all = [a, b, c, ...qs].flatMap((x) => x.f);

  return {
    first_message: a.t,
    starter_questions: qs.map((x) => x.t).slice(0, 4),
    auto_greeting: b.t,
    away_message: c.t,
    notes,
    recheck_red: all.filter((x) => x.severity === "red").length,
    recheck_yellow: all.filter((x) => x.severity === "yellow").length,
  };
}
