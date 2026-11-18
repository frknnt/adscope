import type { AnalysisDetail, FindingView } from "@/lib/data/types";
import { PLATFORM_SHORT } from "@/lib/platforms";

/** The single most important thing to fix: the first red (verified law before platform), else the first yellow. */
export function fixFirst(findings: FindingView[]): FindingView | null {
  const rank = (f: FindingView) => (f.severity === "red" ? 0 : f.severity === "yellow" ? 2 : 4) + (f.domain === "tr_law" && f.rule?.status === "active" ? 0 : 1);
  return [...findings].filter((f) => f.severity !== "info").sort((x, y) => rank(x) - rank(y))[0] ?? null;
}

/**
 * One sentence on top of the report and the PDF. Describes risk; never promises approval. A legal
 * violation is named only when it rests on an active rule card.
 */
export function resultSentence(a: Pick<AnalysisDetail, "findings" | "metaRiskLevel" | "platform">): string {
  const legal = a.findings.filter((f) => f.domain === "tr_law" && f.severity === "red" && f.rule?.status === "active").length;
  const red = a.findings.filter((f) => f.severity === "red").length;
  const yellow = a.findings.filter((f) => f.severity === "yellow").length;
  const platform = PLATFORM_SHORT[a.platform];
  if (legal) return `Bu reklamda doğrulanmış bir mevzuat kuralına takılan ${legal} ifade var; yayına almadan önce düzeltmeni öneririz.`;
  if (red) return `${platform} incelemesinde ret riski yüksek görünüyor; önce işaretli ${red} ifadeyi düzelt.`;
  if (a.metaRiskLevel === "high") return `${platform} incelemesinde ret riski yüksek görünüyor; önce işaretli ifadeleri gözden geçir.`;
  if (yellow) return `Belirgin bir ihlal görünmüyor, ancak ${yellow} ifade dikkat gerektiriyor.`;
  return "Aktif kural kartlarına göre işaretlenen bir ifade bulunmadı. Bu, reklamın onaylanacağı anlamına gelmez.";
}
