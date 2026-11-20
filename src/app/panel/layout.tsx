import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/interactive";
import { getCurrentUser, getRepo, getWorkspace } from "@/lib/data";
import { PanelShell } from "./shell";

export const metadata = { title: "Panel" };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const [balance, ws] = await Promise.all([getRepo().getBalance(), getWorkspace()]);

  return (
    <PanelShell balance={balance} email={user.email} workspace={ws.mode === "editor" ? { ownerLabel: ws.ownerLabel } : null}>
      <ToastProvider>{children}</ToastProvider>
    </PanelShell>
  );
}
