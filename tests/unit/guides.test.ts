import { describe, expect, it } from "vitest";
import { catalogRules } from "@/lib/data/memory-repo";
import { buildGuide, GUIDE_SLUGS, type GuideSlug } from "@/lib/guides/guides";

describe("sector guides", () => {
  const rules = catalogRules();
  for (const slug of Object.keys(GUIDE_SLUGS) as GuideSlug[]) {
    it(`${slug}: every item comes from a sourced card of the sector`, () => {
      const g = buildGuide(slug, rules);
      expect(g.cards.length, slug).toBeGreaterThan(0);
      const ids = new Map(g.cards.map((r) => [r.id, r]));
      for (const r of g.cards) {
        expect(r.sector).toBe(g.sector);
        expect(["active", "requires_review"]).toContain(r.status);
        expect(r.sourceUrl).toMatch(/^https:\/\//);
      }
      for (const x of [...g.risky, ...g.safe]) {
        const card = ids.get(x.ruleId);
        expect(card, x.ruleId).toBeDefined();
        expect(x.verified).toBe(card!.status === "active");
      }
      for (const s of g.safe) expect(s.to).not.toBe(s.from);
      expect(g.sources.length).toBeGreaterThan(0);
      expect(g.title).not.toMatch(/garanti|kesin onay|reddedilmez/i);
    });
  }
});
