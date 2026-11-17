/**
 * Rule card review with an expert (lawyer / specialist).
 *
 *   npx tsx scripts/rule-review.ts export [docs/KURAL_INCELEME.md]   -> writes the review table
 *   npx tsx scripts/rule-review.ts apply  [docs/KURAL_INCELEME.md]   -> reads the filled table,
 *        updates src/lib/rules/review-decisions.json and regenerates supabase/seed.sql
 *
 * Approved cards become "active" with today's date as lastVerifiedAt; a card without an https
 * source link is refused. The table's text is treated as data only.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { RULE_CATALOG } from "../src/lib/rules/catalog";
import { decisionsFromRows, parseReviewTable, renderReviewTable, type ReviewDecisions } from "../src/lib/rules/review";

const DECISIONS = "src/lib/rules/review-decisions.json";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const [cmd, file = "docs/KURAL_INCELEME.md"] = process.argv.slice(2);

if (cmd === "export") {
  writeFileSync(file, renderReviewTable(RULE_CATALOG, today));
  const pending = RULE_CATALOG.filter((r) => r.status === "requires_review").length;
  console.log(`${file} yazıldı: ${RULE_CATALOG.length} kart, ${pending} tanesi doğrulama bekliyor.`);
} else if (cmd === "apply") {
  const { rows, errors: parseErrors } = parseReviewTable(readFileSync(file, "utf8"));
  const previous = JSON.parse(readFileSync(DECISIONS, "utf8")) as ReviewDecisions;
  const { decisions, errors } = decisionsFromRows(rows, RULE_CATALOG, today, previous);
  for (const e of [...parseErrors, ...errors]) console.error(`Uyarı: ${e}`);
  writeFileSync(DECISIONS, JSON.stringify(decisions, null, 2) + "\n");
  const count = (d: string) => Object.values(decisions).filter((x) => x.decision === d && x.reviewedAt === today).length;
  console.log(`Bugün: ${count("onay")} onay, ${count("duzeltme")} düzeltme, ${count("kaldir")} kaldırma. ${DECISIONS} güncellendi.`);
  execFileSync("npx", ["tsx", "scripts/generate-seed.ts"], { stdio: "inherit" });
  console.log("Veritabanına uygulamak için: npx supabase db reset (yerel) ya da seed.sql'i üretim veritabanında çalıştırın. Ardından tabloyu yeniden üretin: npx tsx scripts/rule-review.ts export");
  if (parseErrors.length || errors.length) process.exitCode = 1;
} else {
  console.log("Kullanım: npx tsx scripts/rule-review.ts export|apply [dosya]");
  process.exitCode = 1;
}
