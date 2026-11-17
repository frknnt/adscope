import { describe, expect, it } from "vitest";
import { checkoutConsentGiven, COMPANY, companyInfoPending, LEGAL_VERSIONS } from "@/lib/legal";

const form = (v: Record<string, string>) => ({ get: (k: string) => v[k] ?? null });

describe("legal texts", () => {
  it("requires both checkout consents", () => {
    expect(checkoutConsentGiven(form({ onBilgilendirme: "on", mesafeliSatis: "on" }))).toBe(true);
    expect(checkoutConsentGiven(form({ onBilgilendirme: "on" }))).toBe(false);
    expect(checkoutConsentGiven(form({ mesafeliSatis: "on" }))).toBe(false);
    expect(checkoutConsentGiven(form({ onBilgilendirme: "true", mesafeliSatis: "on" }))).toBe(false);
    expect(checkoutConsentGiven(form({}))).toBe(false);
  });
  it("versions every consented document as a date", () => {
    for (const v of Object.values(LEGAL_VERSIONS)) expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(LEGAL_VERSIONS)).toEqual(expect.arrayContaining(["preInfo", "distanceSales"]));
  });
  it("reports placeholders until the company details are filled in", () => {
    expect(companyInfoPending(COMPANY)).toBe(true);
    const filled = { name: "Örnek Yazılım", address: "İstanbul", taxOffice: "Kadıköy", taxNo: "1234567890", email: "destek@example.com", kep: "-" };
    expect(companyInfoPending(filled)).toBe(false);
  });
});
