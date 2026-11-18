import { describe, expect, it } from "vitest";
import { calculateBudget, parseNumber, type BudgetInput } from "@/lib/calc/budget";

const base: BudgetInput = { price: 600, cost: 220, shipping: 45, feeRate: 0.03, cpc: 4.5, ctr: 0.012, conversionRate: 0.018, dailyBudget: 500, targetRoas: 0 };

describe("budget calculator", () => {
  it("computes margin and break-even points", () => {
    const r = calculateBudget(base);
    // 600 - 220 - 45 - 18 = 317
    expect(r.margin).toBe(317);
    expect(r.breakEvenCpa).toBe(317);
    expect(r.breakEvenRoas).toBe(1.89); // 600 / 317
    expect(r.breakEvenCpc).toBe(5.71); // 317 * 0.018
    expect(r.breakEvenCpm).toBe(68.47); // 5.706 * 0.012 * 1000
    expect(r.requiredConversionRate).toBeCloseTo(4.5 / 317, 6);
    expect(r.warnings).toEqual([]);
  });

  it("builds three monthly scenarios around the expected conversion rate", () => {
    const r = calculateBudget(base);
    const [low, mid, high] = r.scenarios;
    expect(mid.spendPerMonth).toBe(15000);
    // 15000 / 4.5 clicks * 0.018 = 60 orders
    expect(mid.ordersPerMonth).toBe(60);
    expect(mid.revenuePerMonth).toBe(36000);
    expect(mid.profitPerMonth).toBe(60 * 317 - 15000);
    expect(mid.roas).toBe(2.4);
    expect(mid.cpa).toBe(250);
    expect(low.ordersPerMonth).toBe(30);
    expect(low.profitPerMonth).toBeLessThan(0);
    expect(high.ordersPerMonth).toBe(90);
  });

  it("handles a target ROAS and warns when the numbers cannot work", () => {
    expect(calculateBudget({ ...base, targetRoas: 3 }).target).toEqual({ cpa: 200, profitPerOrder: 117 });
    const loss = calculateBudget({ ...base, cost: 700 });
    expect(loss.breakEvenRoas).toBeNull();
    expect(loss.breakEvenCpa).toBe(0);
    expect(loss.warnings[0]).toContain("zarar");
    expect(calculateBudget({ ...base, cpc: 9 }).warnings.some((w) => w.includes("tıklama maliyeti"))).toBe(true);
    const zero = calculateBudget({ ...base, cpc: 0, dailyBudget: 0, conversionRate: 0, price: Number.NaN });
    expect(zero.scenarios.every((s) => Number.isFinite(s.profitPerMonth) && s.roas === null)).toBe(true);
  });

  it("parses Turkish and English number formats", () => {
    expect(parseNumber("1.250,50")).toBe(1250.5);
    expect(parseNumber("1.250")).toBe(1250);
    expect(parseNumber("4,5")).toBe(4.5);
    expect(parseNumber("4.5")).toBe(4.5);
    expect(parseNumber("%2,5")).toBe(2.5);
    expect(parseNumber("₺ 300")).toBe(300);
    expect(parseNumber("abc")).toBe(0);
    expect(parseNumber("")).toBe(0);
  });
});
