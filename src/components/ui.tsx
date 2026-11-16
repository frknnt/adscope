import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "accent" | "ghost" | "danger" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2 shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_6px_16px_-8px_rgba(19,33,60,.6)]",
  accent: "bg-[#e8603f] text-ink hover:bg-[#ea6a50] shadow-[0_6px_16px_-8px_rgba(178,58,33,.7)]",
  ghost: "border border-line-strong text-ink hover:bg-paper-2",
  danger: "bg-coral-deep text-white hover:bg-[#9b2f19]",
  quiet: "text-ink-soft hover:text-ink underline-offset-4 hover:underline",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 h-11 text-[0.95rem] font-semibold transition-[background,box-shadow,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 no-underline whitespace-nowrap";

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Panel({ children, className = "", as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={`rounded-2xl border border-line bg-card ${className}`}>{children}</As>;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-[0.82rem] text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-[0.82rem] font-medium text-coral-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-white/70 px-3.5 py-2.5 text-[0.98rem] text-ink placeholder:text-[#7b8296] transition focus:border-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/40 aria-[invalid=true]:border-coral-deep";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-xl bg-paper-2 px-4 py-3 text-[0.85rem] leading-relaxed text-ink-soft ${className}`} role="note">
      <strong className="font-semibold text-ink">Risk değerlendirmesidir, hukuki görüş değildir.</strong> AdScope sonuçları sürümlü kural kartlarına dayanan bir ön kontroldür; reklamın onaylanacağını ya da mevzuata uygun olduğunu garanti etmez. Kritik kararlar için bir hukukçuya danışın.
    </p>
  );
}

export function DemoBanner() {
  return (
    <div className="no-print bg-ink px-4 py-2 text-center text-[0.8rem] text-paper/90">
      <strong className="font-semibold text-paper">Demo modu.</strong> Gerçek ödeme alınmaz; yapay zekâ anahtarı tanımlı değilse analizler deterministik kural motoruyla yapılır.
    </div>
  );
}
