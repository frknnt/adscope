/** Calendar day in Europe/Istanbul (UTC+3, no DST) as YYYY-MM-DD. */
export function istanbulDay(d: Date) {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** The last `days` Istanbul calendar days, oldest first, including today. */
export function lastDays(days: number, now = new Date()) {
  return Array.from({ length: days }, (_, i) => istanbulDay(new Date(now.getTime() - (days - 1 - i) * 86400_000)));
}
