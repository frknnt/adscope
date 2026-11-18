/** Server-side "now minus n days" for admin queries (kept out of component bodies). */
export function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}
