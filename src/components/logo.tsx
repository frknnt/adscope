import Link from "next/link";

/** Wordmark: a lens ring with a coral tick inside, set next to "AdScope" in the display face. */
export function Logo({ href = "/", tone = "ink" }: { href?: string; tone?: "ink" | "paper" }) {
  const color = tone === "ink" ? "text-ink" : "text-paper";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${color} no-underline`} aria-label="AdScope ana sayfa">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M21.5 21.5 28 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="m9.5 14.5 3 3 6-7" fill="none" stroke="#e2553a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-[1.35rem] font-semibold leading-none">AdScope</span>
    </Link>
  );
}
