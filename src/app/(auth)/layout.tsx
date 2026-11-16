import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-5 sm:px-6">
        <Logo />
      </header>
      <main id="icerik" className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-12 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:pt-10">
        {children}
      </main>
    </div>
  );
}
