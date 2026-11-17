import type { RuleCardDef } from "./catalog";

/**
 * Expert review of rule cards (docs/KURAL_INCELEME.md).
 *
 * The catalog stays the single source of truth; a reviewer's decisions live in
 * review-decisions.json and are applied on top of it:
 *   onay     -> status "active", lastVerifiedAt = review date, legal review "reviewed", version + 1
 *   kaldır   -> status "retired" (never used by the engine), version + 1
 *   düzeltme -> no status change; the note is kept for the developer.
 * A card without an https source link can never become active.
 */

export type ReviewDecision = "onay" | "duzeltme" | "kaldir";

export interface ReviewEntry {
  decision: ReviewDecision;
  /** YYYY-MM-DD */
  reviewedAt: string;
  note?: string;
}

export type ReviewDecisions = Record<string, ReviewEntry>;

export const REVIEW_COLUMNS = ["Kimlik", "Başlık", "Durum", "Kaynak", "Alıntı / dayanak", "Karar (onay / düzeltme / kaldır)", "Not"] as const;

const STATUS_TR: Record<string, string> = { active: "Aktif", requires_review: "Doğrulama bekliyor", draft: "Taslak", retired: "Kaldırıldı" };

function cell(v: string | undefined | null): string {
  return String(v ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

export function hasOfficialSource(card: Pick<RuleCardDef, "sourceUrl">): boolean {
  try {
    const u = new URL(card.sourceUrl);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** The review table, one row per card; cards already active are listed too so they can be re-checked. */
export function renderReviewTable(cards: RuleCardDef[], generatedOn: string): string {
  const head = [
    "# Kural kartı inceleme tablosu",
    "",
    `Oluşturulma: ${generatedOn}. Bu dosya \`npx tsx scripts/rule-review.ts export\` ile üretilir.`,
    "",
    "Nasıl doldurulur:",
    "",
    "1. Her satırda kaynağı açın, alıntının kartın açıklamasını desteklediğini kontrol edin.",
    "2. \"Karar\" sütununa yalnızca `onay`, `düzeltme` ya da `kaldır` yazın. Boş bırakılan satır değişmez.",
    "3. `düzeltme` seçerseniz ne değişmesi gerektiğini \"Not\" sütununa yazın; kart düzeltilene kadar doğrulama bekliyor durumunda kalır.",
    "4. Dosyayı kaydedip `npx tsx scripts/rule-review.ts apply docs/KURAL_INCELEME.md` çalıştırın. Onaylanan kartlar aktif olur ve son doğrulama tarihi bugün olur. Kaynak bağlantısı olmayan kart aktif olamaz.",
    "",
    "Bu tablo bir risk değerlendirmesi aracının iç kontrolüdür; hukuki görüş değildir.",
    "",
  ];
  const sep = `| ${REVIEW_COLUMNS.map(() => "---").join(" | ")} |`;
  const rows = cards.map(
    (c) =>
      `| ${cell(c.id)} | ${cell(c.title)} | ${cell(STATUS_TR[c.status] ?? c.status)} | ${c.sourceUrl ? `[${cell(c.sourceOrg)}](${cell(c.sourceUrl)})` : "(kaynak yok)"} | ${cell(c.sourceReference || c.sourceTitle)} |  |  |`,
  );
  return [...head, `| ${REVIEW_COLUMNS.join(" | ")} |`, sep, ...rows, ""].join("\n");
}

function splitRow(line: string): string[] {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (t[i] === "|") {
      out.push(cur.trim());
      cur = "";
    } else cur += t[i];
  }
  out.push(cur.trim());
  return out;
}

function normDecision(v: string): ReviewDecision | "" | null {
  const s = v
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/[`*_]/g, "");
  if (!s) return "";
  if (["onay", "onayla", "onaylandi", "ok"].includes(s)) return "onay";
  if (["duzeltme", "duzelt"].includes(s)) return "duzeltme";
  if (["kaldir", "sil"].includes(s)) return "kaldir";
  return null;
}

export interface ParsedRow {
  id: string;
  decision: ReviewDecision | "";
  note: string;
}

/** Reads the filled table. Unknown decisions are reported, not guessed. */
export function parseReviewTable(md: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const lines = md.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  const header = lines[0] ? splitRow(lines[0]) : [];
  const idI = header.indexOf("Kimlik");
  const decI = header.findIndex((h) => h.startsWith("Karar"));
  const noteI = header.indexOf("Not");
  if (idI < 0 || decI < 0) return { rows, errors: ["Tablo başlığı bulunamadı: \"Kimlik\" ve \"Karar\" sütunları gerekli."] };
  for (const line of lines.slice(1)) {
    const cells = splitRow(line);
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    const id = cells[idI] ?? "";
    if (!id) continue;
    const d = normDecision(cells[decI] ?? "");
    if (d === null) {
      errors.push(`${id}: "${cells[decI]}" anlaşılmadı. onay, düzeltme ya da kaldır yazın.`);
      continue;
    }
    // A raw "|" typed in the last (note) column splits it; join the pieces back.
    const note = noteI < 0 ? "" : noteI === header.length - 1 ? cells.slice(noteI).filter(Boolean).join(" | ") : (cells[noteI] ?? "");
    rows.push({ id, decision: d, note });
  }
  return { rows, errors };
}

/** Turns filled rows into decisions, refusing unknown ids and approvals without an official source. */
export function decisionsFromRows(rows: ParsedRow[], cards: RuleCardDef[], today: string, previous: ReviewDecisions = {}): { decisions: ReviewDecisions; errors: string[] } {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const decisions: ReviewDecisions = { ...previous };
  const errors: string[] = [];
  for (const r of rows) {
    if (!r.decision) continue;
    const card = byId.get(r.id);
    if (!card) {
      errors.push(`${r.id}: katalogda böyle bir kart yok.`);
      continue;
    }
    if (r.decision === "onay" && !hasOfficialSource(card)) {
      errors.push(`${r.id}: kaynak bağlantısı olmadığı için aktif yapılamaz.`);
      continue;
    }
    decisions[r.id] = { decision: r.decision, reviewedAt: today, ...(r.note ? { note: r.note.slice(0, 500) } : {}) };
  }
  return { decisions, errors };
}

/** Applies stored decisions to the catalog (pure; unknown ids and unsafe approvals are ignored). */
export function applyReviewDecisions(cards: RuleCardDef[], decisions: ReviewDecisions): RuleCardDef[] {
  return cards.map((c) => {
    const d = decisions[c.id];
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.reviewedAt)) return c;
    if (d.decision === "onay" && hasOfficialSource(c)) {
      return { ...c, status: "active", version: c.version + 1, lastVerifiedAt: d.reviewedAt, legalReviewStatus: "reviewed", verificationNote: `Uzman incelemesiyle onaylandı (${d.reviewedAt}). ${c.verificationNote}`.trim() };
    }
    if (d.decision === "kaldir" && c.status !== "retired") return { ...c, status: "retired", version: c.version + 1 };
    if (d.decision === "duzeltme") return { ...c, legalReviewStatus: "changes_requested" };
    return c;
  });
}
