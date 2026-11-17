import type { RuleStatus } from "@/lib/rules/catalog";

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  active: "Aktif",
  requires_review: "Doğrulama bekliyor",
  draft: "Taslak",
  retired: "Yürürlükten kalktı",
};

const STYLE: Record<RuleStatus, string> = {
  active: "bg-green-tint text-green",
  requires_review: "bg-amber-tint text-amber",
  draft: "bg-paper-2 text-muted",
  retired: "bg-paper-2 text-muted",
};

export function RuleStatusPill({ status }: { status: RuleStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${STYLE[status]}`}>{RULE_STATUS_LABEL[status]}</span>;
}

export { SECTOR_LABEL } from "@/lib/sectors";
export const DOMAIN_LABEL = { meta_policy: "Meta Reklam Standartları", tr_law: "Türk reklam mevzuatı", creative_quality: "Kreatif kalite" } as const;

export function formatDateTr(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" }).format(d);
}

export function formatDateTimeTr(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));
}
