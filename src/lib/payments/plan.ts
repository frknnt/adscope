import type { PlanPeriod } from "@/lib/data/types";
import { PLAN_REMINDER_DAYS } from "./packages";

/** Adds one calendar month in UTC and clamps to the month's last day (as Postgres `+ interval '1 month'`). */
export function addOneMonth(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
}

/** A paid month starts now, or right after the user's last active period when that one has not ended yet. */
export function nextPeriod(lastActiveEnd: Date | null, now: Date): { startsAt: Date; endsAt: Date } {
  const startsAt = lastActiveEnd && lastActiveEnd > now ? lastActiveEnd : now;
  return { startsAt, endsAt: addOneMonth(startsAt) };
}

export interface PlanStatus {
  /** The period running now, if any. */
  current: PlanPeriod | null;
  /** The last active period (current or already bought for later). */
  last: PlanPeriod | null;
  /** Whole days until the last active period ends (0 when it ended or none). */
  daysLeft: number;
  /** True inside the reminder window: renewal is suggested. */
  renewSoon: boolean;
}

export function planStatus(periods: PlanPeriod[], now: Date): PlanStatus {
  const active = periods.filter((p) => p.status === "active").sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
  const current = active.find((p) => Date.parse(p.startsAt) <= now.getTime() && now.getTime() < Date.parse(p.endsAt)) ?? null;
  const last = active.length ? active[active.length - 1] : null;
  const msLeft = last ? Date.parse(last.endsAt) - now.getTime() : 0;
  const daysLeft = msLeft > 0 ? Math.ceil(msLeft / 86_400_000) : 0;
  return { current, last, daysLeft, renewSoon: Boolean(last) && msLeft > 0 && msLeft <= PLAN_REMINDER_DAYS * 86_400_000 };
}
