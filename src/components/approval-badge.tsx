import { BADGE_LABEL, BADGE_SHORT, type ApprovalBadge } from "@/lib/approval";

const TONE: Record<ApprovalBadge, string> = {
  pending: "bg-paper-2 text-ink-soft",
  approved: "bg-green-tint text-green",
  changes_requested: "bg-amber-tint text-amber",
  rejected: "bg-coral-tint text-coral-deep",
};

/** Client approval state of a report (P12.1). The visible text is short; the full sentence is for screen readers. */
export function ApprovalPill({ badge, short = false }: { badge: ApprovalBadge; short?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-meta font-bold ${TONE[badge]}`} title={BADGE_LABEL[badge]}>
      {short ? (
        <>
          <span aria-hidden>{BADGE_SHORT[badge]}</span>
          <span className="sr-only">{BADGE_LABEL[badge]}</span>
        </>
      ) : (
        BADGE_LABEL[badge]
      )}
    </span>
  );
}
