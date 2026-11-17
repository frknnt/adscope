import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "accent" | "ghost" | "danger" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2 shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_6px_16px_-8px_rgba(19,33,60,.6)]",
  accent: "bg-accent text-on-accent hover:bg-accent-hover shadow-[0_6px_16px_-8px_rgba(178,58,33,.7)]",
  ghost: "border border-line-strong text-ink hover:bg-paper-2",
  danger: "bg-coral-deep text-paper hover:bg-coral",
  quiet: "text-ink-soft hover:text-ink underline-offset-4 hover:underline",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 h-11 text-body font-semibold transition-[background,box-shadow,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 no-underline whitespace-nowrap";

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
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-meta text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-meta font-medium text-coral-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-field/70 px-3.5 py-2.5 text-base text-ink placeholder:text-placeholder transition focus:border-ink focus:bg-field focus:outline-none focus:ring-2 focus:ring-coral/40 aria-[invalid=true]:border-coral-deep";

/** Native select styled like an input, with a drawn chevron (see `.select` in globals.css). */
export const selectClass = `${inputClass} select`;

/** Placeholder block while content loads. Size it with width/height utilities. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** An empty list or first-run state: what is missing, why it matters, one next step. */
export function EmptyState({ title, children, action, className = "" }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`sheet rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center ${className}`}>
      <p className="font-display text-2xl font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Progress through a fixed sequence. `current` is 0-based; later steps are shown as upcoming. */
export function Stepper({ steps, current, label = "Adımlar" }: { steps: string[]; current: number; label?: string }) {
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-meta font-semibold" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          {i > 0 ? <span className="text-line-strong" aria-hidden>—</span> : null}
          <span
            aria-current={i === current ? "step" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${i === current ? "bg-ink text-paper" : i < current ? "bg-paper-2 text-ink" : "text-muted"}`}
          >
            <span className="tabular">{i + 1}</span> {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Scrollable, keyboard-focusable table frame. Pass a <table> whose cells use `px-5 py-3`. */
export function DataTable({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-line bg-card ${className}`} tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-xl bg-paper-2 px-4 py-3 text-small leading-relaxed text-ink-soft ${className}`} role="note">
      <strong className="font-semibold text-ink">Risk değerlendirmesidir, hukuki görüş değildir.</strong> AdScope sonuçları sürümlü kural kartlarına dayanan bir ön kontroldür; reklamın onaylanacağını ya da mevzuata uygun olduğunu garanti etmez. Kritik kararlar için bir hukukçuya danışın.
    </p>
  );
}

export function DemoBanner() {
  return (
    <div className="no-print bg-ink px-4 py-2 text-center text-meta text-paper/90">
      <strong className="font-semibold text-paper">Demo modu.</strong> Gerçek ödeme alınmaz; yapay zekâ anahtarı tanımlı değilse analizler deterministik kural motoruyla yapılır.
    </div>
  );
}
