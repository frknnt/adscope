import type { AnalysisDetail, ApprovalDecision, ApprovalDecisionView } from "@/lib/data/types";

/**
 * Client approval (P12.1). Shared by the panel, the public approval page and both repositories,
 * so it has no server-only imports. The items of a link are fixed when the link is created.
 */

export const APPROVAL_DECISIONS = ["approved", "changes_requested", "rejected"] as const satisfies readonly ApprovalDecision[];
export const APPROVAL_KEY_RE = /^(text:(original|safe|v[0-9]{1,2})|image|video)$/;
export const APPROVAL_MAX_DAYS = 30;
export const REVIEWER_NAME_MAX = 80;
export const APPROVAL_COMMENT_MAX = 1000;

export const DECISION_LABEL: Record<ApprovalDecision, string> = {
  approved: "Onaylandı",
  changes_requested: "Değişiklik istendi",
  rejected: "Reddedildi",
};
export const DECISION_ACTION: Record<ApprovalDecision, string> = {
  approved: "Onayla",
  changes_requested: "Değişiklik iste",
  rejected: "Reddet",
};

export type ApprovalBadge = "pending" | ApprovalDecision;
export const BADGE_LABEL: Record<ApprovalBadge, string> = {
  pending: "Müşteri onayı bekleniyor",
  approved: "Müşteri onayladı",
  changes_requested: "Müşteri değişiklik istedi",
  rejected: "Müşteri reddetti",
};
export const BADGE_SHORT: Record<ApprovalBadge, string> = {
  pending: "Onay bekliyor",
  approved: "Onaylandı",
  changes_requested: "Değişiklik istendi",
  rejected: "Reddedildi",
};

export interface ApprovalItem {
  key: string;
  kind: "text" | "image" | "video";
  label: string;
  headline: string;
  primaryText: string;
  description: string;
}

/** Everything a customer can decide on for a completed analysis: texts, then the image or the video. */
export function approvalItems(a: Pick<AnalysisDetail, "headline" | "primaryText" | "description" | "variants" | "mediaType" | "asset" | "frames">): ApprovalItem[] {
  const items: ApprovalItem[] = [{ key: "text:original", kind: "text", label: "Gönderilen metin", headline: a.headline, primaryText: a.primaryText, description: a.description }];
  const safe = a.variants.find((v) => v.kind === "safe");
  if (safe) items.push({ key: "text:safe", kind: "text", label: "Güvenli metin önerisi", headline: safe.headline, primaryText: safe.primaryText, description: safe.description });
  const variants = a.variants.filter((v) => v.kind === "variant").sort((x, y) => x.position - y.position);
  variants.forEach((v, i) => {
    if (i >= 99) return;
    items.push({ key: `text:v${i + 1}`, kind: "text", label: `${i + 1}. metin varyantı (${v.tone})`, headline: v.headline, primaryText: v.primaryText, description: v.description });
  });
  if (a.mediaType === "video" && a.frames.length) items.push({ key: "video", kind: "video", label: "Video", headline: "", primaryText: "", description: "" });
  else if (a.mediaType !== "video" && a.asset) items.push({ key: "image", kind: "image", label: "Görsel", headline: "", primaryText: "", description: "" });
  return items;
}

/** Latest decision per item across every link of an analysis. */
export function latestDecisions(decisions: Pick<ApprovalDecisionView, "itemKey" | "decision" | "updatedAt">[]) {
  const out = new Map<string, ApprovalDecision>();
  const at = new Map<string, string>();
  for (const d of decisions) {
    const prev = at.get(d.itemKey);
    if (!prev || d.updatedAt >= prev) {
      out.set(d.itemKey, d.decision);
      at.set(d.itemKey, d.updatedAt);
    }
  }
  return out;
}

/**
 * One badge for an analysis: any rejection wins, then any change request; "approved" only when every
 * item has been approved; otherwise the approval is still pending.
 */
export function approvalBadge(itemKeys: string[], decisions: Pick<ApprovalDecisionView, "itemKey" | "decision" | "updatedAt">[]): ApprovalBadge {
  const latest = latestDecisions(decisions.filter((d) => itemKeys.includes(d.itemKey)));
  const values = [...latest.values()];
  if (values.includes("rejected")) return "rejected";
  if (values.includes("changes_requested")) return "changes_requested";
  if (itemKeys.length > 0 && itemKeys.every((k) => latest.get(k) === "approved")) return "approved";
  return "pending";
}

export function approvalCounts(itemKeys: string[], decisions: Pick<ApprovalDecisionView, "itemKey" | "decision" | "updatedAt">[]) {
  const latest = latestDecisions(decisions.filter((d) => itemKeys.includes(d.itemKey)));
  const c = { approved: 0, changes_requested: 0, rejected: 0, pending: 0 };
  for (const k of itemKeys) {
    const d = latest.get(k);
    if (d) c[d] += 1;
    else c.pending += 1;
  }
  return c;
}

/** Badge per analysis from every link of the user's analyses. */
export function badgesByAnalysis(rows: { analysisId: string; itemKeys: string[]; decisions: ApprovalDecisionView[] }[]): Record<string, ApprovalBadge> {
  const grouped = new Map<string, { keys: Set<string>; decisions: ApprovalDecisionView[] }>();
  for (const r of rows) {
    const g = grouped.get(r.analysisId) ?? { keys: new Set<string>(), decisions: [] };
    r.itemKeys.forEach((k) => g.keys.add(k));
    g.decisions.push(...r.decisions);
    grouped.set(r.analysisId, g);
  }
  const out: Record<string, ApprovalBadge> = {};
  for (const [id, g] of grouped) out[id] = approvalBadge([...g.keys], g.decisions);
  return out;
}

/** Trims a free-text reviewer name; control characters are dropped. Null when empty. */
export function cleanReviewerName(raw: string): string | null {
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, REVIEWER_NAME_MAX);
  return name.length ? name : null;
}
