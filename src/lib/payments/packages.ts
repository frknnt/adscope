/**
 * Credit packages. Prices are product assumptions from the concept document and must be
 * confirmed before going live (see README "Üretime geçmeden önce").
 */
export interface CreditPackage {
  id: "baslangic" | "profesyonel" | "ajans";
  name: string;
  credits: number;
  priceMinor: number; // kuruş
  currency: "TRY";
  description: string;
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
  {
    id: "ajans",
    name: "Ajans",
    credits: 400,
    priceMinor: 149000,
    currency: "TRY",
    description: "Ajans ve freelancer'lar için: çoklu marka, ekip, logolu PDF, avukat bağlantısı, API. Ayda bir alınması önerilir.",
  },
];

export function findPackage(id: string) {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}

export function formatTry(minor: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(minor / 100);
}
