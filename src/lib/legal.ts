/** Versions of the legal texts a user consents to. Bump when a text changes. */
export const LEGAL_VERSIONS = {
  terms: "2026-11-17",
  kvkk: "2026-11-16",
  privacy: "2026-11-17",
  /** Mesafeli satış sözleşmesi, accepted before every checkout. */
  distanceSales: "2026-11-20",
  /** Ön bilgilendirme formu, acknowledged before every checkout. */
  preInfo: "2026-11-20",
} as const;

/**
 * Seller / data controller details shown on every legal page. The bracketed values are placeholders
 * until the owner provides the real ones; `companyInfoPending()` stays true while any remains.
 */
export const COMPANY = {
  name: "[ŞAHIS ŞİRKETİ UNVANI]",
  address: "[ADRES]",
  taxOffice: "[VERGİ DAİRESİ]",
  taxNo: "[VERGİ NO]",
  email: "[İLETİŞİM E-POSTASI]",
  kep: "[KEP ADRESİ, VARSA]",
} as const;

export function companyInfoPending(c: Record<string, string> = COMPANY): boolean {
  return Object.values(c).some((v) => /^\[.*\]$/.test(v.trim()));
}

/** One-line controller description for running text. */
export const CONTROLLER = `${COMPANY.name} (${COMPANY.address}; ${COMPANY.email})`;

/** Checkout consent fields; both must be ticked before a paid checkout starts. */
export const CHECKOUT_CONSENT_FIELDS = ["onBilgilendirme", "mesafeliSatis"] as const;

export function checkoutConsentGiven(form: { get(name: string): unknown }): boolean {
  return CHECKOUT_CONSENT_FIELDS.every((f) => form.get(f) === "on");
}
