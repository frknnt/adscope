import { fold } from "@/lib/engine/text";

/**
 * Special categories that must not be used to describe or target an audience: Meta's personal attributes
 * policy and the special categories of personal data in KVKK art. 6. Matching is on folded text.
 */
const CATEGORIES: { id: string; label: string; patterns: RegExp[] }[] = [
  {
    id: "health",
    label: "sağlık durumu",
    patterns: [
      /\b(hasta|hastalar|hastalik\w*|hastaligi\w*|diyabet\w*|seker hastasi|kanser\w*|depresyon\w*|anksiyete\w*|obez\w*|kilolu\w*|sisman\w*|fazla kilolu|hamile\w*|gebe|gebeler|engelli\w*|tansiyon hastasi|kolesterol\w*|migren\w*|sedef\w*|egzama\w*|kisir\w*|otizm\w*|alzheimer\w*|psikolojik sorun\w*)\b/,
    ],
  },
  { id: "religion", label: "din veya inanç", patterns: [/\b(musluman\w*|hristiyan\w*|yahudi\w*|alevi\w*|sunni\w*|ateist\w*|dindar\w*|namaz kilan\w*|oruc tutan\w*|inancli\w*)\b/] },
  { id: "ethnicity", label: "etnik köken veya ırk", patterns: [/\b(kurt kokenli|kurtler|ermeniler|rumlar|araplar|cingene\w*|romanlar|lazlar|cerkezler|suriyeliler|siyahi\w*|irk\w*)\b/] },
  { id: "sexual", label: "cinsel yönelim veya cinsel yaşam", patterns: [/\b(lgbt\w*|gey|gay|lezbiyen\w*|biseksuel\w*|trans|transseksuel\w*|trans bireyler|escinsel\w*|heteroseksuel\w*|cinsel yonelim\w*)\b/] },
  { id: "finance", label: "maddi sıkıntı", patterns: [/\b(borclu\w*|borcu olan\w*|borc batagi\w*|iflas\w*|issiz\w*|dar gelirli\w*|fakir\w*|yoksul\w*|maddi sikinti\w*|kredi notu dusuk\w*|icralik\w*|haciz\w*)\b/] },
  { id: "politics", label: "siyasi görüş", patterns: [/\b(akp|chp|mhp|hdp|dem parti|iyi parti|solcu\w*|sagci\w*|ulkucu\w*|siyasi gorus\w*)\b/] },
];

export interface SensitiveHit {
  id: string;
  label: string;
}

export function sensitiveHits(...texts: string[]): SensitiveHit[] {
  const t = fold(texts.join(" \n "));
  return CATEGORIES.filter((c) => c.patterns.some((p) => p.test(t))).map(({ id, label }) => ({ id, label }));
}

export function sensitiveMessage(hits: SensitiveHit[]): string {
  return `Hedef kitle tarifinde ${hits.map((h) => h.label).join(", ")} geçiyor. Meta, kişinin bu tür özelliklerini ima eden ya da bunlara göre hedefleyen reklamlara izin vermez; KVKK da bu bilgileri özel nitelikli kişisel veri sayar. Kitleyi ürünün kullanım durumu ve ihtiyacı üzerinden tarif et (ör. "evde spor yapmak isteyenler").`;
}
