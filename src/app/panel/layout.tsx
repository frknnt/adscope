import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/interactive";
import { getCurrentUser, getRepo } from "@/lib/data";
import { PanelShell } from "./shell";

export const metadata = { title: "Panel" };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const balance = await getRepo().getBalance();

  return (
    <PanelShell balance={balance} email={user.email}>
      <ToastProvider>{children}</ToastProvider>
    </PanelShell>
  );
}
