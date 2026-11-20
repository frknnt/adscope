/**
 * Credit packages. Prices are product assumptions from the concept document and must be
 * confirmed before going live (see README "Üretime geçmeden önce").
 */
export const AGENCY_BRAND_TIERS = [3, 5, 10] as const;
export type AgencyTier = (typeof AGENCY_BRAND_TIERS)[number];
export type PackageId = "baslangic" | "profesyonel" | `ajans_${AgencyTier}`;

export interface CreditPackage {
  id: PackageId;
  name: string;
  credits: number;
  priceMinor: number; // kuruş
  currency: "TRY";
  description: string;
  /**
   * Monthly agency package (P12.3): one period of one month per payment. It never renews by itself;
   * the owner gets a reminder PLAN_REMINDER_DAYS before the end and renews with one click.
   */
  plan?: { brands: AgencyTier; perBrandMinor: number; perBrandCredits: number };
}

/** Agency package: price and monthly credits per brand. Product assumptions, confirm before going live. */
export const AGENCY_PER_BRAND_MINOR = 49900;
export const AGENCY_PER_BRAND_CREDITS = 130;
/** Days before a period ends that the renewal e-mail goes out. */
export const PLAN_REMINDER_DAYS = 3;
/** Features of the agency package (listed on pricing and in the legal package table). */
export const AGENCY_FEATURES = ["Müşteri onay bağlantısı", "Düzenleyici rolü ve 10 kişilik ekip", "Marka başına ton ve yasaklı kelimeler", "Logolu PDF, avukat bağlantısı ve API"] as const;

function agencyPackage(brands: AgencyTier): CreditPackage {
  return {
    id: `ajans_${brands}`,
    name: `Ajans · ${brands} marka`,
    credits: brands * AGENCY_PER_BRAND_CREDITS,
    priceMinor: brands * AGENCY_PER_BRAND_MINOR,
    currency: "TRY",
    description: `Aylık paket: marka başına ${AGENCY_PER_BRAND_CREDITS} kredi. Müşteri onay bağlantısı ve Düzenleyici rolü dahil. Kendiliğinden yenilenmez; bitişten ${PLAN_REMINDER_DAYS} gün önce hatırlatırız.`,
    plan: { brands, perBrandMinor: AGENCY_PER_BRAND_MINOR, perBrandCredits: AGENCY_PER_BRAND_CREDITS },
  };
}

/** One-time signup gift; no card is asked. Must match v_bonus in app_private.handle_new_user(). */
export const SIGNUP_BONUS_CREDITS = 3;

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "baslangic",
    name: "Başlangıç",
    credits: 30,
    priceMinor: 19900,
    currency: "TRY",
    description: "Tek marka, ayda birkaç kampanya için.",
  },
  {
    id: "profesyonel",
    name: "Profesyonel",
    credits: 100,
    priceMinor: 49900,
    currency: "TRY",
    description: "Düzenli reklam veren e-ticaret markaları için.",
  },
  ...AGENCY_BRAND_TIERS.map(agencyPackage),
];

export const AGENCY_PACKAGES = CREDIT_PACKAGES.filter((p) => p.plan);

export function isPlanPackage(id: string): boolean {
  return Boolean(findPackage(id)?.plan);
}

export function findPackage(id: string) {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}

export function formatTry(minor: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(minor / 100);
}
