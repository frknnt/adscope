/** Ad platforms AdScope can check against. Meta is the default and the most complete rule set. */
export const PLATFORM_IDS = ["meta", "google_ads", "tiktok"] as const;
export type Platform = (typeof PLATFORM_IDS)[number];
export type RulePlatform = Platform | "all";

export const PLATFORM_INFO: Record<Platform, { label: string; policy: string; note: string }> = {
  meta: { label: "Meta (Facebook, Instagram)", policy: "Meta Reklam Standartları", note: "En kapsamlı kural seti; bir kısmı resmî kaynaktan doğrulandı." },
  google_ads: { label: "Google Ads", policy: "Google Ads politikaları", note: "Kartlar henüz resmî sayfadan doğrulanmadı; bulgular bilgilendirme amaçlıdır." },
  tiktok: { label: "TikTok", policy: "TikTok reklam politikaları", note: "Kartlar henüz resmî sayfadan doğrulanmadı; bulgular bilgilendirme amaçlıdır." },
};

export const PLATFORM_SHORT: Record<Platform, string> = { meta: "Meta", google_ads: "Google Ads", tiktok: "TikTok" };

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORM_IDS as readonly string[]).includes(v);
}

/** Platform of a rule card: Turkish law and creative cards apply to every platform. */
export function rulePlatform(r: { domain: string; platform?: RulePlatform }): RulePlatform {
  if (r.platform) return r.platform;
  return r.domain === "meta_policy" ? "meta" : "all";
}

export function ruleAppliesTo(r: { domain: string; platform?: RulePlatform }, platform: Platform) {
  const p = rulePlatform(r);
  return p === "all" || p === platform;
}
