/**
 * Ad budget and break-even arithmetic for the public calculator. Pure functions, no I/O.
 * All money values are in TL, rates are fractions (0.02 = %2). Results are estimates.
 */

export interface BudgetInput {
  /** Selling price per order, VAT included. */
  price: number;
  /** Product cost per order. */
  cost: number;
  /** Shipping and packaging per order. */
  shipping: number;
  /** Payment / marketplace commission as a fraction of the price. */
  feeRate: number;
  /** Expected cost per click. */
  cpc: number;
  /** Expected click-through rate (clicks / impressions). */
  ctr: number;
  /** Expected conversion rate (orders / clicks). */
  conversionRate: number;
  /** Daily ad budget. */
  dailyBudget: number;
  /** Optional target ROAS (revenue / ad spend); 0 means not set. */
  targetRoas: number;
}

export interface Scenario {
  id: "kotumser" | "beklenen" | "iyimser";
  label: string;
  conversionRate: number;
  ordersPerMonth: number;
  revenuePerMonth: number;
  spendPerMonth: number;
  profitPerMonth: number;
  roas: number | null;
  cpa: number | null;
}

export interface BudgetResult {
  /** Contribution margin per order before ads. */
  margin: number;
  marginRate: number;
  /** Highest cost per order (CPA) that still breaks even. */
  breakEvenCpa: number;
  /** ROAS needed to break even. Null when there is no margin. */
  breakEvenRoas: number | null;
  /** Highest cost per click that breaks even at the expected conversion rate. */
  breakEvenCpc: number;
  /** Highest cost per thousand impressions that breaks even at the expected CTR and conversion rate. */
  breakEvenCpm: number;
  /** Conversion rate needed to break even at the expected CPC. Null when there is no margin. */
  requiredConversionRate: number | null;
  /** With a target ROAS: allowed cost per order and the profit left per order. */
  target: { cpa: number; profitPerOrder: number } | null;
  scenarios: Scenario[];
  warnings: string[];
}

export const DAYS_PER_MONTH = 30;

const finite = (n: number) => (Number.isFinite(n) ? n : 0);
const clamp0 = (n: number) => Math.max(0, finite(n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateBudget(raw: BudgetInput): BudgetResult {
  const i = {
    price: clamp0(raw.price),
    cost: clamp0(raw.cost),
    shipping: clamp0(raw.shipping),
    feeRate: Math.min(1, clamp0(raw.feeRate)),
    cpc: clamp0(raw.cpc),
    ctr: Math.min(1, clamp0(raw.ctr)),
    conversionRate: Math.min(1, clamp0(raw.conversionRate)),
    dailyBudget: clamp0(raw.dailyBudget),
    targetRoas: clamp0(raw.targetRoas),
  };
  const margin = i.price - i.cost - i.shipping - i.price * i.feeRate;
  const positive = margin > 0;
  const breakEvenCpa = Math.max(0, margin);
  const breakEvenCpc = breakEvenCpa * i.conversionRate;
  const warnings: string[] = [];
  if (!positive) warnings.push("Ürün reklamsız da zarar ediyor: fiyat, maliyet, kargo ve komisyonun toplamını karşılamıyor. Önce fiyatı ya da maliyeti gözden geçir.");
  if (positive && i.cpc > 0 && i.cpc > breakEvenCpc) warnings.push("Beklenen tıklama maliyeti başa baş noktasının üstünde; bu dönüşüm oranıyla reklam zarar ettirir.");
  if (i.conversionRate === 0) warnings.push("Dönüşüm oranı 0 girildi; senaryolar sipariş hesaplayamaz.");

  const scenario = (id: Scenario["id"], label: string, factor: number): Scenario => {
    const cr = Math.min(1, i.conversionRate * factor);
    const spend = i.dailyBudget * DAYS_PER_MONTH;
    const clicks = i.cpc > 0 ? spend / i.cpc : 0;
    const orders = clicks * cr;
    const revenue = orders * i.price;
    return {
      id,
      label,
      conversionRate: cr,
      ordersPerMonth: round2(orders),
      revenuePerMonth: round2(revenue),
      spendPerMonth: round2(spend),
      profitPerMonth: round2(orders * margin - spend),
      roas: spend > 0 ? round2(revenue / spend) : null,
      cpa: orders > 0 ? round2(spend / orders) : null,
    };
  };

  return {
    margin: round2(margin),
    marginRate: i.price > 0 ? margin / i.price : 0,
    breakEvenCpa: round2(breakEvenCpa),
    breakEvenRoas: positive ? round2(i.price / margin) : null,
    breakEvenCpc: round2(breakEvenCpc),
    breakEvenCpm: round2(breakEvenCpc * i.ctr * 1000),
    requiredConversionRate: positive && i.cpc > 0 ? i.cpc / margin : null,
    target: i.targetRoas > 0 ? { cpa: round2(i.price / i.targetRoas), profitPerOrder: round2(margin - i.price / i.targetRoas) } : null,
    scenarios: [scenario("kotumser", "Kötümser", 0.5), scenario("beklenen", "Beklenen", 1), scenario("iyimser", "İyimser", 1.5)],
    warnings,
  };
}

/** Parses a Turkish or English formatted number ("1.250,50", "1250.5", "%2,5"). Empty or invalid → 0. */
export function parseNumber(s: string): number {
  const t = s.replace(/[%\s₺]|TL/gi, "");
  if (!t) return 0;
  // A comma is the Turkish decimal separator; dots in groups of three are thousands.
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
