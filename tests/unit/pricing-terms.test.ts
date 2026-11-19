import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRICING_TERMS } from "@/components/pricing-terms";
import { CREDIT_COST } from "@/lib/analysis/cost";
import { CREATIVE_CREDIT_COST } from "@/lib/creative/costs";
import { creditExamples, CREDIT_USES } from "@/lib/payments/credit-uses";
import { CREDIT_PACKAGES, SIGNUP_BONUS_CREDITS } from "@/lib/payments/packages";

const MIGRATIONS = "supabase/migrations";

/** The last migration that (re)defines the signup trigger is the one the database runs. */
function signupBonusInDatabase(): number | null {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  let bonus: number | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");
    if (!/function\s+app_private\.handle_new_user/.test(sql)) continue;
    const m = sql.match(/v_bonus\s+integer\s*:=\s*(\d+)/);
    if (m) bonus = Number(m[1]);
  }
  return bonus;
}

describe("pricing promises match the code", () => {
  it("the free signup credits shown on the site are what the database grants", () => {
    expect(signupBonusInDatabase()).toBe(SIGNUP_BONUS_CREDITS);
    expect(PRICING_TERMS[0].title).toContain(`${SIGNUP_BONUS_CREDITS} ücretsiz kredi`);
  });

  it("credit examples come from the cost tables the services charge with", () => {
    const cost = Object.fromEntries(CREDIT_USES.map((u) => [u.id, u.credits]));
    expect(cost).toEqual({ image_analysis: CREDIT_COST.image, video_analysis: CREDIT_COST.video, creative_download: CREATIVE_CREDIT_COST });
    for (const p of CREDIT_PACKAGES) {
      const ex = Object.fromEntries(creditExamples(p.credits).map((e) => [e.id, e.count]));
      expect(ex.image_analysis).toBe(Math.floor(p.credits / CREDIT_COST.image));
      expect(ex.video_analysis).toBe(Math.floor(p.credits / CREDIT_COST.video));
      expect(ex.creative_download).toBe(Math.floor(p.credits / CREATIVE_CREDIT_COST));
    }
    expect(creditExamples(-5).every((e) => e.count === 0)).toBe(true);
  });

  it("promises no guarantee, no expiry the owner has not decided on, and names no other product", () => {
    const text = PRICING_TERMS.map((t) => `${t.title} ${t.body}`).join(" ");
    expect(text).not.toMatch(/garanti|kesin onay|hukuken uygun|reddedilmez/i);
    expect(text).not.toMatch(/süresiz|süresi dolmaz|ay içinde|son kullanma/i);
    expect(text).not.toMatch(/canva|adcreative|predis|pencil|creatopy/i);
  });
});
