import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { IconLogout } from "@/components/icons";
import { ToastProvider } from "@/components/interactive";
import { Logo } from "@/components/logo";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PanelNav } from "./panel-nav";

export const metadata = { title: "Panel" };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const balance = await getRepo().getBalance();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="no-print border-b border-line bg-card/70 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:px-5 lg:pt-6">
          <Logo href="/panel" />
          <Link href="/panel/krediler" className="rounded-full border border-line-strong px-3 py-1 text-small font-semibold text-ink no-underline lg:hidden">
            <span className="tabular">{balance}</span> kredi
          </Link>
        </div>
        <div className="px-3 py-3 lg:mt-6 lg:flex-1 lg:px-4">
          <PanelNav />
        </div>
        <div className="hidden border-t border-line px-5 py-5 lg:block">
          <Link href="/panel/krediler" className="block rounded-xl bg-paper-2 px-4 py-3 no-underline">
            <span className="block text-meta font-semibold text-muted">Kredi bakiyesi</span>
            <span className="font-display text-3xl font-semibold tabular text-ink">{balance}</span>
            <span className="ml-1 text-sm text-ink-soft">analiz</span>
          </Link>
          <p className="mt-4 truncate text-meta text-muted" title={user.email}>{user.email}</p>
          <form action={signOutAction} className="mt-2">
            <button type="submit" className="inline-flex items-center gap-2 text-small font-semibold text-ink-soft hover:text-ink">
              <IconLogout className="size-4" /> Çıkış yap
            </button>
          </form>
        </div>
      </aside>
      <main id="icerik" className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <ToastProvider>{children}</ToastProvider>
        </div>
        <form action={signOutAction} className="no-print mx-auto mt-16 max-w-5xl border-t border-line pt-4 lg:hidden">
          <button type="submit" className="inline-flex items-center gap-2 text-body font-semibold text-ink-soft">
            <IconLogout className="size-4" /> Çıkış yap ({user.email})
          </button>
        </form>
      </main>
    </div>
  );
}
