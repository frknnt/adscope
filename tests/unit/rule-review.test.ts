import { describe, expect, it } from "vitest";
import { RULE_CATALOG } from "@/lib/rules/catalog";
import { applyReviewDecisions, decisionsFromRows, parseReviewTable, renderReviewTable } from "@/lib/rules/review";

const pending = RULE_CATALOG.find((r) => r.status === "requires_review")!;
const active = RULE_CATALOG.find((r) => r.status === "active")!;

function fill(md: string, id: string, decision: string, note = "") {
  return md
    .split("\n")
    .map((l) => (l.startsWith(`| ${id} |`) ? l.replace(/\|\s+\|\s+\|$/, `| ${decision} | ${note} |`) : l))
    .join("\n");
}

describe("rule card review", () => {
  it("renders every card and reads back the filled decisions", () => {
    const md = renderReviewTable(RULE_CATALOG, "2026-11-17");
    expect(md.split("\n").filter((l) => /^\| [A-Z]/.test(l) && !l.startsWith("| Kimlik"))).toHaveLength(RULE_CATALOG.length);
    const filled = fill(fill(md, pending.id, "Onay"), active.id, "kaldır", "Kaynak değişti | yeni sayfa");
    const { rows, errors } = parseReviewTable(filled);
    expect(errors).toEqual([]);
    expect(rows.find((r) => r.id === pending.id)?.decision).toBe("onay");
    expect(rows.find((r) => r.id === active.id)).toMatchObject({ decision: "kaldir", note: "Kaynak değişti | yeni sayfa" });
  });

  it("reports unclear decisions instead of guessing", () => {
    const md = fill(renderReviewTable(RULE_CATALOG, "2026-11-17"), pending.id, "belki");
    expect(parseReviewTable(md).errors[0]).toContain(pending.id);
  });

  it("approves a card to active with today's date and a new version", () => {
    const { decisions, errors } = decisionsFromRows([{ id: pending.id, decision: "onay", note: "" }], RULE_CATALOG, "2026-11-17");
    expect(errors).toEqual([]);
    const card = applyReviewDecisions(RULE_CATALOG, decisions).find((r) => r.id === pending.id)!;
    expect(card).toMatchObject({ status: "active", lastVerifiedAt: "2026-11-17", legalReviewStatus: "reviewed", version: pending.version + 1 });
  });

  it("never activates a card without an official https source", () => {
    const noSource = { ...pending, id: "TEST-NO-SOURCE", sourceUrl: "" };
    const cards = [...RULE_CATALOG, noSource];
    const { decisions, errors } = decisionsFromRows([{ id: "TEST-NO-SOURCE", decision: "onay", note: "" }, { id: "YOK-BOYLE", decision: "onay", note: "" }], cards, "2026-11-17");
    expect(errors).toHaveLength(2);
    expect(decisions["TEST-NO-SOURCE"]).toBeUndefined();
    // Even a hand-written decision cannot activate it.
    const applied = applyReviewDecisions(cards, { "TEST-NO-SOURCE": { decision: "onay", reviewedAt: "2026-11-17" } });
    expect(applied.find((r) => r.id === "TEST-NO-SOURCE")!.status).toBe("requires_review");
  });

  it("retires a removed card and leaves correction requests unverified", () => {
    const applied = applyReviewDecisions(RULE_CATALOG, {
      [active.id]: { decision: "kaldir", reviewedAt: "2026-11-17" },
      [pending.id]: { decision: "duzeltme", reviewedAt: "2026-11-17", note: "x" },
    });
    expect(applied.find((r) => r.id === active.id)!.status).toBe("retired");
    expect(applied.find((r) => r.id === pending.id)).toMatchObject({ status: "requires_review", legalReviewStatus: "changes_requested" });
  });
});
